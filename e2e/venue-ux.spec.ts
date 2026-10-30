import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_UMPIRE_EMAIL,
  TEST_UMPIRE_NEW_PASSWORD
} from './global-setup'

// venue-ux — the feature-acceptance E2E.
//
// Scenario 1: five-match team matches across four timeslots (09:00, 10:30,
// 13:30, 16:00) and a day-two tie; with the device clock pinned to 11:20 the
// umpire console shows exactly the 10:30/13:30/16:00 window, the decided
// 10:30 match dimmed in place with its 3–1 tally, and everything else under
// the collapsed Shelved panel (counted, reachable by search).
//
// Scenario 2: a lineups-pending card flips to ready within one 20s poll,
// without a reload (the clock fast-forwards the poll timer).
//
// Scenario 3: the dark theme toggle persists across a reload.
//
// Fixture times derive from the REAL current date (a hard-coded future date
// time-bombs once the calendar passes it), and the Playwright clock fakes
// "now" — a far-future fake clock would expire the auth session's JWT.

test.use({ timezoneId: 'UTC' })

const CAT = 'e2e-ux-cat'
// Day-one slots on today's UTC date; the fake clock reads 11:20 today.
const DAY = new Date().toISOString().slice(0, 10)
const at = (hhmm: string): string => `${DAY}T${hhmm}:00+00:00`
const T0900 = 'e2e-ux-t0900'
const T1030 = 'e2e-ux-t1030'
const T1330 = 'e2e-ux-t1330'
const T1600 = 'e2e-ux-t1600'
const DAY2 = 'e2e-ux-day2'
const NOW = new Date(`${DAY}T11:20:00Z`)

const ALPHA_GAMES = [
  { a: 11, b: 5 },
  { a: 11, b: 7 },
  { a: 11, b: 9 }
]
const CHARLIE_GAMES = [
  { a: 5, b: 11 },
  { a: 7, b: 11 },
  { a: 9, b: 11 }
]

