import { test, expect } from '@playwright/test'
import {
  TEST_MANAGER_EMAIL,
  TEST_MANAGER_PASSWORD,
  TEST_MANAGER_NEW_PASSWORD
} from './global-setup'

test.describe('manager flow', () => {
  test('forced password change, then roster and ties (own data only)', async ({ page }) => {
    // Sign in with the administrator-provided temporary password.
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_MANAGER_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_MANAGER_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // The manager is forced to set their own password before anything else.
    await expect(page).toHaveURL(/\/change-password$/)
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill(TEST_MANAGER_NEW_PASSWORD)
    await page
      .getByRole('textbox', { name: 'Confirm new password' })
      .fill(TEST_MANAGER_NEW_PASSWORD)
    await page.getByRole('button', { name: /update password/i }).click()

    // Lands on the manager view (role routing).
    await expect(page).toHaveURL(/\/manager$/)

    // Own roster is visible.
    await expect(page.getByText('Alice')).toBeVisible()
    await expect(page.getByText('Alan')).toBeVisible()
    // Opponent's roster is NOT visible (RLS isolation).
    await expect(page.getByText('Bob')).toHaveCount(0)

    // Own tie is visible, showing the opponent's team name.
    await expect(page.getByText(/vs Bravo/)).toBeVisible()
  })
})
