import { expect, type Page } from '@playwright/test'

/**
 * Sign in with an administrator-provided temporary password, then complete the
 * forced first-login password change. Lands on /manager for a manager account.
 * Shared so specs stay decoupled (each uses its own provisioned manager).
 */
export async function signInAndChangePassword(
  page: Page,
  email: string,
  tempPassword: string,
  newPassword: string
): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.getByRole('textbox', { name: /password/i }).fill(tempPassword)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/change-password$/)
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill(newPassword)
  await page.getByRole('textbox', { name: 'Confirm new password' }).fill(newPassword)
  await page.getByRole('button', { name: /update password/i }).click()
}
