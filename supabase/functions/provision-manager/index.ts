// Provision a Team Manager: create a Supabase Auth user (email + initial
// password), bound 1:1 to a team, with must_change_password=true.
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
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";
  if (!email || !password || !teamId) {
    return json({ error: "email, password and teamId are required" }, 400);
  }

  // Team must exist and not already have a manager (1:1). Read via the caller
  // (admin) client — is_admin() RLS already authorises these reads, and this
  // avoids relying on the service-role client for lookups.
  const { data: team } = await caller
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return json({ error: "Team not found" }, 404);
  const { data: existing } = await caller
    .from("team_managers")
    .select("user_id")
    .eq("team_id", teamId)
    .maybeSingle();
  if (existing) return json({ error: "That team already has a manager" }, 409);

  // Create the auth user (email confirmed so they can sign in immediately).
  // createUser() returns { data: { user }, error } — read data.user, not data.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  const newUser = created?.user ?? null;
  if (createErr || !newUser) {
    return json({ error: createErr?.message ?? "createUser failed" }, 400);
  }

  // Link the user to the team with the must-change flag set.
  const { error: linkErr } = await admin.from("team_managers").insert({
    user_id: newUser.id,
    team_id: teamId,
    email,
    must_change_password: true,
  });
  if (linkErr) {
    // Best-effort rollback: drop the user we just created so re-tries are clean.
    // Wrapped so a rollback failure can never mask the original link error.
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
