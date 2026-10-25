import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { apiToken, authHeaders, supabaseAnonKey, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// results-and-standings slice 1 (results-entry) — the feature-acceptance E2E.
//
// Scenario 1: both lineups submitted for a group tie → an umpire enters
// best-of-valid games (one rubber as a walkover) → the tie shows decided with
// the derived winner → the admin overrides a player and a game score and the
// derived winner recomputes.
//
// Scenario 2: one side's lineup not submitted → entry refused with the reason
// visible, and no result rows exist.
//
// The spec owns its fixture rows (players/category/format/ties/lineups on the
// 'default' tournament) and converges them in beforeAll, so the suite stays
// re-runnable without a db reset. Nothing else touches these ids.

const UMPIRE_EMAIL = 'umpire@lineup.local'
const UMPIRE_PASSWORD = 'umpire-password-123'
const UMPIRE_NEW_PASSWORD = 'umpire-new-pw-123'

const RES_CAT = 'e2e-cat-res'
const RES_TIE = 'e2e-tie-res'
const GATE_TIE = 'e2e-tie-res-gate'
const TOURNAMENT = 'default'

// Three-rubber singles format (best-of-5 games per rubber by the tie default):
// r1/r2 won by Alpha, r3 by Charlie → Alpha 2–1 decided; the admin override
// then flips r1 to Charlie → Charlie 2–1, an observable winner recompute.
const RES_GAMES_A_WINS = [
  [11, 5],
  [11, 7],
  [11, 9]
]
const RES_GAMES_FLIPPED = [
  [5, 11],
  [7, 11],
  [9, 11]
]
const RES_GAMES_C_WINS = [
  [5, 11],
  [7, 11],
  [9, 11]
]

function jsonHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: supabaseAnonKey
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

test.beforeAll(async ({ request }) => {
  const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)

  // Re-runnability: drop any result rows and lineups from a prior run first.
  for (const tie of [RES_TIE, GATE_TIE]) {
    const del = await request.delete(
      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${tie}`,
      { headers: authHeaders(admin) }
    )
    if (!del.ok && del.status() !== 404) {
      throw new Error(`delete rubber_results (${tie}) failed: ${await del.text()}`)
    }
  }
  const delLineups = await request.delete(
    `${supabaseUrl}/rest/v1/lineups?tie_id=in.(${RES_TIE},${GATE_TIE})`,
    { headers: authHeaders(admin) }
  )
  if (!delLineups.ok) {
    throw new Error(`delete fixture lineups failed: ${await delLineups.text()}`)
  }

  // Fixture: category + 3-rubber singles format, rosters (Alpha's Alan/Adam/
  // Arnie, Charlie's Chas/Chet/Chad), the two ties, and submitted lineups for
  // the entry tie (both sides) and only Alpha's lineup for the gate tie.
  await request.patch(`${supabaseUrl}/rest/v1/categories?id=eq.${RES_CAT}`, {
    headers: authHeaders(admin),
    data: { id: RES_CAT, tournament_id: TOURNAMENT, name: 'E2E Results', short_name: 'ER' }
  })
  await request.patch(`${supabaseUrl}/rest/v1/tie_formats?category_id=eq.${RES_CAT}`, {
    headers: authHeaders(admin),
    data: {
      category_id: RES_CAT,
      tournament_id: TOURNAMENT,
      rubbers: [
        { format: 'singles', constraint: { allowedGenders: ['M'] } },
        { format: 'singles', constraint: { allowedGenders: ['M'] } },
        { format: 'singles', constraint: { allowedGenders: ['M'] } }
      ],
      usage_policy: null,
      lead_time_minutes: 30
    }
  })
  await request.patch(`${supabaseUrl}/rest/v1/players?id=in.(e2e-p5,e2e-p6,e2e-p7,e2e-p8,e2e-p9)`, {
    headers: authHeaders(admin),
    data: [
      { id: 'e2e-p5', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chas', gender: 'M', date_of_birth: '1991-01-01' },
      { id: 'e2e-p6', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chet', gender: 'M', date_of_birth: '1993-01-01' },
      { id: 'e2e-p7', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Adam', gender: 'M', date_of_birth: '1987-01-01' },
      { id: 'e2e-p8', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Arnie', gender: 'M', date_of_birth: '1986-01-01' },
      { id: 'e2e-p9', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chad', gender: 'M', date_of_birth: '1995-01-01' }
    ]
  })
  await request.patch(`${supabaseUrl}/rest/v1/ties?id=in.(${RES_TIE},${GATE_TIE})`, {
    headers: authHeaders(admin),
    data: [
      {
        id: RES_TIE,
        tournament_id: TOURNAMENT,
        category_id: RES_CAT,
        scheduled_start: '2099-03-01T10:00:00+00:00',
        table_label: '6',
        team_a: 'e2e-a',
        team_b: 'e2e-c',
        is_knockout: false
      },
      {
        id: GATE_TIE,
        tournament_id: TOURNAMENT,
        category_id: RES_CAT,
        scheduled_start: '2099-03-01T12:00:00+00:00',
        table_label: '7',
        team_a: 'e2e-a',
        team_b: 'e2e-c',
        is_knockout: false
      }
    ]
  })
  const lineups = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
    headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' },
    data: [
      {
        tie_id: RES_TIE,
        tournament_id: TOURNAMENT,
        team_id: 'e2e-a',
        player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
        status: 'submitted',
        submitted_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z'
      },
      {
        tie_id: RES_TIE,
        tournament_id: TOURNAMENT,
        team_id: 'e2e-c',
        player_ids: [['e2e-p5'], ['e2e-p6'], ['e2e-p9']],
        status: 'submitted',
        submitted_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z'
      },
      {
        // Gate tie: only Alpha submitted — Charlie's side stays unsubmitted.
        tie_id: GATE_TIE,
        tournament_id: TOURNAMENT,
        team_id: 'e2e-a',
        player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
        status: 'submitted',
        submitted_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z'
      }
    ]
  })
  if (!lineups.ok) {
    throw new Error(`insert fixture lineups failed: ${await lineups.text()}`)
  }

  // Provision the umpire via the REAL edge function (the actual provisioning
  // path — service_role lives inside the function, never in test code).
  const provision = await request.post(`${supabaseUrl}/functions/v1/provision-umpire`, {
    headers: jsonHeaders(admin),
    data: { email: UMPIRE_EMAIL, password: UMPIRE_PASSWORD, tournamentId: TOURNAMENT }
  })
  if (!provision.ok() && provision.status() !== 409) {
    throw new Error(`provision umpire failed (${provision.status()}): ${await provision.text()}`)
  }

  // Converge the umpire's first-login state (temp password + cleared flag) so
  // the UI sign-in below is stable across re-runs — mirroring global-setup's
  // manager convergence.
  const existing = await signInOrNull(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD)
  if (existing) {
    await request.post(`${supabaseUrl}/rest/v1/rpc/clear_must_change_password`, {
      headers: jsonHeaders(existing)
    })
  } else {
    const token = await signIn(request, UMPIRE_EMAIL, UMPIRE_PASSWORD)
    const upd = await request.put(`${supabaseUrl}/auth/v1/user`, {
      headers: jsonHeaders(token),
      data: { password: UMPIRE_NEW_PASSWORD }
    })
    if (!upd.ok()) {
      throw new Error(`umpire password change failed (${upd.status()}): ${await upd.text()}`)
    }
    const clr = await request.post(`${supabaseUrl}/rest/v1/rpc/clear_must_change_password`, {
      headers: jsonHeaders(await signIn(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD))
    })
    if (!clr.ok()) {
      throw new Error(`clear umpire must-change failed (${clr.status()}): ${await clr.text()}`)
    }
  }
})

async function signIn(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: jsonHeaders(),
    data: { email, password }
  })
  expect(res.ok()).toBeTruthy()
  const { access_token } = (await res.json()) as { access_token: string }
  return access_token
}

async function signInOrNull(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string | null> {
  const res = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: jsonHeaders(),
    data: { email, password }
  })
  if (!res.ok()) return null
  const { access_token } = (await res.json()) as { access_token: string }
  return access_token
}

/** Sign in as the umpire and land on the umpire entry screen. */
async function signInUmpire(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(UMPIRE_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(UMPIRE_NEW_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/umpire$/)
}

/** Fill one game row (side A / side B points) inside a rubber's section. */
async function fillGame(page: Page, rubber: number, game: number, a: number, b: number): Promise<void> {
  await page.getByRole('spinbutton', { name: `Rubber ${rubber} game ${game} side A` }).fill(String(a))
  await page.getByRole('spinbutton', { name: `Rubber ${rubber} game ${game} side B` }).fill(String(b))
}

test.describe('results entry (feature acceptance)', () => {
  test('scenario 1: umpire enters a decided result, admin override recomputes the winner', async ({
    page
  }) => {
    await signInUmpire(page)

    // The entry tie is open; the gate tie is locked with its reason (scenario 2's
    // visible half is asserted here in passing on the same list).
    await expect(page.getByText('Alpha vs Charlie').first()).toBeVisible()
    const gateRow = page.locator('tr, li').filter({ hasText: 'lineup not submitted' })
    await expect(gateRow.first()).toBeVisible()

    // Open the entry tie and score it: r1 Alpha in 3 games, r2 walkover Alpha,
    // r3 Charlie in 3 games → Alpha 2–1.
    await page.getByRole('button', { name: /enter results/i }).first().click()
    for (const [game, [a, b]] of RES_GAMES_A_WINS.entries()) {
      if (game > 0) await page.getByRole('button', { name: 'Rubber 1 add game' }).click()
      await fillGame(page, 1, game + 1, a, b)
    }
    for (const [game, [a, b]] of RES_GAMES_C_WINS.entries()) {
      if (game > 0) await page.getByRole('button', { name: 'Rubber 3 add game' }).click()
      await fillGame(page, 3, game + 1, a, b)
    }
    await page.getByRole('checkbox', { name: 'Rubber 2 walkover' }).check()
    await page.getByRole('radio', { name: 'Rubber 2 walkover side A' }).check()

    await page.getByRole('button', { name: /save results/i }).click()
    await expect(page.getByText(/Decided · Alpha/).first()).toBeVisible()

    // Admin override: flip r1's games to Charlie and swap r1 side A's player.
    await page.goto('/login')
    await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
    await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL(/\/matches$/)

    await page.getByRole('button', { name: /results/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog
      .getByLabel('Tournament')
      .selectOption({ label: 'E2E Results' })
      .catch(() => {
        // The dashboard scopes rows per category via the tournament selector;
        // when the fixture category needs selecting first, its option is named
        // 'E2E Results'. If no selector exists the rows are already filtered.
      })
    const resRow = page
      .locator('tr')
      .filter({ hasText: 'Alpha' })
      .filter({ hasText: 'Charlie' })
      .first()
    await resRow.getByRole('button', { name: /results/i }).click()

    const dlg = page.getByRole('dialog')
    for (const [game, [a, b]] of RES_GAMES_FLIPPED.entries()) {
      await dlg
        .getByRole('spinbutton', { name: `Rubber 1 game ${game + 1} side A` })
        .fill(String(a))
      await dlg
        .getByRole('spinbutton', { name: `Rubber 1 game ${game + 1} side B` })
        .fill(String(b))
    }
    await dlg.getByLabel('Rubber 1 side A player').selectOption({ label: 'Adam' })
    await dlg.getByRole('button', { name: /save results/i }).click()
    await expect(dlg).not.toBeVisible()

    // The derived winner recomputed: Alpha's r1 flip makes it Charlie 2–1.
    await expect(page.getByText(/Decided · Charlie/).first()).toBeVisible()
  })

  test('scenario 2: unsubmitted lineup locks entry — UI reason, server denial, zero rows', async ({
    request,
    page
  }) => {
    // UI: the umpire list shows the gate tie locked with the reason and no
    // entry button to press.
    await signInUmpire(page)
    const gateRow = page.locator('tr, li').filter({ hasText: 'lineup not submitted' })
    await expect(gateRow.first()).toBeVisible()
    await expect(gateRow.first().getByRole('button', { name: /enter results/i })).toHaveCount(0)

    // Server: a direct write as the umpire is refused and nothing persists.
    const umpire = await signIn(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD)
    const write = await request.post(`${supabaseUrl}/rest/v1/rubber_results`, {
      headers: jsonHeaders(umpire),
      data: [
        {
          tournament_id: TOURNAMENT,
          tie_id: GATE_TIE,
          rubber_index: 1,
          player_ids: [['e2e-p2'], ['e2e-p5']],
          games: [{ a: 11, b: 5 }],
          walkover: false
        }
      ]
    })
    expect(write.ok()).toBeFalsy()

    const read = await request.get(
      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${GATE_TIE}`,
      { headers: jsonHeaders(umpire) }
    )
    expect(read.ok()).toBeTruthy()
    expect(await read.json()).toEqual([])
  })
})
