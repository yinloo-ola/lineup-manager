import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// Issue #14: importing a seed always creates a NEW tournament (named from
// tournamentName), stamps the new tournament's id onto every imported row, and
// surfaces a rename field when the name clashes. The new tournament then appears
// in the selector and its data shows in the scoped views.

async function signInAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** A minimal valid v1 seed whose ids are stable (the import remints them anyway). */
function seedJson(tournamentName: string): string {
  return JSON.stringify({
    seedVersion: 1,
    tournamentName,
    categories: [{ id: 'imp-cat', name: "Men's Team", shortName: 'MT' }],
    teams: [
      { id: 'imp-t1', name: 'Importers', managerEmail: 'importers@example.test' },
      { id: 'imp-t2', name: 'Rivals', managerEmail: 'rivals@example.test' }
    ],
    players: [
      { id: 'imp-p1', teamId: 'imp-t1', name: 'Ian', gender: 'M', dateOfBirth: '1990-01-01' }
    ],
    ties: [
      {
        id: 'imp-tie',
        categoryId: 'imp-cat',
        scheduledStart: '2026-08-20T10:00',
        table: '1',
        group: 'A',
        round: '1',
        teamIds: ['imp-t1', 'imp-t2']
      }
    ]
  })
}

test.describe('seed import → new tournament', () => {
  test('creates a new tournament, selects it, and its teams show in a scoped view', async ({
    page
  }) => {
    // Unique name per run so the happy path never clashes with a prior run.
    const name = `E2E Import ${Date.now()}`
    await signInAdmin(page)
    await page.goto('/import')

    await page.getByLabel('Tournament JSON').fill(seedJson(name))
    await page.getByRole('button', { name: /parse & import/i }).click()
    await expect(page.getByText(/created —/)).toBeVisible()

    // The new tournament is auto-selected; its imported teams appear under /provision.
    await page.goto('/provision')
    // The selector reflects the freshly created + selected tournament.
    await expect(page.getByText(name)).toBeVisible()
    // Open the Team dropdown (Vuetify's v-field__input intercepts label clicks).
    await page.locator('.v-field').filter({ hasText: 'Team' }).click()
    await expect(page.getByRole('option', { name: 'Importers' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Rivals' })).toBeVisible()
  })

  test('a clashing name blocks import and offers a rename that completes it', async ({
    page
  }) => {
    await signInAdmin(page)
    await page.goto('/import')

    // "Default" is created by the e2e fixture setup, so this name always clashes.
    await page.getByLabel('Tournament JSON').fill(seedJson('Default'))
    await page.getByRole('button', { name: /parse & import/i }).click()

    // The clash surfaces with the existing name and a rename field; Confirm is
    // disabled while the field still holds the clashing name.
    await expect(page.getByText(/already exists/i)).toBeVisible()
    const confirm = page.getByRole('button', { name: /confirm import/i })
    await expect(confirm).toBeDisabled()

    // Resolving the name completes the import.
    const resolved = `E2E Renamed ${Date.now()}`
    await page.getByLabel('New tournament name').fill(resolved)
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByText(/created —/)).toBeVisible()
  })

  test('re-importing the same seed creates a second, independent tournament', async ({
    page,
    request
  }) => {
    // The core #11 semantic: import NEVER overwrites — the same seed twice must
    // yield two tournaments with their own child rows, not one mutated one.
    const first = `E2E Reimport A ${Date.now()}`
    const second = `E2E Reimport B ${Date.now()}`
    await signInAdmin(page)
    await page.goto('/import')

    // First import: straight through.
    await page.getByLabel('Tournament JSON').fill(seedJson(first))
    await page.getByRole('button', { name: /parse & import/i }).click()
    await expect(page.getByText(/created —/)).toBeVisible()

    // Same seed again: the name now clashes, and renaming completes the import.
    await page.getByLabel('Tournament JSON').fill(seedJson(first))
    await page.getByRole('button', { name: /parse & import/i }).click()
    await expect(page.getByText(/already exists/i)).toBeVisible()
    await page.getByLabel('New tournament name').fill(second)
    await page.getByRole('button', { name: /confirm import/i }).click()
    await expect(page.getByText(/created —/)).toBeVisible()

    // Both tournaments exist server-side, each with its OWN copy of the seed's
    // teams (same seed ids, distinct minted row ids). A regression toward
    // upsert-by-seed-id would empty the first tournament's teams here.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const toursRes = await request.get(`${supabaseUrl}/rest/v1/tournaments?select=id,name`, {
      headers: authHeaders(admin)
    })
    const tours = (await toursRes.json()) as { id: string; name: string }[]
    const mine = tours.filter((t) => t.name === first || t.name === second)
    expect(mine).toHaveLength(2)

    const importerIds: string[] = []
    for (const t of mine) {
      const teamsRes = await request.get(
        `${supabaseUrl}/rest/v1/teams?tournament_id=eq.${t.id}&name=eq.Importers&select=id`,
        { headers: authHeaders(admin) }
      )
      const rows = (await teamsRes.json()) as { id: string }[]
      expect(rows).toHaveLength(1)
      importerIds.push(rows[0].id)
    }
    expect(importerIds[0]).not.toBe(importerIds[1])

    // Cleanup: these imports carry no managers, so a plain REST delete cascades
    // them away and repeated local runs don't accumulate garbage tournaments.
    const ids = mine.map((t) => t.id).join(',')
    const del = await request.delete(`${supabaseUrl}/rest/v1/tournaments?id=in.(${ids})`, {
      headers: authHeaders(admin)
    })
    expect(del.ok()).toBeTruthy()
  })
})
