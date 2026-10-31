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
// Scenario 1: five-match team matches across four timeslots (one in the past,
// the current slot started 5 minutes ago, two coming up) and a day-two tie;
// the umpire console shows exactly the current + next-two window, the decided
// current-slot match dimmed in place with its 3–1 tally, and everything else
// under the collapsed Past and Future panels (counted, reachable by search).
//
// Scenario 2: a lineups-pending card flips to ready within one 20s poll,
// without a reload (the clock fast-forwards the poll timer from real now).
//
// Scenario 3: the dark theme toggle persists across a reload.
//
// Fixture times derive from the REAL current date (a hard-coded future date
// time-bombs once the calendar passes it), and the Playwright clock fakes
// "now" — a far-future fake clock would expire the auth session's JWT.

test.use({ timezoneId: 'UTC' })

const CAT = 'e2e-ux-cat'
// Fixture times derive from the REAL clock — never fake the wall clock (a fake
// far from the session's JWT expiry kills the auth session). Offsets: a slot
// an hour ago (Past), one started 5 minutes ago (current, decided 3–1), and
// two coming up (+2h, +4h) filling the lookahead window, plus a day-two tie
// that must always land in Future.
const iso = (offsetMs: number): string => new Date(Date.now() + offsetMs).toISOString()
const HOUR = 3600 * 1000
const T0900 = 'e2e-ux-t0900' // past slot (started an hour ago)
const T1030 = 'e2e-ux-t1030' // current slot (started 5 min ago) — DECIDED 3–1
const T1330 = 'e2e-ux-t1330' // +2h — lineups pending, scenario 2's flip target
const T1600 = 'e2e-ux-t1600' // +4h — pending filler in the window
const DAY2 = 'e2e-ux-day2' // tomorrow 09:00 — must always sit in Future
const tomorrow0900 = (() => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(9, 0, 0, 0)
  return d.toISOString()
})()

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
    { id: T0900, tournament_id: 'default', category_id: CAT, scheduled_start: iso(-HOUR), table_label: '1', team_a: 'e2e-a', team_b: 'e2e-b', is_knockout: false },
    { id: T1030, tournament_id: 'default', category_id: CAT, scheduled_start: iso(-5 * 60 * 1000), table_label: '2', team_a: 'e2e-a', team_b: 'e2e-c', is_knockout: false },
    { id: T1330, tournament_id: 'default', category_id: CAT, scheduled_start: iso(2 * HOUR), table_label: '3', team_a: 'e2e-a', team_b: 'e2e-b', is_knockout: false },
    { id: T1600, tournament_id: 'default', category_id: CAT, scheduled_start: iso(4 * HOUR), table_label: '4', team_a: 'e2e-b', team_b: 'e2e-c', is_knockout: false },
    { id: DAY2, tournament_id: 'default', category_id: CAT, scheduled_start: tomorrow0900, table_label: '1', team_a: 'e2e-ka', team_b: 'e2e-kb', is_knockout: false }
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
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_UMPIRE_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_UMPIRE_NEW_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/umpire$/)

    const windowPanel = page.getByTestId('window')
    const pastPanel = page.getByTestId('past-panel')
    const futurePanel = page.getByTestId('future-panel')

    // The window shows exactly the current (started 5 min ago) and the two
    // coming slots, the current one tagged Now.
    await expect(windowPanel.getByText('Now', { exact: true })).toBeVisible()
    await expect(
      windowPanel.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(3)

    // The decided 10:30 team match stays visible, dimmed, with its tally.
    const decidedCard = windowPanel
      .getByTestId('match-card')
      .filter({ hasText: 'Alpha (3)' })
    await expect(decidedCard).toHaveClass(/is-decided/)
    await expect(decidedCard.getByText('Charlie (1)')).toBeVisible()
    await expect(decidedCard.getByText('Alpha (3)')).toBeVisible()

    // The 09:00 slot and the day-two match are NOT in the window: exactly the
    // three fixture window ties (10:30/13:30/16:00) render, all category EVU.
    await expect(
      windowPanel.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(3)

    // Past and Future panels: collapsed, each showing a count (this shared
    // tournament has other fixtures too — assert the count format, not a
    // pinned number), and no cards rendered.
    await expect(pastPanel.getByText(/Past/)).toContainText(/match/)
    await expect(futurePanel.getByText(/Future/)).toContainText(/match/)
    await expect(pastPanel.getByTestId('match-card')).toHaveCount(0)
    await expect(futurePanel.getByTestId('match-card')).toHaveCount(0)

    // Expanding reveals the fixture matches in their group: the 09:00 slot is
    // past (earlier today), the day-two match is future.
    await pastPanel.getByRole('button').click()
    await futurePanel.getByRole('button').click()
    await expect(
      pastPanel.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(1)
    await expect(
      futurePanel.getByTestId('match-card').filter({ hasText: 'E2E Venue UX' })
    ).toHaveCount(1)

    // Search reaches both groups: only the day-two Kilo match remains anywhere.
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
    // Reset this test's own prior submission — a previous run left the Bravo
    // lineup submitted, which would flip the card to ready before the poll.
    const admin0 = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const reset = await request.patch(
      `${supabaseUrl}/rest/v1/lineups?tie_id=eq.${T1330}&team_id=eq.e2e-b`,
      { headers: authHeaders(admin0), data: { status: 'not-started' } }
    )
    expect(reset.ok()).toBeTruthy()

    await page.clock.install()
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_UMPIRE_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_UMPIRE_NEW_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/umpire$/)

    // The window's only Alpha-vs-Bravo tie is the 13:30 one (the 09:00 match
    // of the same pairing is shelved).
    const pendingCard = page
      .getByTestId('window')
      .getByTestId('match-card')
      .filter({ hasText: 'Alpha vs Bravo' })
      .filter({ hasText: 'E2E Venue UX' })
    // Under parallel suite load the console's first load can be slow — wait
    // generously for the card's first render.
    await expect(pendingCard.getByText(/lineups pending/i)).toBeVisible({ timeout: 15_000 })
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
