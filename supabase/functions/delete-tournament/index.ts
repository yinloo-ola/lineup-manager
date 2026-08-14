// Delete a Tournament: remove every Team Manager auth account bound to its
// teams, then delete the tournament row (which hard-cascades its teams, players,
// team events, team matches, team match formats, and lineups via the on-delete
// cascades added in migration 0009). Removing the auth accounts is why this is a
// service-role function — the browser client cannot touch auth.users, and leaving
// the accounts behind would let locked-out managers sign in to an empty system.
//
// Runs with the service_role key (auto-injected as env by the Supabase runtime),
// so this MUST be server-side — never ship the service_role key to the browser.
// Caller must be an administrator.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
  // Service-role client (service_role is in env; bypasses RLS).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Authorise: the caller must be an admin. We forward the caller's access
  // token to a caller-authenticated client and call is_admin() — PostgREST
  // validates the JWT signature and is_admin() reads the email claim, exactly
  // as the RLS policies do. (auth.getUser(token) on a service-role client is
  // unreliable for caller identity, so we don't use it here.)
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const caller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    },
  );
  const { data: isAdmin, error: adminErr } = await caller.rpc("is_admin");
  if (adminErr || !isAdmin) {
    return json({ error: "Forbidden: administrators only" }, 403);
  }

  // Validate input.
  const body = await req.json().catch(() => null);
  const tournamentId = typeof body?.tournamentId === "string" ? body.tournamentId : "";
  if (!tournamentId) return json({ error: "tournamentId is required" }, 400);

  // The tournament must exist (and the caller's is_admin RLS would let them see
  // it anyway, but the service-role read is unambiguous for a destructive op).
  const { data: tour } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tour) return json({ error: "Tournament not found" }, 404);

  // Gather the manager auth user_ids for this tournament's teams. Read them
  // BEFORE deleting anything: once the tournament (and its teams) are gone the
  // team_managers rows cascade away and we'd lose the mapping to the accounts.
  const { data: teams } = await admin
    .from("teams")
    .select("id")
    .eq("tournament_id", tournamentId);
  const teamIds = (teams as { id: string }[] | null ?? []).map((t) => t.id);
  const userIds: string[] = [];
  if (teamIds.length > 0) {
    const { data: managers } = await admin
      .from("team_managers")
      .select("user_id")
      .in("team_id", teamIds);
    for (const m of (managers as { user_id: string }[] | null ?? [])) {
      if (m.user_id) userIds.push(m.user_id);
    }
  }

  // Remove each manager's auth account so they can no longer sign in. A "user
  // not found" error is treated as success — the account is already gone, which
  // is exactly the desired end state (idempotent on re-tries). Any other error
  // aborts BEFORE the tournament is touched, leaving the rows intact so the
  // admin can retry without orphaning an account we failed to remove.
  for (const userId of userIds) {
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr && !/not found/i.test(delErr.message)) {
      return json(
        { error: `Failed to remove manager account: ${delErr.message}`, userId },
        500,
      );
    }
  }

  // Delete the tournament — on-delete cascades clear its categories, teams,
  // players, ties, tie_formats and lineups (migration 0009).
  const { error: delTourErr } = await admin
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);
  if (delTourErr) {
    return json({ error: delTourErr.message }, 500);
  }

  return json({ ok: true, tournamentId, removedAccounts: userIds.length }, 200);
  } catch (e) {
    return json({ error: "internal", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
