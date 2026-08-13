import { test, expect } from '@playwright/test'
import { TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

// Verifies the SERVER-SIDE cutoff enforcement from migration 0007: a client
// clock can be bypassed, so the database itself must refuse manager writes at/after
// the cutoff. Uses the Bravo manager's REST token (no browser) against the past
// tie (e2e-tie-past), whose cutoff has long passed.

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

test('server refuses manager lineup writes at/after the cutoff', async ({ request }) => {
  // Sign in as the Bravo manager.
  const signIn = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    data: { email: TEST_MANAGER2_EMAIL, password: TEST_MANAGER2_NEW_PASSWORD }
  })
  expect(signIn.ok()).toBeTruthy()
  const { access_token } = (await signIn.json()) as { access_token: string }
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${access_token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  }

  // Write to the past tie (cutoff passed): the RLS WITH CHECK (not tie_locked)
  // must refuse this on the server, regardless of any client clock.
  const res = await request.post(`${url}/rest/v1/lineups`, {
    headers,
    data: { tie_id: 'e2e-tie-past', team_id: 'e2e-b', player_ids: [['e2e-p3']], status: 'draft' }
  })
  expect(res.ok()).toBeFalsy()
})
