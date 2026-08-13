import { expect, type Page } from '@playwright/test'

/**
 * Sign in and land on /manager. For a manager whose first-login password change
 * has already been completed in global-setup — no forced change, so retries are
 * safe (the password is stable).
 */
export async function signInManager(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.getByRole('textbox', { name: /password/i }).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/manager$/)
}
