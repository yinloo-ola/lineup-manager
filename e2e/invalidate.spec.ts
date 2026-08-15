import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, signInManager, supabaseUrl } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_MANAGER2_EMAIL,
  TEST_MANAGER2_NEW_PASSWORD
} from './global-setup'

// Ticket 9: when an admin tightens a Constraint after a lineup is submitted,
// the lineup is re-validated and shown as `invalidated` (data retained). Uses an
// isolated category (e2e-cat-inv) so tightening it cannot affect other specs.

test('admin tightens a constraint → submitted lineup invalidated → manager sees it', async ({
  page,
  request
}) => {
  // 1. Admin tightens e2e-cat-inv: add ageMin 40. Bob (b. 1988 → 38 on 2026-12-01)
  //    is now too young, so Bravo's submitted lineup becomes invalid.
  const token = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  const tighten = await request.post(`${supabaseUrl}/rest/v1/tie_formats`, {
    headers: { ...authHeaders(token), Prefer: 'resolution=merge-duplicates,return=minimal' },
    data: {
      tournament_id: 'default',
      category_id: 'e2e-cat-inv',
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'], ageMin: 40 } }],
      usage_policy: null,
      lead_time_minutes: 30
    }
  })
  expect(tighten.ok()).toBeTruthy()

  // 2. The manager opens the affected tie and sees the invalidated signal.
  await signInManager(page, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)
  await page.goto('/manager/tie/e2e-tie-inv')
  // Exact-match the status chip (the alert below it also says "Needs attention —").
  await expect(page.getByText('Needs attention', { exact: true })).toBeVisible()
  // The lineup data is retained (Bob is still assigned) but flagged ineligible by age.
  await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
  await expect(page.getByText(/requires age min/i)).toBeVisible()
})
