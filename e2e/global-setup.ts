// E2E fixture setup against the local Supabase stack.
//
// Creates the test administrator and a full fixture (category, two teams, a
// roster, a future tie, a Tie Format), then provisions a Team Manager via the
// REAL provision-manager edge function — exercising the actual provisioning
// path (service_role lives inside the function, never in test code).
//
// CI runs against a fresh stack each time. Local re-runs need no db reset: the
// setup converges state (upserts by id, manager first-login states reset or
// completed) so the suite is re-runnable against a used stack.

import { supabaseUrl as url, supabaseAnonKey as anonKey } from './helpers'


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

// A third manager on KO team e2e-ka, for the knockout RLS spec (null-side
// invisibility, visibility on landing, and the tightened lineup membership).
export const TEST_MANAGER3_EMAIL = 'manager3@lineup.local'
export const TEST_MANAGER3_PASSWORD = 'manager3-password-123'
export const TEST_MANAGER3_NEW_PASSWORD = 'manager3-new-pw-123'

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
  // Every fixture row is scoped to the "default" tournament explicitly — the
  // app is tournament-aware now, so the seed-style fixture must carry the
  // dimension too (a fresh stack has no migration-time data for 0009's backfill
  // to catch, so without this the fixtures would be unscoped and invisible to
  // the admin's tournament-scoped views).
  const DEFAULT_TOUR = 'default'
  await restUpsert(adminToken, 'tournaments', [{ id: DEFAULT_TOUR, name: 'Default' }])
  await restUpsert(adminToken, 'categories', [
    { id: 'e2e-cat', tournament_id: DEFAULT_TOUR, name: "E2E Men's Team", short_name: 'EMT' },
    // Isolated category for the Ticket 9 invalidation e2e (its own format/tie so
    // tightening it cannot affect the other specs' lineups in e2e-cat).
    { id: 'e2e-cat-inv', tournament_id: DEFAULT_TOUR, name: 'E2E Invalidation', short_name: 'EI' },
    // Isolated knockout categories (ko-import #15): one owned by the bracket
    // UI lifecycle spec, one by the RLS spec — never shared, so parallel specs
    // never race on the same rows.
    { id: 'e2e-cat-ko', tournament_id: DEFAULT_TOUR, name: 'E2E Knockout', short_name: 'EK' },
    { id: 'e2e-cat-ko-rls', tournament_id: DEFAULT_TOUR, name: 'E2E Knockout RLS', short_name: 'EKR' }
  ])
  await restUpsert(adminToken, 'teams', [
    { id: 'e2e-a', tournament_id: DEFAULT_TOUR, name: 'Alpha' },
    { id: 'e2e-b', tournament_id: DEFAULT_TOUR, name: 'Bravo' },
    // Opponent for Bravo's past-cutoff tie (Ticket 7 server-side enforcement test).
    { id: 'e2e-c', tournament_id: DEFAULT_TOUR, name: 'Charlie' },
    // Knockout fixture teams (6 qualifiers, draw of 8 — the spec's worked example).
    { id: 'e2e-ka', tournament_id: DEFAULT_TOUR, name: 'Kilo' },
    { id: 'e2e-kb', tournament_id: DEFAULT_TOUR, name: 'Lima' },
    { id: 'e2e-kc', tournament_id: DEFAULT_TOUR, name: 'Mike' },
    { id: 'e2e-kd', tournament_id: DEFAULT_TOUR, name: 'November' },
    { id: 'e2e-ke', tournament_id: DEFAULT_TOUR, name: 'Oscar' },
    { id: 'e2e-kf', tournament_id: DEFAULT_TOUR, name: 'Papa' }
  ])
  await restUpsert(adminToken, 'players', [
    { id: 'e2e-p1', tournament_id: DEFAULT_TOUR, team_id: 'e2e-a', name: 'Alice', gender: 'F', date_of_birth: '1990-01-01' },
    { id: 'e2e-p2', tournament_id: DEFAULT_TOUR, team_id: 'e2e-a', name: 'Alan', gender: 'M', date_of_birth: '1985-01-01' },
    { id: 'e2e-p3', tournament_id: DEFAULT_TOUR, team_id: 'e2e-b', name: 'Bob', gender: 'M', date_of_birth: '1988-01-01' },
    // A women's player on Bravo so the lineup builder e2e has an illegal (gender) pick to attempt.
    { id: 'e2e-p4', tournament_id: DEFAULT_TOUR, team_id: 'e2e-b', name: 'Barbara', gender: 'F', date_of_birth: '1992-01-01' }
  ])
  // A tie in the far future so its cutoff is not yet reached.
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie',
      tournament_id: DEFAULT_TOUR,
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
      tournament_id: DEFAULT_TOUR,
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
      tournament_id: DEFAULT_TOUR,
      category_id: 'e2e-cat',
      scheduled_start: '2000-06-01T10:00:00+00:00',
      table_label: '3',
      team_a: 'e2e-b',
      team_b: 'e2e-c'
    }
  ])
  // A future tie in the isolated invalidation category (Bravo vs Charlie). Bob
  // (b. 1988) is 38 on 2026-12-01 — eligible for plain men's singles, but not
  // once the admin tightens it to ageMin 40.
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie-inv',
      tournament_id: DEFAULT_TOUR,
      category_id: 'e2e-cat-inv',
      scheduled_start: '2026-12-01T10:00:00+00:00',
      table_label: '4',
      team_a: 'e2e-b',
      team_b: 'e2e-c'
    }
  ])
  // A future tie reserved for the cutoff spec's POSITIVE control (manager write
  // must succeed before the cutoff). Distinct from e2e-tie (lineup.spec deletes
  // and rewrites that row) and from e2e-tie-inv, so parallel specs never race
  // on the same (tie, team) row; own time slot so cross-slot double-booking
  // validation can't couple it to the other fixtures.
  await restUpsert(adminToken, 'ties', [
    {
      id: 'e2e-tie-cut',
      tournament_id: DEFAULT_TOUR,
      category_id: 'e2e-cat',
      scheduled_start: '2099-02-01T10:00:00+00:00',
      table_label: '5',
      team_a: 'e2e-b',
      team_b: 'e2e-c'
    }
  ])
  await restUpsert(adminToken, 'tie_formats', [
    {
      category_id: 'e2e-cat',
      tournament_id: DEFAULT_TOUR,
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }],
      usage_policy: null,
      lead_time_minutes: 30
    },
    {
      category_id: 'e2e-cat-inv',
      tournament_id: DEFAULT_TOUR,
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }],
      usage_policy: null,
      lead_time_minutes: 30
    }
  ])

  // Knockout brackets (ko-import #15). Group ties put the six teams in the
  // knockout categories (team entry derives its options from group membership);
  // then each category's draw of 8: four entry slots (unscheduled, empty), two
  // pool matches (scheduled, unplaced), and fed SF/F rows. The lifecycle spec
  // RESETS its rows to this pristine shape before each run (it mutates them);
  // the RLS category's rows are only ever PATCHed onto e2e-ka and re-converged
  // here by the same upserts.
  await restUpsert(adminToken, 'ties', [
    // PostgREST batches need uniform keys — every row below carries the full
    // tie column set (explicit nulls) so one POST covers groups + slots + pool.
    { id: 'e2e-ko-g1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-01T10:00:00+00:00', table_label: null, group_label: 'A', round_label: 'Round 1', team_a: 'e2e-ka', team_b: 'e2e-kb', fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: false, bracket_slot: null },
    { id: 'e2e-ko-g2', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-01T11:00:00+00:00', table_label: null, group_label: 'B', round_label: 'Round 1', team_a: 'e2e-kc', team_b: 'e2e-kd', fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: false, bracket_slot: null },
    { id: 'e2e-ko-g3', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-01T12:00:00+00:00', table_label: null, group_label: 'C', round_label: 'Round 1', team_a: 'e2e-ke', team_b: 'e2e-kf', fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: false, bracket_slot: null },
    { id: 'e2e-ko-qf1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: null, table_label: null, group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 1 },
    { id: 'e2e-ko-qf2', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: null, table_label: null, group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 2 },
    { id: 'e2e-ko-qf3', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: null, table_label: null, group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 3 },
    { id: 'e2e-ko-qf4', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: null, table_label: null, group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 4 },
    { id: 'e2e-ko-p1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-02T14:00:00+00:00', table_label: 'T2', group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: null },
    { id: 'e2e-ko-p2', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-02T14:00:00+00:00', table_label: 'T3', group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: null },
    { id: 'e2e-ko-sf1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-02T16:00:00+00:00', table_label: 'T2', group_label: null, round_label: 'SF', team_a: null, team_b: null, fed_by_a: 'e2e-ko-qf1', fed_by_b: 'e2e-ko-qf2', winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 1 },
    { id: 'e2e-ko-sf2', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-02T16:00:00+00:00', table_label: 'T3', group_label: null, round_label: 'SF', team_a: null, team_b: null, fed_by_a: 'e2e-ko-qf3', fed_by_b: 'e2e-ko-qf4', winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 2 },
    { id: 'e2e-ko-f1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko', scheduled_start: '2098-01-02T18:00:00+00:00', table_label: 'T1', group_label: null, round_label: 'F', team_a: null, team_b: null, fed_by_a: 'e2e-ko-sf1', fed_by_b: 'e2e-ko-sf2', winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: 1 },
    { id: 'e2e-korls-g1', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko-rls', scheduled_start: '2098-01-01T10:00:00+00:00', table_label: null, group_label: 'A', round_label: 'Round 1', team_a: 'e2e-ka', team_b: 'e2e-kb', fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: false, bracket_slot: null },
    { id: 'e2e-korls-slot', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko-rls', scheduled_start: null, table_label: null, group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: null },
    { id: 'e2e-korls-pool', tournament_id: DEFAULT_TOUR, category_id: 'e2e-cat-ko-rls', scheduled_start: '2098-01-02T14:00:00+00:00', table_label: 'T9', group_label: null, round_label: 'QF', team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, winner_side: null, placed_match_id: null, is_knockout: true, bracket_slot: null }
  ])
  await restUpsert(adminToken, 'tie_formats', [
    { category_id: 'e2e-cat-ko', tournament_id: DEFAULT_TOUR, rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }], usage_policy: null, lead_time_minutes: 30 },
    { category_id: 'e2e-cat-ko-rls', tournament_id: DEFAULT_TOUR, rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }], usage_policy: null, lead_time_minutes: 30 }
  ])

  // A pre-existing submitted lineup (Alpha) so the admin dashboard reliably has
  // a row to show regardless of parallel spec timing.
  await restUpsert(adminToken, 'lineups', [
    {
      tie_id: 'e2e-tie',
      tournament_id: DEFAULT_TOUR,
      team_id: 'e2e-a',
      player_ids: [['e2e-p2']],
      status: 'submitted',
      submitted_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    }
  ])
  // A pre-existing SUBMITTED Bravo lineup on the isolated invalidation tie (Bob).
  // The Ticket 9 e2e tightens the category's format and expects this to invalidate.
  await restUpsert(adminToken, 'lineups', [
    {
      tie_id: 'e2e-tie-inv',
      tournament_id: DEFAULT_TOUR,
      team_id: 'e2e-b',
      player_ids: [['e2e-p3']],
      status: 'submitted',
      submitted_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    }
  ])

  // 3. Provision the managers via the real edge function (Alpha + Bravo).
  await provisionManager(adminToken, TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD, 'e2e-a')
  await provisionManager(adminToken, TEST_MANAGER2_EMAIL, TEST_MANAGER2_PASSWORD, 'e2e-b')
  await provisionManager(adminToken, TEST_MANAGER3_EMAIL, TEST_MANAGER3_PASSWORD, 'e2e-ka')

  // 3b. Converge manager1 back to the forced-first-login state. manager.spec is
  // destructive — it COMPLETES the password change — so a re-run without a db
  // reset would otherwise find the temp password consumed and fail at sign-in.
  // This restores must_change_password and the temp password, making every run
  // exercise the same forced-change flow.
  await resetFirstLogin(adminToken, TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD, TEST_MANAGER_NEW_PASSWORD)

  // 4. Complete manager2's first-login password change now, so the lineup builder
  // e2e can sign straight in to /manager. This decouples it from manager.spec's
  // destructive forced-change flow (and from retry-after-password-change).
  await completeFirstLogin(TEST_MANAGER2_EMAIL, TEST_MANAGER2_PASSWORD, TEST_MANAGER2_NEW_PASSWORD)
  // And manager3 likewise, for the knockout RLS spec.
  await completeFirstLogin(TEST_MANAGER3_EMAIL, TEST_MANAGER3_PASSWORD, TEST_MANAGER3_NEW_PASSWORD)
}

/**
 * Set a manager's own password and clear the must-change flag (mirrors the app
 * flow). Idempotent: a prior successful run already switched to `newPassword`,
 * so we just re-assert the cleared flag; otherwise sign in with the temp password
 * and switch. This keeps `npm run test:e2e` re-runnable without a `db reset`.
 */
async function completeFirstLogin(
  email: string,
  tempPassword: string,
  newPassword: string
): Promise<void> {
  // Already completed by a prior run? Re-assert the flag (covers a prior run
  // that set the password but died before clearing it) and return — do NOT sign
  // in with tempPassword, which no longer works once the change has happened.
  const existing = await signInOrNull(email, newPassword)
  if (existing) {
    await fetch(`${url}/rest/v1/rpc/clear_must_change_password`, {
      method: 'POST',
      headers: jsonHeaders(existing)
    })
    return
  }
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

/** Sign in, returning the access token, or null if the credentials don't match. */
async function signInOrNull(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

/**
 * Converge a manager to the forced-first-login state (temp password +
 * must_change_password=true) so the destructive manager.spec can run the
 * forced-change flow afresh on every run. Idempotent: on a fresh stack the
 * temp password already works; after a prior run consumed it, sign in with the
 * new password and set it back to the temp one (the user may change their own
 * password; secure_password_change is off locally). The flag is re-asserted
 * via an admin PATCH either way, covering a prior run that changed the
 * password but died before the app cleared it.
 */
async function resetFirstLogin(
  adminToken: string,
  email: string,
  tempPassword: string,
  newPassword: string
): Promise<void> {
  const flag = await fetch(`${url}/rest/v1/team_managers?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { ...jsonHeaders(adminToken), Prefer: 'return=minimal' },
    body: JSON.stringify({ must_change_password: true })
  })
  if (!flag.ok) {
    throw new Error(`reset ${email} must-change flag failed (${flag.status}): ${await flag.text()}`)
  }
  if (await signInOrNull(email, tempPassword)) return // already converged
  const token = await signIn(email, newPassword)
  const upd = await fetch(`${url}/auth/v1/user`, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify({ password: tempPassword })
  })
  if (!upd.ok) {
    throw new Error(`reset ${email} password failed (${upd.status}): ${await upd.text()}`)
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
    // Already provisioned on a re-used stack: the user exists and may already
    // have completed the first-login password change, so the temp `password` no
    // longer applies. Only a fresh create (below) needs verifying — that is the
    // only path createUser can silently fail on. completeFirstLogin converges an
    // already-provisioned manager to the ready state regardless of its password.
    return
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
