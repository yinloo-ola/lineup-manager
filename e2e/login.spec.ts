import { test, expect } from '@playwright/test'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

test.describe('authentication', () => {
  test('redirects unauthenticated users to the login page', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('an administrator can sign in and reaches the home page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page).toHaveURL(/\/$/)
    // The Sign out button only renders on the authenticated home page.
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })

  test('a wrong password is rejected with an error, staying on login', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill('definitely-not-the-password')
    await page.getByRole('button', { name: /sign in/i }).click()

    // The failure surfaces as an error alert (Vuetify field messages also carry
    // role=alert, so assert on the surfaced message itself) and the user stays put.
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('sign out returns to the login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})
