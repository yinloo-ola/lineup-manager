import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

// Ticket #13: the app is tournament-aware. The administrator switches tournament from
// a dropdown and every admin view re-scopes; a team manager sees only their own
// tournament (RLS) with no selector.

const OTHER_TOUR = 'e2e-tour-other'

test.describe('multi-tournament', () => {
  test.beforeAll(async ({ request }) => {
    // A second tournament so the admin selector appears (>1) and switching is exercised.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    await request.post(`${supabaseUrl}/rest/v1/tournaments`, {
      headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates,return=minimal' },
      data: { id: OTHER_TOUR, name: 'E2E Other' }
    })
  })

  test('admin switches tournament and the lineups view re-scopes', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/admin/lineups')
    // "Default" holds the global-setup fixture (Alpha has a submitted lineup).
    await expect(page.getByText('Alpha').first()).toBeVisible()

    // Switch to the other tournament — its lineups view re-scopes to empty.
    await page.getByLabel('Tournament').click({ force: true })
    await page.getByRole('option', { name: 'E2E Other' }).click()
    await expect(page.getByText('No lineups saved yet.')).toBeVisible()
    await expect(page.getByText('Alpha')).toHaveCount(0)
  })

  test('a manager reads only their own tournament (RLS, no selector)', async ({ request }) => {
    const manager = await apiToken(request, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)
    // Manager2 (Bravo, in "Default") sees exactly one tournament — their own — never "E2E Other".
    const res = await request.get(`${supabaseUrl}/rest/v1/tournaments?select=id,name&order=name`, {
      headers: authHeaders(manager)
    })
    const rows = (await res.json()) as { id: string; name: string }[]
    expect(rows.map((r) => r.id)).toEqual(['default'])
  })
})
