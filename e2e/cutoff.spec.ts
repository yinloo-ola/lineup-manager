import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_MANAGER2_EMAIL,
  TEST_MANAGER2_NEW_PASSWORD
} from './global-setup'

// Verifies the SERVER-SIDE cutoff enforcement from migration 0007: a client
// clock can be bypassed, so the database itself must refuse manager writes at/after
// the cutoff. Uses the Bravo manager's REST token (no browser) against the past
// tie (e2e-tie-past), whose cutoff has long passed.

// Upsert (merge-duplicates) so this spec is re-runnable without `db reset`: a
// prior run leaves a row at the (tie, team) PK, and a plain INSERT would 409 on
// lineups_pkey — making the admin test fail and the manager test pass for the
// wrong reason. A manager upsert on a locked tie is still refused (0007 gates
// the UPDATE WITH CHECK on `not tie_locked` too), so both tests exercise cutoff
// enforcement, not a PK accident.
const upsertHeaders = (token: string): Record<string, string> => ({
  ...authHeaders(token),
  Prefer: 'resolution=merge-duplicates,return=minimal'
})

test('server refuses manager lineup writes at/after the cutoff', async ({ request }) => {
  const token = await apiToken(request, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)

  // Write to the past tie (cutoff passed): the RLS WITH CHECK (not tie_locked)
  // must refuse this on the server, regardless of any client clock.
  const res = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
    headers: upsertHeaders(token),
    data: { tie_id: 'e2e-tie-past', team_id: 'e2e-b', player_ids: [['e2e-p3']], status: 'draft' }
  })
  expect(res.ok()).toBeFalsy()
})

test('admin may still edit after the cutoff (no-reopen: admin-only)', async ({ request }) => {
  // The other half of no-reopen: managers are blocked, but admins keep access.
  const token = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)

  const res = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
    headers: upsertHeaders(token),
    data: { tie_id: 'e2e-tie-past', team_id: 'e2e-b', player_ids: [['e2e-p3']], status: 'submitted' }
  })
  expect(res.ok()).toBeTruthy()

  // Edits are attributed: the 0008 trigger stamps updated_by from the editor's JWT.
  const got = await request.get(
    `${supabaseUrl}/rest/v1/lineups?tie_id=eq.e2e-tie-past&team_id=eq.e2e-b&select=updated_by`,
    { headers: authHeaders(token) }
  )
  const rows = (await got.json()) as { updated_by: string | null }[]
  expect(rows[0]?.updated_by).toBe(TEST_ADMIN_EMAIL)
})
