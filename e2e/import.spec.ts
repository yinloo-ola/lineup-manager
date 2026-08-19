import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// Issue #14 / ticket 13: importing a tournament (the selector's "Import
// tournament…" dialog — import IS the create action) always creates a NEW
// tournament, stamps the new tournament's id onto every imported row, and
// surfaces a rename field when the name clashes.

async function signInAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  // Setup-aware landing: the e2e fixture's "Default" tournament exists, so the
  // admin lands on Matches.
  await expect(page).toHaveURL(/\/matches$/)
}

/** Open the import dialog from the tournament selector's trailing entry. */
async function openImportDialog(page: import('@playwright/test').Page): Promise<void> {
  await page.getByLabel('Tournament').click()
  await page.getByRole('option', { name: /import tournament…/i }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** A minimal valid v2 seed whose ids are stable (the import remints them anyway). */
function seedJson(tournamentName: string): string {
  return JSON.stringify({
    seedVersion: 2,
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

test.describe('tournament import (selector dialog) → new tournament', () => {
  test('creates a new tournament, selects it, and its teams show in a scoped view', async ({
    page,
    request
  }) => {
    // Unique name per run so the happy path never clashes with a prior run.
    const name = `E2E Import ${Date.now()}`
    await signInAdmin(page)
    await openImportDialog(page)

    await page.getByLabel('Tournament JSON').fill(seedJson(name))
    await page.getByRole('button', { name: /parse & import/i }).click()
    await expect(page.getByText(/created —/)).toBeVisible()

    // The new tournament is auto-selected; its imported teams appear under
    // provisioning, each with its seeded manager email, not provisioned yet.
    await page.goto('/provision')
    // The selector reflects the freshly created + selected tournament (the app
    // bar repeats the name — take the first match).
    await expect(page.getByText(name).first()).toBeVisible()
    await expect(page.getByText('Importers', { exact: true })).toBeVisible()
    await expect(page.getByText('Rivals', { exact: true })).toBeVisible()
    await expect(page.getByText('importers@example.test')).toBeVisible()
    await expect(page.getByText('rivals@example.test')).toBeVisible()
    await expect(page.getByText('0 of 2 team(s) provisioned.')).toBeVisible()

    // Provision one manager through the dialog — correcting the seeded email
    // to a unique address while at it (a repeated run's createUser would
    // otherwise collide with the same address). Ticket #17.
    await page.getByRole('button', { name: 'Provision', exact: true }).first().click()
    const unique = `importer-${Date.now()}@example.test`
    await page.getByLabel('Manager email').fill(unique)
    await page.getByLabel('Initial password').fill('importer-pw-123')
    await page.getByRole('dialog').getByRole('button', { name: 'Provision' }).click()
    await expect(page.getByText(/Team Manager created for Importers/)).toBeVisible()
    await expect(page.getByText('1 of 2 team(s) provisioned.')).toBeVisible()

    // Cleanup: this tournament now owns a real auth account, so it goes through
    // the delete-tournament edge function (which clears manager accounts) —
    // repeated runs don't accumulate garbage.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const tourRes = await request.get(
      `${supabaseUrl}/rest/v1/tournaments?name=eq.${encodeURIComponent(name)}&select=id`,
      { headers: authHeaders(admin) }
    )
    const [mine] = (await tourRes.json()) as { id: string }[]
    if (mine) {
      const del = await request.post(`${supabaseUrl}/functions/v1/delete-tournament`, {
        headers: authHeaders(admin),
        data: { tournamentId: mine.id }
      })
      expect(del.status()).toBe(200)
    }
  })

  test('a clashing name blocks import and offers a rename that completes it', async ({
    page
  }) => {
    await signInAdmin(page)
    await openImportDialog(page)

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

  test('a v1 seed is rejected at the version gate with a re-export hint', async ({ page }) => {
    await signInAdmin(page)
    await openImportDialog(page)

    const v1 = JSON.parse(seedJson('E2E Old Seed'))
    v1.seedVersion = 1
    await page.getByLabel('Tournament JSON').fill(JSON.stringify(v1))
    await page.getByRole('button', { name: /parse & import/i }).click()

    await expect(page.getByText(/Unsupported seed version 1.*version 2/i)).toBeVisible()
    // Nothing was created.
    await expect(page.getByText(/created —/)).toHaveCount(0)
  })

  test('a v2 seed with a knockout bracket imports and its bracket view renders', async ({ page, request }) => {
    const name = `E2E KO Import ${Date.now()}`
    await signInAdmin(page)
    await openImportDialog(page)

    // The ko-import worked example: 6 qualifiers, draw of 8 — entry-round pool,
    // fed later rounds, bracket structure.
    const seed = {
      seedVersion: 2,
      tournamentName: name,
      startDate: '2098-01-01',
      categories: [{ id: 'KO', name: "Men's Team", shortName: 'KO' }],
      teams: [
        { id: 'KO|Kilo', name: 'Kilo', managerEmail: `kilo-${Date.now()}@example.test` },
        { id: 'KO|Lima', name: 'Lima', managerEmail: `lima-${Date.now()}@example.test` },
        { id: 'KO|Mike', name: 'Mike', managerEmail: `mike-${Date.now()}@example.test` },
        { id: 'KO|November', name: 'November', managerEmail: `november-${Date.now()}@example.test` },
        { id: 'KO|Oscar', name: 'Oscar', managerEmail: `oscar-${Date.now()}@example.test` },
        { id: 'KO|Papa', name: 'Papa', managerEmail: `papa-${Date.now()}@example.test` }
      ],
      players: [
        { id: 'KO|Kilo|k1', teamId: 'KO|Kilo', name: 'k1', gender: 'M', dateOfBirth: '1990-01-01' }
      ],
      ties: [
        { id: 'KO|g1', categoryId: 'KO', scheduledStart: '2098-01-01T10:00', group: 'A', round: '1', teamIds: ['KO|Kilo', 'KO|Lima'] },
        { id: 'KO|ko|QF|T2|2098-01-02T14:00', categoryId: 'KO', scheduledStart: '2098-01-02T14:00', table: 'T2', round: 'QF' },
        { id: 'KO|ko|QF|T3|2098-01-02T14:00', categoryId: 'KO', scheduledStart: '2098-01-02T14:00', table: 'T3', round: 'QF' },
        { id: 'KO|ko|SF|1', categoryId: 'KO', scheduledStart: '2098-01-02T16:00', table: 'T2', round: 'SF', fedBy: ['KO|ko|QF|1', 'KO|ko|QF|2'] },
        { id: 'KO|ko|SF|2', categoryId: 'KO', scheduledStart: '2098-01-02T16:00', table: 'T3', round: 'SF', fedBy: ['KO|ko|QF|3', 'KO|ko|QF|4'] },
        { id: 'KO|ko|F|1', categoryId: 'KO', scheduledStart: '2098-01-02T18:00', table: 'T1', round: 'F', fedBy: ['KO|ko|SF|1', 'KO|ko|SF|2'] }
      ],
      brackets: [
        {
          categoryId: 'KO',
          rounds: [
            { label: 'QF', slots: 4 },
            { label: 'SF', slots: 2, fedBy: [['KO|ko|QF|1', 'KO|ko|QF|2'], ['KO|ko|QF|3', 'KO|ko|QF|4']] },
            { label: 'F', slots: 1, fedBy: [['KO|ko|SF|1', 'KO|ko|SF|2']] }
          ]
        }
      ]
    }
    await page.getByLabel('Tournament JSON').fill(JSON.stringify(seed))
    await page.getByRole('button', { name: /parse & import/i }).click()
    await expect(page.getByText(/created —/)).toBeVisible()

    // The bracket view renders the imported structure: rounds, pool chips, slots.
    await page.goto('/bracket')
    await expect(page.getByText('QF').first()).toBeVisible()
    await expect(page.getByText(/Imported QF team matches/)).toBeVisible()
    await expect(page.getByText('T2 · 2098-01-02 14:00', { exact: false })).toBeVisible()

    // Cleanup (no managers provisioned): plain REST cascade delete.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const tourRes = await request.get(
      `${supabaseUrl}/rest/v1/tournaments?name=eq.${encodeURIComponent(name)}&select=id`,
      { headers: authHeaders(admin) }
    )
    const [mine] = (await tourRes.json()) as { id: string }[]
    if (mine) {
      const del = await request.delete(`${supabaseUrl}/rest/v1/tournaments?id=eq.${mine.id}`, {
        headers: authHeaders(admin)
      })
      expect(del.ok()).toBeTruthy()
    }
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
    await openImportDialog(page)

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
