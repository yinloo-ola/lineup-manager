import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import { TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

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
