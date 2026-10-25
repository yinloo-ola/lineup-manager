// Provision an Umpire: create a Supabase Auth user (email + initial password),
// bound to one tournament, with must_change_password=true. Mirrors the
// provision-manager flow (service role + caller-JWT admin authorization); an
// umpire is tournament-scoped rather than team-scoped and may be one of many
// per tournament.
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
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const tournamentId = typeof body?.tournamentId === "string" ? body.tournamentId : "";
  if (!email || !password || !tournamentId) {
    return json({ error: "email, password and tournamentId are required" }, 400);
  }

  // The tournament must exist. Read via the caller (admin) client — is_admin()
  // RLS already authorises these reads.
  const { data: tour } = await caller
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!tour) return json({ error: "Tournament not found" }, 404);

  // One umpire account per email per tournament (many umpires per tournament).
  // An auth email is globally unique in Supabase Auth, so re-provisioning the
  // same email for the SAME tournament is the idempotent re-run case (409);
  // for a DIFFERENT tournament it is a genuine conflict (400).
  const { data: existing } = await admin
    .from("umpires")
    .select("user_id, tournament_id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    if (existing.tournament_id === tournamentId) {
      return json({ error: "That email is already an umpire for this tournament" }, 409);
    }
    return json({ error: "That email already umpires another tournament" }, 400);
  }

  // Create the auth user (email confirmed so they can sign in immediately).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const newUser = created?.user ?? null;
  if (createErr || !newUser) {
    // A pre-existing auth account without an umpires row (e.g. a former
    // manager's email) cannot be silently re-bound — surface it.
    return json({ error: createErr?.message ?? "createUser failed" }, 400);
  }

  const { error: linkErr } = await admin.from("umpires").insert({
    user_id: newUser.id,
    tournament_id: tournamentId,
    email,
    must_change_password: true,
  });
  if (linkErr) {
    // Best-effort rollback: drop the user we just created so re-tries are clean.
    try {
      await admin.auth.admin.deleteUser(newUser.id);
    } catch {
      /* best-effort; report the original link error below */
    }
    return json({ error: linkErr.message }, 400);
  }

  return json({ ok: true, userId: newUser.id }, 200);
  } catch (e) {
    return json({ error: "internal", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
