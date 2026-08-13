import { test, expect } from '@playwright/test'
import { signInManager } from './helpers'
import { TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD } from './global-setup'

// Exercises the lineup builder end-to-end as the Bravo manager (own roster only,
// via RLS). Uses a dedicated second manager whose password is pre-set in
// global-setup, so it is decoupled from manager.spec's forced-change flow.

test.describe('lineup builder', () => {
  test('illegal pick refused; build, submit, recall; draft persists', async ({ page }) => {
    await signInManager(page, TEST_MANAGER2_EMAIL, TEST_MANAGER2_NEW_PASSWORD)

    // Own roster visible; opponent's (Alpha) roster hidden by RLS.
    await expect(page.getByText('Bob').first()).toBeVisible()
    await expect(page.getByText('Barbara').first()).toBeVisible()
    await expect(page.getByText('Alice')).toHaveCount(0)

    // Open the future tie's lineup builder directly (Bravo has two ties).
    await page.goto('/manager/tie/e2e-tie')
    await expect(page.getByText(/Rubber 1/)).toBeVisible()

    // Illegal pick (Barbara, a woman, into men's singles) is refused with a reason.
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Barbara (F)' }).click()
    await expect(page.getByText(/gender/i)).toBeVisible()
    await expect(page.locator('.v-chip', { hasText: 'Barbara (F)' })).toHaveCount(0)

    // Legal pick (Bob) is accepted; save the draft.
    await page.locator('.v-field').filter({ hasText: 'Add player' }).first().click()
    await page.getByRole('option', { name: 'Bob (M)' }).click()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Draft saved.')).toBeVisible()

    // Submit the complete, valid lineup.
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(page.getByText('Lineup submitted.')).toBeVisible()
    // Submitted → a Recall action is now offered.
    await expect(page.getByRole('button', { name: /recall/i })).toBeVisible()

    // Recall back to draft; Submit is offered again.
    await page.getByRole('button', { name: /recall/i }).click()
    await expect(page.getByText('Lineup recalled to draft.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()

    // Reload — the draft persists (own team only, via RLS).
    await page.reload()
    await expect(page.locator('.v-chip', { hasText: 'Bob (M)' })).toBeVisible()
  })
})
