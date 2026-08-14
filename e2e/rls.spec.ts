import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_MANAGER2_EMAIL,
  TEST_MANAGER2_NEW_PASSWORD
} from './global-setup'

// Opponent isolation: a manager must never read another team's lineup. The
// lineups SELECT policy is `team_id = manager_team_id()`, so Bravo's manager
// sees only Bravo's rows — even though Alpha has a submitted lineup in the DB.

test("managers cannot read opponents' lineups (RLS isolation)", async ({ request }) => {
  const token = await apiToken(request, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)
  const headers = authHeaders(token)

  // Alpha has a submitted lineup (pre-created in global-setup). Bravo (manager2)
  // must see ZERO rows when querying Alpha's lineups.
  const opponent = await request.get(`${supabaseUrl}/rest/v1/lineups?team_id=eq.e2e-a&select=tie_id`, {
    headers
  })
  expect(await opponent.json()).toEqual([])

  // Sanity: Bravo sees its own lineups (at least the pre-created ones).
  const own = await request.get(`${supabaseUrl}/rest/v1/lineups?team_id=eq.e2e-b&select=tie_id`, {
    headers
  })
  const ownRows = (await own.json()) as { tie_id: string }[]
  expect(ownRows.length).toBeGreaterThan(0)
})

// Ticket #16 (contract): a manager's lineup write must stamp the tie's ACTUAL
// tournament — otherwise a phantom (own tie, own team, foreign tournament) row
// could hide from every tournament-scoped view.
test("manager cannot write a lineup stamped with a foreign tournament", async ({ request }) => {
  const token = await apiToken(request, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)
  const res = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
    headers: authHeaders(token),
    data: {
      tournament_id: 'e2e-tour-other',
      tie_id: 'e2e-tie',
      team_id: 'e2e-b',
      player_ids: [['e2e-p3']],
      status: 'draft'
    }
  })
  expect(res.ok()).toBeFalsy()
})

// Tournament access is admin-only (Ticket #12): the Administrator can read and write
// tournaments; a team manager can do neither.
const TOUR_ID = 'e2e-tour-rls'

test('admin can read and write tournaments; managers cannot (RLS)', async ({ request }) => {
  const adminToken = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  const managerToken = await apiToken(request, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)

  // Admin can create a tournament (idempotent so the spec is re-runnable).
  const insert = await request.post(`${supabaseUrl}/rest/v1/tournaments`, {
    headers: { ...authHeaders(adminToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    data: { id: TOUR_ID, name: 'E2E RLS Tournament' }
  })
  expect(insert.ok()).toBeTruthy()

  // Admin can read it back.
  const adminRead = await request.get(`${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}&select=id`, {
    headers: authHeaders(adminToken)
  })
  expect((await adminRead.json()).length).toBe(1)

  // A manager cannot read tournaments (admin-only RLS → zero rows, not an error).
  const managerRead = await request.get(
    `${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}&select=id`,
    { headers: authHeaders(managerToken) }
  )
  expect(await managerRead.json()).toEqual([])

  // A manager cannot create a tournament (RLS with-check rejects the insert).
  const managerInsert = await request.post(`${supabaseUrl}/rest/v1/tournaments`, {
    headers: authHeaders(managerToken),
    data: { id: `${TOUR_ID}-deny`, name: 'Should Not Exist' }
  })
  expect(managerInsert.ok()).toBeFalsy()

  // Assert no row was created (robust to status-code differences — proves the denial).
  const denyCheck = await request.get(
    `${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}-deny&select=id`,
    { headers: authHeaders(adminToken) }
  )
  expect(await denyCheck.json()).toEqual([])
})
