import { test, expect } from '@playwright/test'
import { signInManager } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_MANAGER2_EMAIL,
  TEST_MANAGER2_NEW_PASSWORD
} from './global-setup'

// Ticket 9: when an admin tightens a Constraint after a lineup is submitted,
// the lineup is re-validated and shown as `invalidated` (data retained). Uses an
// isolated category (e2e-cat-inv) so tightening it cannot affect other specs.

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

test('admin tightens a constraint → submitted lineup invalidated → manager sees it', async ({
  page,
  request
}) => {
  // 1. Admin tightens e2e-cat-inv: add ageMin 40. Bob (b. 1988 → 38 on 2026-12-01)
  //    is now too young, so Bravo's submitted lineup becomes invalid.
  const signIn = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }
  })
  expect(signIn.ok()).toBeTruthy()
  const { access_token } = (await signIn.json()) as { access_token: string }
  const tighten = await request.post(`${url}/rest/v1/tie_formats`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    data: {
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
  await expect(page.getByText(/action needed/i)).toBeVisible()
  // The lineup data is retained (Bob is still assigned) but flagged ineligible by age.
  await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
  await expect(page.getByText(/requires age min/i)).toBeVisible()
})
