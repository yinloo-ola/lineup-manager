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

  // Service-role client (service_role is in env; bypasses RLS).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Authorise: the caller must be an admin. supabase-js forwards the user's
  // access token in the Authorization header when invoking functions.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  const callerEmail = user?.email;
  if (!callerEmail) return json({ error: "Unauthorized" }, 401);
  const { data: adminRow } = await admin
    .from("app_admins")
    .select("email")
    .eq("email", callerEmail)
    .maybeSingle();
  if (!adminRow) return json({ error: "Forbidden: administrators only" }, 403);

  // Validate input.
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";
  if (!email || !password || !teamId) {
    return json({ error: "email, password and teamId are required" }, 400);
  }

  // Team must exist and not already have a manager (1:1).
  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return json({ error: "Team not found" }, 404);
  const { data: existing } = await admin
    .from("team_managers")
    .select("user_id")
    .eq("team_id", teamId)
    .maybeSingle();
  if (existing) return json({ error: "That team already has a manager" }, 409);

  // Create the auth user (email confirmed so they can sign in immediately).
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !newUser) return json({ error: createErr?.message ?? "createUser failed" }, 400);

  // Link the user to the team with the must-change flag set.
  const { error: linkErr } = await admin.from("team_managers").insert({
    user_id: newUser.id,
    team_id: teamId,
    email,
    must_change_password: true,
  });
  if (linkErr) {
    // Best-effort rollback: drop the user we just created so re-tries are clean.
    await admin.auth.admin.deleteUser(newUser.id);
    return json({ error: linkErr.message }, 400);
  }

  return json({ ok: true, userId: newUser.id }, 200);
});
