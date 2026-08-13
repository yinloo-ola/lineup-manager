import { test, expect } from '@playwright/test'
import { signInManager } from './helpers'
import { TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

// Exercises the lineup builder end-to-end as the Bravo manager (own roster only,
// via RLS). Uses a dedicated second manager whose password is pre-set in
// global-setup, so it is decoupled from manager.spec's forced-change flow.

test.describe('lineup builder', () => {
  test('build a legal lineup; illegal pick refused; draft persists', async ({ page }) => {
    await signInManager(page, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)

    // Own roster visible; opponent's (Alpha) roster hidden by RLS.
    await expect(page.getByText('Bob').first()).toBeVisible()
    await expect(page.getByText('Barbara').first()).toBeVisible()
    await expect(page.getByText('Alice')).toHaveCount(0)

    // Open the tie's lineup builder.
    await expect(page.getByText(/vs Alpha/)).toBeVisible()
    await page.getByRole('button', { name: /build lineup/i }).click()
    await expect(page).toHaveURL(/\/manager\/tie\/e2e-tie$/)

    // Men's singles rubber is shown.
    await expect(page.getByText(/Rubber 1/)).toBeVisible()

    // Illegal pick (Barbara, a woman, into men's singles) is refused with a reason.
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Barbara (F)' }).click()
    await expect(page.getByText(/gender/i)).toBeVisible()
    // Barbara was not added (no chip).
    await expect(page.locator('.v-chip', { hasText: 'Barbara (F)' })).toHaveCount(0)

    // Legal pick (Bob) is accepted.
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Bob (M)' }).click()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()

    // Save the draft.
    await page.getByRole('button', { name: /save draft/i }).click()
    await expect(page.getByText('Draft saved.')).toBeVisible()

    // Reload — the draft persists (own team only, via RLS).
    await page.reload()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
  })
})
