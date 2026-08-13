import { test, expect } from '@playwright/test'
import { TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

// Opponent isolation: a manager must never read another team's lineup. The
// lineups SELECT policy is `team_id = manager_team_id()`, so Bravo's manager
// sees only Bravo's rows — even though Alpha has a submitted lineup in the DB.

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

test("managers cannot read opponents' lineups (RLS isolation)", async ({ request }) => {
  const signIn = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    data: { email: TEST_MANAGER2_EMAIL, password: TEST_MANAGER2_NEW_PASSWORD }
  })
  expect(signIn.ok()).toBeTruthy()
  const { access_token } = (await signIn.json()) as { access_token: string }
  const headers = { apikey: anonKey, Authorization: `Bearer ${access_token}` }

  // Alpha has a submitted lineup (pre-created in global-setup). Bravo (manager2)
  // must see ZERO rows when querying Alpha's lineups.
  const opponent = await request.get(`${url}/rest/v1/lineups?team_id=eq.e2e-a&select=tie_id`, {
    headers
  })
  expect(await opponent.json()).toEqual([])

  // Sanity: Bravo sees its own lineups (at least the pre-created ones).
  const own = await request.get(`${url}/rest/v1/lineups?team_id=eq.e2e-b&select=tie_id`, {
    headers
  })
  const ownRows = (await own.json()) as { tie_id: string }[]
  expect(ownRows.length).toBeGreaterThan(0)
})
