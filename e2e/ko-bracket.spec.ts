import { test, expect, type Page } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// ko-import #15 / spec §8: the bracket lifecycle through the real UI on the
// isolated E2E Knockout category (own teams/slots — no parallel spec shares a
// row). The spec mutates its rows, so beforeAll resets them to the pristine
// global-setup shape, keeping the suite re-runnable without a db reset.

const KO_ROWS = [
  'e2e-ko-qf1', 'e2e-ko-qf2', 'e2e-ko-qf3', 'e2e-ko-qf4',
  'e2e-ko-p1', 'e2e-ko-p2', 'e2e-ko-sf1', 'e2e-ko-sf2', 'e2e-ko-f1'
]

test.beforeAll(async ({ request }) => {
  const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
  const ids = KO_ROWS.join(',')
  const reset = await request.patch(`${supabaseUrl}/rest/v1/ties?id=in.(${ids})`, {
    headers: authHeaders(admin),
    data: { team_a: null, team_b: null, winner_side: null, placed_match_id: null }
  })
  if (!reset.ok) throw new Error(`reset KO rows failed (${reset.status()}): ${await reset.text()}`)
  const del = await request.delete(`${supabaseUrl}/rest/v1/lineups?tie_id=in.(${ids})`, {
    headers: authHeaders(admin)
  })
  if (!del.ok) throw new Error(`reset KO lineups failed (${del.status()}): ${await del.text()}`)
})

async function signInAdmin(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/matches$/)
}

async function openBracket(page: Page): Promise<void> {
  await page.goto('/bracket')
  await page.getByLabel('Team event').click({ force: true })
  await page.getByRole('option', { name: 'E2E Knockout', exact: true }).click()
  await expect(page.getByText(/Imported QF team matches/)).toBeVisible()
}

/** Entry pickers in fixed DOM order: QF1A, QF1B, QF2A, QF2B, QF3A, QF3B,
 *  QF4A, QF4B. Entering by index places the byes deliberately (QF1B and QF4B
 *  stay empty) rather than filling greedily. */
function picker(page: Page, index: number) {
  return page.getByPlaceholder('— enter team —').nth(index)
}

async function enterAt(page: Page, index: number, team: string): Promise<void> {
  await page.keyboard.press('Escape') // close any stale picker menu
  await picker(page, index).click({ force: true })
  await page.getByRole('option', { name: team, exact: true }).last().click()
}

/** The table row holding both named team buttons — teams sit on exactly one
 *  slot each, so the pair pins the row. */
function rowWith(page: Page, teamA: string, teamB?: string) {
  let row = page.locator('tr').filter({ has: page.getByRole('button', { name: teamA, exact: true }) })
  if (teamB !== undefined) {
    row = row.filter({ has: page.getByRole('button', { name: teamB, exact: true }) })
  }
  return row.first()
}

