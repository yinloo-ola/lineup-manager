import { test, expect } from '@playwright/test'
import { apiToken, deleteLineup } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// Ticket 8: the administrator oversight surface. The admin sees every team's
// lineups, can open any lineup (including a locked/post-cutoff tie), and
// overwrites it through the SAME validated builder a manager uses.

test.describe('administrator dashboard + overwrite', () => {
  test.beforeAll(async ({ request }) => {
    // Start from a fresh builder on the post-cutoff tie so the spec is
    // re-runnable without `db reset`: a prior run leaves a draft here, which
    // changes how the builder renders and hides the "Add player" field.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    await deleteLineup(request, admin, 'e2e-tie-past2', 'e2e-b')
  })

  test('lists lineups; admin edits a post-cutoff lineup via the same rules', async ({ page }) => {
    // Sign in as the administrator (no forced password change).
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    // Setup-aware landing: a tournament exists → the Matches area.
    await expect(page).toHaveURL(/\/matches$/)
    await expect(page.getByText('Matches').first()).toBeVisible()

    // The fixture table lists one row per team match (the pre-created Alpha
    // lineup guarantees a Submitted chip in Alpha's row).
    await page.goto('/admin/lineups')
    await expect(page.getByText('Alpha').first()).toBeVisible()
    await expect(page.getByText('Submitted').first()).toBeVisible()

    // Open the isolated post-cutoff tie as an administrator (on behalf of Bravo).
    await page.goto('/manager/tie/e2e-tie-past2?team=e2e-b')
    await expect(page.getByText(/Match 1/)).toBeVisible()
    // The cutoff has passed, but the admin may still edit.
    await expect(page.getByText(/Editing as administrator/i)).toBeVisible()

    // Same validation rules as managers: an illegal pick (Barbara, women's) is refused.
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Barbara (F)' }).click()
    await expect(page.getByText(/gender/i)).toBeVisible()
    await expect(page.locator('.v-chip', { hasText: 'Barbara (F)' })).toHaveCount(0)

    // Legal pick (Bob) + save — an overwrite AFTER the cutoff (a manager could not).
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Bob (M)' }).click()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Draft saved.')).toBeVisible()

    // Reload — the admin's overwrite persists.
    await page.reload()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
  })
})
