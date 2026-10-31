import { expect, type APIRequestContext, type Page } from '@playwright/test'

// Shared e2e config + auth helpers (the url/anonKey block was copy-pasted across
// specs). The anon key is Supabase's public local-demo key (localhost-only).

export const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
export const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

/** REST password sign-in → access token (for API-level tests). */
export async function apiToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
    data: { email, password }
  })
  expect(res.ok()).toBeTruthy()
  const { access_token } = (await res.json()) as { access_token: string }
  return access_token
}

/** Auth headers for a REST call authenticated as `token`. */
export function authHeaders(token: string): Record<string, string> {
  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal'
  }
}

/**
 * Delete a lineup row as an admin so a spec starts from a fresh builder. A no-op
 * when the row is already absent (PostgREST returns 204 deleting zero rows),
 * which is the fresh-stack case — so calling this in beforeAll is what makes a
 * spec re-runnable without `db reset` (a prior run otherwise leaves a draft that
 * changes how the builder renders).
 */
export async function deleteLineup(
  request: APIRequestContext,
  token: string,
  tieId: string,
  teamId: string
): Promise<void> {
  const res = await request.delete(
    `${supabaseUrl}/rest/v1/lineups?tie_id=eq.${tieId}&team_id=eq.${teamId}`,
    { headers: authHeaders(token) }
  )
  if (!res.ok()) {
    throw new Error(`delete lineup (${tieId}, ${teamId}) failed (${res.status}): ${await res.text()}`)
  }
}

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

/**
 * The venue views group matches outside the working window (current timeslot
 * + next two) into collapsible Past and Future panels. Fixture ties live far
 * in the future/past, so specs that assert on cards expand both panels first.
 */
export async function expandPanels(page: Page): Promise<void> {
  for (const testId of ['past-panel', 'future-panel']) {
    const head = page.getByTestId(testId).locator('button.group-head')
    // The views load asynchronously — give the panels a moment to render,
    // but never hang on surfaces that legitimately have none.
    await head.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    if ((await head.count()) > 0 && (await head.getAttribute('aria-expanded')) === 'false') {
      await head.click()
    }
  }
}

/**
 * Sign in as the administrator and land on the setup-aware landing surface:
 * Matches when a tournament exists (the global-setup fixtures guarantee one).
 */
export async function signInAdmin(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.getByRole('textbox', { name: /password/i }).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/matches$/)
}
