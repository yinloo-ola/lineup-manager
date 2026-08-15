import { test, expect, type Page } from '@playwright/test'
import { apiToken, authHeaders, signInAdmin, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// Ticket #16: the guarded pre-start format edit + the freeze (spec §6). Uses
// its OWN throwaway tournament (no start date → pre-start) so shared fixtures
// are never touched. The beforeAll upserts converge a prior run's state back
// to the base format; the afterAll clears the freeze test's start date again
// so the suite stays re-runnable without `db reset`.

const TOUR_ID = 'e2e-fg-tour'
const TOUR_NAME = 'E2E Format Guard'
const CAT_ID = 'e2e-fg-cat'
const CAT_NAME = 'E2E Guard Category'
const TEAM_A = 'e2e-fg-a'
const TEAM_B = 'e2e-fg-b'
const TIE_ID = 'e2e-fg-tie'
const PLAYER_ID = 'e2e-fg-p1'

/** Make the throwaway tournament the active one and land on its Matches page. */
async function activate(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Tournament' }).click({ force: true })
  await page.getByRole('option', { name: TOUR_NAME, exact: false }).click()
}

test.describe.serial('format guard + freeze (#16)', () => {
  test.beforeAll(async ({ request }) => {
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const headers = authHeaders(admin)
    const upsert = (table: string, rows: Record<string, unknown>[]) =>
      request.post(`${supabaseUrl}/rest/v1/${table}`, {
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        data: rows
      })
    // Base format: plain men's singles; Victor (M, b. 1990) is eligible. The
    // start date anchors age evaluation near today WITHOUT starting the
    // tournament (that would freeze the format — the freeze test does that
    // later; afterAll converges the value back).
    await upsert('tournaments', [{ id: TOUR_ID, name: TOUR_NAME, start_date: '2026-09-01' }])
    await upsert('categories', [{ id: CAT_ID, tournament_id: TOUR_ID, name: CAT_NAME, short_name: 'FG' }])
    await upsert('teams', [
      { id: TEAM_A, tournament_id: TOUR_ID, name: 'Guardians' },
      { id: TEAM_B, tournament_id: TOUR_ID, name: 'Rivals' }
    ])
    await upsert('players', [
      { id: PLAYER_ID, tournament_id: TOUR_ID, team_id: TEAM_A, name: 'Victor', gender: 'M', date_of_birth: '1990-01-01' }
    ])
    await upsert('ties', [
      {
        id: TIE_ID,
        tournament_id: TOUR_ID,
        category_id: CAT_ID,
        scheduled_start: '2099-01-01T10:00:00+00:00',
        table_label: '1',
        team_a: TEAM_A,
        team_b: TEAM_B
      }
    ])
    await upsert('tie_formats', [
      {
        category_id: CAT_ID,
        tournament_id: TOUR_ID,
        rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }],
        usage_policy: null,
        lead_time_minutes: 30
      }
    ])
    await upsert('lineups', [
      {
        tie_id: TIE_ID,
        tournament_id: TOUR_ID,
        team_id: TEAM_A,
        player_ids: [[PLAYER_ID]],
        status: 'submitted',
        submitted_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z'
      }
    ])
  })

  test.afterAll(async ({ request }) => {
    // Converge the freeze test's side effect back to the base start date so a
    // re-run starts pre-start again.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    await request.patch(`${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}`, {
      headers: { ...authHeaders(admin), Prefer: 'return=minimal' },
      data: { start_date: '2026-09-01' }
    })
  })

  test('breaking save previews impact; cancel is a no-op; confirm flags Needs attention', async ({
    page,
    request
  }) => {
    await signInAdmin(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    await activate(page)
    await page.goto('/formats')
    // Vuetify's .v-field__input intercepts clicks on the select's input — click the field.
    await page.locator('.v-field').filter({ hasText: 'Team event' }).click()
    await page.getByRole('option', { name: CAT_NAME }).click()

    // Tighten the format: Victor (b. 1990) is too young for min age 40.
    await page.getByLabel('Min age', { exact: true }).fill('40')
    await page.getByRole('button', { name: 'Save Team Match Format' }).click()

    // The guard: impact preview names the affected lineup's team match.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('This change breaks submitted lineups')).toBeVisible()
    await expect(dialog.getByText(/Guardians vs Rivals/)).toBeVisible()

    // Cancel leaves everything untouched — no silent invalidation, no save.
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const unchanged = await request.get(
      `${supabaseUrl}/rest/v1/tie_formats?tournament_id=eq.${TOUR_ID}&category_id=eq.${CAT_ID}&select=rubbers`,
      { headers: authHeaders(admin) }
    )
    expect((await unchanged.json())[0].rubbers).toEqual([
      { format: 'singles', constraint: { allowedGenders: ['M'] } }
    ])

    // Confirmed break saves and surfaces as Needs attention on the dashboard.
    await page.getByRole('button', { name: 'Save Team Match Format' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Save anyway' }).click()
    await expect(page.getByText(/Saved 1 match/)).toBeVisible()

    await page.goto('/matches')
    await expect(page.getByText('Needs attention').first()).toBeVisible()
  })

  test('a started tournament freezes the authoring page', async ({ page, request }) => {
    // Start the tournament (past start date) — the freeze anchor.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const started = await request.patch(`${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}`, {
      headers: { ...authHeaders(admin), Prefer: 'return=minimal' },
      data: { start_date: '2000-01-01' }
    })
    expect(started.ok()).toBeTruthy()

    await signInAdmin(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    await activate(page)
    await page.goto('/formats')

    await expect(page.getByText(/Team Match Formats are frozen/i)).toBeVisible()
    // Switching is still possible; editing and saving are not.
    await page.locator('.v-field').filter({ hasText: 'Team event' }).click()
    await page.getByRole('option', { name: CAT_NAME }).click()
    await expect(page.getByRole('button', { name: 'Save Team Match Format' })).toBeDisabled()
  })
})