test.describe('knockout bracket lifecycle (bracket view)', () => {
  test('entry → placement → advance byes → winners to the Final → un-pick → cascade → release', async ({
    page
  }) => {
    await signInAdmin(page)
    await openBracket(page)

    // --- Entry: 6 teams across 4 slots, byes on QF1A/QF4A (QF1B/QF4B empty).
    await enterAt(page, 0, 'Kilo')      // QF1 side A — bye
    await enterAt(page, 1, 'Mike')      // QF2 side A (first remaining after QF1A)
    await enterAt(page, 1, 'November')  // QF2 side B
    await enterAt(page, 1, 'Oscar')     // QF3 side A
    await enterAt(page, 1, 'Papa')      // QF3 side B
    await enterAt(page, 1, 'Lima')      // QF4 side A — bye

    // One KO slot per team: Kilo (on QF1) is not offered to another slot —
    // and neither is any team from another category (Alpha & co).
    await picker(page, 1).click({ force: true })  // QF4 side B stays empty (bye)
    await expect(page.getByRole('option', { name: 'Kilo', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'Alpha', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // --- Placement: the two pool matches onto the two-team slots.
    await page.getByPlaceholder('assign imported match…').first().click({ force: true })
    await page.getByRole('option', { name: /T2 · 2098-01-02 14:00/ }).click()
    await page.getByPlaceholder('assign imported match…').first().click({ force: true })
    await page.getByRole('option', { name: /T3 · 2098-01-02 14:00/ }).click()
    await expect(page.getByText('T2 · 2098-01-02 14:00 → placed')).toBeVisible()
    await expect(page.getByText('T3 · 2098-01-02 14:00 → placed')).toBeVisible()

    // --- Balance + byes: the round balanced, the byes advance.
    await page.getByRole('button', { name: /Advance 2 byes/ }).click()
    await expect(page.getByRole('button', { name: /Advance 2 byes/ })).toHaveCount(0)
    // Wait for the advance to settle (the reload's visible effect: the QF1 bye
    // row shows its advanced winner) before further clicks.
    await expect(page.locator('tr').filter({ hasText: 'BYE — no schedule' }).first()).toContainText('Kilo')

    // --- Un-pick a bye: a decided one-team slot must still correct (the guard
    // once demanded both sides set, which locked the bye's team in for good).
    const qf1Bye = page.locator('tr').filter({ hasText: 'BYE — no schedule' }).first()
    await qf1Bye.getByRole('button', { name: 'Kilo', exact: true }).click()
    await expect(page.getByText(/Cannot select winner/)).toHaveCount(0)
    // The slot is undecided: the remove-team ✕ surfaces, and the derived SF
    // side rewound — QF1's Kilo is the only Kilo button left on the page.
    await expect(qf1Bye.getByRole('button', { name: /remove team/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kilo', exact: true })).toHaveCount(1)
    // Re-advance: still balanced, and only Kilo's bye returned to pending
    // (Lima's stayed decided), so a single bye goes back.
    await page.getByRole('button', { name: /Advance 1 bye/ }).click()
    // The derived SF side is back: QF1's Kilo plus SF1's advanced Kilo again.
    await expect(page.getByRole('button', { name: 'Kilo', exact: true })).toHaveCount(2)

    // --- Winners: QF2 and QF3 decide, the semis fill, the Final derives.
    await rowWith(page, 'Mike', 'November').getByRole('button', { name: 'Mike' }).click()
    await rowWith(page, 'Oscar', 'Papa').getByRole('button', { name: 'Oscar' }).click()
    // SF1 = [Kilo (bye), Mike]; SF2 = [Oscar, Lima (bye)].
    await rowWith(page, 'Kilo', 'Mike').getByRole('button', { name: 'Kilo' }).click()
    await rowWith(page, 'Oscar', 'Lima').getByRole('button', { name: 'Oscar' }).click()
    // Final = [Kilo, Oscar]; decide it.
    await rowWith(page, 'Kilo', 'Oscar').getByRole('button', { name: 'Kilo' }).click()
    await expect(rowWith(page, 'Kilo', 'Oscar').getByRole('button', { name: 'Oscar' })).toBeDisabled()

    // --- Un-pick the Final: nothing downstream — instant, no dialog.
    await rowWith(page, 'Kilo', 'Oscar').getByRole('button', { name: 'Kilo' }).click()
    await expect(page.getByText('Un-pick / change winner')).toHaveCount(0)
    await expect(rowWith(page, 'Kilo', 'Oscar').getByRole('button', { name: 'Oscar' })).toBeEnabled()
    // Decide it again for the cascade test.
    await rowWith(page, 'Kilo', 'Oscar').getByRole('button', { name: 'Kilo' }).click()

    // --- Un-pick QF2's winner: the semis and Final sit downstream — cascade.
    await rowWith(page, 'Mike', 'November').getByRole('button', { name: 'Mike' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/rewinds the bracket/i)).toBeVisible()
    await expect(dialog.getByText(/Winner cleared/i).first()).toBeVisible()
    await dialog.getByRole('button', { name: /clear & re-pick/i }).click()
    await expect(dialog).not.toBeVisible()

    // Downstream rewound: SF1 lost Mike's slot and the Final its side — the
    // derived rows read TBD again while QF2 itself keeps both teams.
    await expect(page.locator('tr').filter({ hasText: 'Kilo' }).filter({ hasText: 'Mike' })).toHaveCount(0)
    await expect(page.locator('tr').filter({ hasText: 'Kilo' }).filter({ hasText: 'Oscar' })).toHaveCount(0)
    await expect(rowWith(page, 'Mike', 'November')).toBeVisible()

    // --- ✕ release: removing a team from a placed slot frees its pool match.
    await rowWith(page, 'Mike', 'November').getByRole('button', { name: /remove team/i }).first().click()
    await expect(page.getByText('T2 · 2098-01-02 14:00 → placed')).toHaveCount(0)
    await expect(page.getByText('T2 · 2098-01-02 14:00', { exact: true })).toBeVisible()
  })
})
