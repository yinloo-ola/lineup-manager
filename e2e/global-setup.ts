// E2E fixture setup against the local Supabase stack.
//
// Creates the test administrator and a full fixture (category, two teams, a
// roster, a future tie, a Tie Format), then provisions a Team Manager via the
// REAL provision-manager edge function — exercising the actual provisioning
// path (service_role lives inside the function, never in test code).
//
// CI runs against a fresh stack each time. For local re-runs, reset first:
//   supabase db reset && npm run test:e2e

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

export const TEST_ADMIN_EMAIL = 'admin@lineup.local'
export const TEST_ADMIN_PASSWORD = 'admin-password-123'
export const TEST_MANAGER_EMAIL = 'manager@lineup.local'
export const TEST_MANAGER_PASSWORD = 'manager-password-123'
export const TEST_MANAGER_NEW_PASSWORD = 'manager-new-pw-123'

// A second manager on team Bravo (e2e-b), independent of the first so the lineup
// builder e2e is decoupled from manager.spec's destructive first-login password change.
export const TEST_MANAGER2_EMAIL = 'manager2@lineup.local'
export const TEST_MANAGER2_PASSWORD = 'manager2-password-123'
export const TEST_MANAGER2_NEW_PASSWORD = 'manager2-new-pw-123'

function jsonHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anonKey
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

async function signUpIfAbsent(email: string, password: string): Promise<void> {
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: jsonHeaders(anonKey),
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const body = await res.text()
    if (!/already|exists|registered/i.test(body)) {
      throw new Error(`signup ${email} failed (${res.status}): ${body}`)
    }
  }
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(`sign in ${email} failed (${res.status}): ${await res.text()}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

async function restUpsert(token: string, table: string, rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...jsonHeaders(token), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  })
  if (!res.ok && res.status !== 409) {
    throw new Error(`upsert ${table} failed (${res.status}): ${await res.text()}`)
  }
}

export default async function globalSetup(): Promise<void> {
  // 1. Administrator (idempotent).
  await signUpIfAbsent(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  const adminToken = await signIn(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)

  // 2. Fixture structure (admin can write via the is_admin() RLS policies).
  await restUpsert(adminToken, 'categories', [
    { id: 'e2e-cat', name: "E2E Men's Team", short_name: 'EMT' }
  ])
  await restUpsert(adminToken, 'teams', [
    { id: 'e2e-a', name: 'Alpha' },
    { id: 'e2e-b', name: 'Bravo' },
    // Opponent for Bravo's past-cutoff tie (Ticket 7 server-side enforcement test).
    { id: 'e2e-c', name: 'Charlie' }
  ])
  await restUpsert(adminToken, 'players', [
    { id: 'e2e-p1', team_id: 'e2e-a', name: 'Alice', gender: 'F', date_of_birth: '1990-01-01' },
    { id: 'e2e-p2', team_id: 'e2e-a', name: 'Alan', gender: 'M', date_of_birth: '1985-01-01' },
    { id: 'e2e-p3', team_id: 'e2e-b', name: 'Bob', gender: 'M', date_of_birth: '1988-01-01' },
    // A women's player on Bravo so the lineup builder e2e has an illegal (gender) pick to attempt.
    { id: 'e2e-p4', team_id: 'e2e-b', name: 'Barbara', gender: 'F', date_of_birth: '1992-01-01' }
  ])
  // A tie in the far future so its cutoff is not yet reached.
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie',
      category_id: 'e2e-cat',
      scheduled_start: '2099-01-01T10:00:00+00:00',
      table_label: '1',
      team_a: 'e2e-a',
      team_b: 'e2e-b'
    }
  ])
  // A tie in the past so its cutoff has passed (Bravo vs Charlie). Used by the
  // Ticket 7 server-side cutoff test: manager writes here must be refused.
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie-past',
      category_id: 'e2e-cat',
      scheduled_start: '2000-01-01T10:00:00+00:00',
      table_label: '2',
      team_a: 'e2e-b',
      team_b: 'e2e-c'
    }
  ])
  // A second past-cutoff tie (Bravo vs Charlie), touched ONLY by the Ticket 8
  // admin-overwrite spec. Distinct time slot from e2e-tie-past so the two specs
  // never field the same player in a shared slot (which would be a real clash).
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie-past2',
      category_id: 'e2e-cat',
      scheduled_start: '2000-06-01T10:00:00+00:00',
      table_label: '3',
      team_a: 'e2e-b',
      team_b: 'e2e-c'
    }
  ])
  await restUpsert(adminToken, 'tie_formats', [
    {
      category_id: 'e2e-cat',
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }],
      usage_policy: null,
      lead_time_minutes: 30
    }
  ])

  // A pre-existing submitted lineup (Alpha) so the admin dashboard reliably has
  // a row to show regardless of parallel spec timing.
  await restUpsert(adminToken, 'lineups', [
    {
      tie_id: 'e2e-tie',
      team_id: 'e2e-a',
      player_ids: [['e2e-p2']],
      status: 'submitted',
      submitted_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    }
  ])

  // 3. Provision the managers via the real edge function (Alpha + Bravo).
  await provisionManager(adminToken, TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD, 'e2e-a')
  await provisionManager(adminToken, TEST_MANAGER2_EMAIL, TEST_MANAGER2_PASSWORD, 'e2e-b')

  // 4. Complete manager2's first-login password change now, so the lineup builder
  // e2e can sign straight in to /manager. This decouples it from manager.spec's
  // destructive forced-change flow (and from retry-after-password-change).
  await completeFirstLogin(TEST_MANAGER2_EMAIL, TEST_MANAGER2_PASSWORD, TEST_MANAGER2_NEW_PASSWORD)
}

/** Set a manager's own password and clear the must-change flag (mirrors the app flow). */
async function completeFirstLogin(
  email: string,
  tempPassword: string,
  newPassword: string
): Promise<void> {
  const token = await signIn(email, tempPassword)
  const upd = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ password: newPassword })
  })
  if (!upd.ok) {
    throw new Error(`change ${email} password failed (${upd.status}): ${await upd.text()}`)
  }
  const clr = await fetch(`${url}/rest/v1/rpc/clear_must_change_password`, {
    method: 'POST',
    headers: jsonHeaders(token)
  })
  if (!clr.ok) {
    throw new Error(`clear ${email} must-change failed (${clr.status}): ${await clr.text()}`)
  }
}

async function provisionManager(
  token: string,
  email: string,
  password: string,
  teamId: string
): Promise<void> {
  const res = await fetch(`${url}/functions/v1/provision-manager`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ email, password, teamId })
  })
  if (!res.ok) {
    const body = await res.text()
    // The only legit idempotent outcome is 409 "team already has a manager"
    // (a prior provision on a re-used local stack). Anything else is a real
    // failure — do NOT swallow it (a broad regex masked createUser errors here).
    if (res.status !== 409) {
      throw new Error(`provision ${email} failed (${res.status}): ${body}`)
    }
  }
  // Verify the manager can actually authenticate — surfaces createUser / link
  // failures with a clear message instead of an opaque "stayed on /login" later.
  const verify = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password })
  })
  if (!verify.ok) {
    throw new Error(`verify ${email} sign-in failed (${verify.status}): ${await verify.text()}`)
  }
}