test.beforeAll(async ({ request }) => {
  const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  const upsertHeaders = { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' }

  // Re-runnability: rubber_results' unique key is (tie_id, rubber_index), which
  // merge-duplicates does not target (it upserts on the uuid PK) — drop the
  // fixture's stored results first so the POST below is a clean insert.
  const del = await request.delete(
    `${supabaseUrl}/rest/v1/rubber_results?tie_id=in.(${T1030},${T0900},${T1330},${T1600},${DAY2})`,
    { headers: authHeaders(admin) }
  )
  if (!del.ok() && del.status() !== 404) {
    throw new Error(`delete rubber_results failed: ${await del.text()}`)
  }

  const post = async (table: string, data: unknown): Promise<void> => {
    const res = await request.post(`${supabaseUrl}/rest/v1/${table}`, {
      headers: upsertHeaders,
      data
    })
    if (!res.ok()) {
      throw new Error(`upsert ${table} failed (${res.status()}): ${await res.text()}`)
    }
  }

  await post('categories', [
    { id: CAT, tournament_id: 'default', name: 'E2E Venue UX', short_name: 'EVU' }
  ])
  await post('tie_formats', [
    {
      category_id: CAT,
      tournament_id: 'default',
      // Five-match team matches — the canonical real-event shape.
      rubbers: Array.from({ length: 5 }, () => ({ format: 'singles', constraint: {} })),
      usage_policy: null,
      lead_time_minutes: 30
    }
  ])
  await post('ties', [
    { id: T0900, tournament_id: 'default', category_id: CAT, scheduled_start: at('09:00'), table_label: '1', team_a: 'e2e-a', team_b: 'e2e-b', is_knockout: false },
    { id: T1030, tournament_id: 'default', category_id: CAT, scheduled_start: at('10:30'), table_label: '2', team_a: 'e2e-a', team_b: 'e2e-c', is_knockout: false },
    { id: T1330, tournament_id: 'default', category_id: CAT, scheduled_start: at('13:30'), table_label: '3', team_a: 'e2e-a', team_b: 'e2e-b', is_knockout: false },
    { id: T1600, tournament_id: 'default', category_id: CAT, scheduled_start: at('16:00'), table_label: '4', team_a: 'e2e-b', team_b: 'e2e-c', is_knockout: false },
    { id: DAY2, tournament_id: 'default', category_id: CAT, scheduled_start: `${DAY.slice(0, 8)}${String(+DAY.slice(8) + 1).padStart(2, '0')}T09:00:00+00:00`, table_label: '1', team_a: 'e2e-ka', team_b: 'e2e-kb', is_knockout: false }
  ])
  // The 10:30 team match is DECIDED 3–1 (Alpha): four rubbers stored, r5 absent.
  // Both lineups are submitted — the entry gate must be satisfied for the
  // derived decided state to surface.
  await post('lineups', [
    {
      tie_id: T1030,
      tournament_id: 'default',
      team_id: 'e2e-a',
      player_ids: [['e2e-p2'], ['e2e-p2'], ['e2e-p2'], ['e2e-p2'], ['e2e-p2']],
      status: 'submitted',
      submitted_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z'
    },
    {
      tie_id: T1030,
      tournament_id: 'default',
      team_id: 'e2e-c',
      player_ids: [['e2e-p5'], ['e2e-p5'], ['e2e-p5'], ['e2e-p5'], ['e2e-p5']],
      status: 'submitted',
      submitted_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z'
    }
  ])
  await post('rubber_results', [
    { tournament_id: 'default', tie_id: T1030, rubber_index: 1, player_ids: [['e2e-p2'], ['e2e-p5']], games: ALPHA_GAMES, walkover: false },
    { tournament_id: 'default', tie_id: T1030, rubber_index: 2, player_ids: [['e2e-p2'], ['e2e-p5']], games: ALPHA_GAMES, walkover: false },
    { tournament_id: 'default', tie_id: T1030, rubber_index: 3, player_ids: [['e2e-p2'], ['e2e-p5']], games: ALPHA_GAMES, walkover: false },
    { tournament_id: 'default', tie_id: T1030, rubber_index: 4, player_ids: [['e2e-p2'], ['e2e-p5']], games: CHARLIE_GAMES, walkover: false }
  ])
  // The 13:30 team match is lineups-pending: only Alpha has submitted.
  await post('lineups', [
    {
      tie_id: T1330,
      tournament_id: 'default',
      team_id: 'e2e-a',
      player_ids: [['e2e-p2'], ['e2e-p2'], ['e2e-p2'], ['e2e-p2'], ['e2e-p2']],
      status: 'submitted',
      submitted_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z'
    }
  ])
})

test.describe.serial('venue-ux (feature acceptance)', () => {
  test('scenario 1: timeslot window, decided-in-place, shelved panel reachable by search', async ({
    page
  }) => {
    await page.clock.install({ time: NOW })
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_UMPIRE_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_UMPIRE_NEW_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/umpire$/)

    const windowPanel = page.getByTestId('window')
    const shelf = page.getByTestId('shelf')

    // The window shows exactly the 10:30 / 13:30 / 16:00 slots, in time order.
    await expect(windowPanel.getByText('10:30', { exact: true })).toBeVisible()
    await expect(windowPanel.getByText('13:30', { exact: true })).toBeVisible()
    await expect(windowPanel.getByText('16:00', { exact: true })).toBeVisible()

    // The decided 10:30 team match stays visible, dimmed, with its tally.
    const decidedCard = windowPanel
      .getByTestId('match-card')
      .filter({ hasText: 'Alpha vs Charlie' })
    await expect(decidedCard).toHaveClass(/is-decided/)
    await expect(decidedCard.getByText('3–1')).toBeVisible()

    // The 09:00 slot and the day-two match are NOT in the window: exactly the
    // three fixture window ties (10:30/13:30/16:00) render, all category EVU.
    await expect(
      windowPanel.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(3)

    // Shelved panel: collapsed, showing a count (this shared tournament has
    // other fixtures too — assert the count format, not a pinned number), and
    // no cards rendered.
    await expect(shelf.getByText(/Shelved/)).toContainText(/matches/)
    await expect(shelf.getByTestId('match-card')).toHaveCount(0)

    // Expanding reveals the shelved fixture matches (09:00 today + day two).
    await shelf.getByRole('button', { name: /shelved/i }).click()
    await expect(
      shelf.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(2)

    // Search reaches the shelf: only the day-two Kilo match remains anywhere.
    await page.getByRole('textbox', { name: /search player/i }).fill('Kilo')
    await expect(
      page
        .getByTestId('match-card')
        .filter({ hasText: 'E2E Venue UX' })
        .filter({ hasText: 'Kilo' })
    ).toHaveCount(1)
    await expect(
      page
        .getByTestId('match-card')
        .filter({ hasText: 'E2E Venue UX' })
        .filter({ hasText: 'Alpha' })
    ).toHaveCount(0)
  })

  test('scenario 2: a submitted lineup flips a pending card within one poll', async ({
    page,
    request
  }) => {
    await page.clock.install({ time: NOW })
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_UMPIRE_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_UMPIRE_NEW_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/umpire$/)

    const pendingCard = page
      .getByTestId('window')
      .getByTestId('match-card')
      .filter({ hasText: 'Alpha vs Bravo' })
      .filter({ hasText: '13:30' })
    await expect(pendingCard.getByText(/lineups pending/i)).toBeVisible()
    await expect(pendingCard.getByRole('button', { name: /enter results/i })).toHaveCount(0)

    // The second side's manager (via the admin here) submits the lineup.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const submit = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
      headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' },
      data: {
        tie_id: T1330,
        tournament_id: 'default',
        team_id: 'e2e-b',
        player_ids: [['e2e-p3'], ['e2e-p3'], ['e2e-p3'], ['e2e-p3'], ['e2e-p3']],
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    expect(submit.ok()).toBeTruthy()

    // No reload — one poll tick later the card is ready.
    await page.clock.fastForward('00:20')
    await expect(pendingCard.getByRole('button', { name: /enter results/i })).toBeVisible({
      timeout: 10_000
    })
  })

  test('scenario 3: the dark theme persists across a reload', async ({ page }) => {
    await page.clock.install({ time: NOW })
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_UMPIRE_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_UMPIRE_NEW_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/umpire$/)

    await expect(page.locator('html')).toHaveAttribute('data-theme', /light|^$/)
    await page.getByRole('button', { name: /dark mode|theme/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page).toHaveURL(/\/umpire$/)
  })
})
