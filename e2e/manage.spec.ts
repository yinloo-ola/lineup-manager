import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseAnonKey, supabaseUrl } from './helpers'
import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'

// Ticket #15: manage & delete tournaments. Renames via the edit dialog
// (uniqueness-checked), and deletes via the double-confirm dialog — exercising
// the real delete-tournament edge function (manager auth accounts removed) and
// the active-tournament fall-back. Uses its OWN throwaway tournament so the
// shared global-setup fixtures ("Default", "E2E Other") are never touched.
//
// CI runs against a fresh stack each time. For local re-runs after a partial
// run, reset first: `supabase db reset && npm run test:e2e`.

const TOUR_ID = 'e2e-mg-tour'
const TEAM_ID = 'e2e-mg-team'
const TOUR_NAME = 'E2E Manage'
const RENAMED = 'E2E Manage Renamed'
const MANAGER_EMAIL = 'manage-mgr@lineup.local'
const MANAGER_PASSWORD = 'manage-mgr-pw-123'

async function signInAdmin(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
  await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.describe.serial('manage & delete tournaments (#15)', () => {
  test.beforeAll(async ({ request }) => {
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    // (Re)create the throwaway tournament + team. Upsert-by-id converges any
    // prior partially-run state (e.g. a renamed-but-not-deleted tournament) back
    // to the canonical name, so the rename test always starts from TOUR_NAME.
    await request.post(`${supabaseUrl}/rest/v1/tournaments`, {
      headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates,return=minimal' },
      data: { id: TOUR_ID, name: TOUR_NAME }
    })
    await request.post(`${supabaseUrl}/rest/v1/teams`, {
      headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates,return=minimal' },
      data: { id: TEAM_ID, tournament_id: TOUR_ID, name: 'E2E Manage Team' }
    })
    // Provision a manager via the REAL edge function so delete-tournament has a
    // real auth account to remove (409 = already provisioned on a re-used stack).
    const prov = await request.post(`${supabaseUrl}/functions/v1/provision-manager`, {
      headers: authHeaders(admin),
      data: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD, teamId: TEAM_ID }
    })
    if (!prov.ok() && prov.status() !== 409) {
      throw new Error(`provision failed (${prov.status()}): ${await prov.text()}`)
    }
  })

  test('admin renames a tournament (uniqueness-checked) and sets its start date', async ({
    page
  }) => {
    await signInAdmin(page)
    await page.goto('/manage')
    await expect(page.getByRole('button', { name: `Edit ${TOUR_NAME}`, exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Edit ${TOUR_NAME}`, exact: true }).click()

    // Duplicate rejection: renaming to an existing sibling's name is blocked.
    await page.getByLabel('Tournament name').fill('Default')
    await expect(page.getByText('A tournament with that name already exists')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()

    // Rename + set the start date in the same dialog.
    await page.getByLabel('Tournament name').fill(RENAMED)
    await page.getByRole('textbox', { name: 'Start date' }).fill('2026-03-20')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // The list re-renders under the new name with the start date shown; the
    // old-named edit button is gone.
    await expect(page.getByRole('button', { name: `Edit ${RENAMED}`, exact: true })).toBeVisible()
    await expect(
      page.getByText(`Start date: Mar 20, 2026`, { exact: false })
    ).toBeVisible()
    await expect(page.getByRole('button', { name: `Edit ${TOUR_NAME}`, exact: true })).toHaveCount(0)
  })

  test('admin deletes a tournament — cascade + manager lock-out + fall-back', async ({
    request,
    page
  }) => {
    // Sanity: the manager can authenticate before the delete.
    const before = await apiToken(request, MANAGER_EMAIL, MANAGER_PASSWORD).catch(() => null)
    expect(before).not.toBeNull()

    await signInAdmin(page)

    // Make the soon-to-be-deleted tournament the ACTIVE one, so fall-back is exercised.
    await page.goto('/manage')
    await page.getByRole('combobox', { name: 'Tournament' }).click({ force: true })
    await page.getByRole('option', { name: RENAMED, exact: true }).click()

    // Open the delete dialog and complete the double-confirm gate.
    await page.getByRole('button', { name: `Delete ${RENAMED}`, exact: true }).click()
    await expect(page.getByText(/all team manager accounts/i)).toBeVisible()
    await page.getByLabel(/I understand this cannot be recovered/i).check()
    await page.getByLabel(`Type ${RENAMED} to confirm`).fill(RENAMED)
    await page.getByRole('button', { name: 'Delete tournament', exact: true }).click()

    // Removed from the management list.
    await expect(page.getByRole('button', { name: `Delete ${RENAMED}`, exact: true })).toHaveCount(0)

    // The manager can no longer sign in — the edge function removed the account.
    const after = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
      data: { email: MANAGER_EMAIL, password: MANAGER_PASSWORD }
    })
    expect(after.ok()).toBeFalsy()

    // The tournament row is gone server-side.
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
    const res = await request.get(`${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}&select=id`, {
      headers: authHeaders(admin)
    })
    expect((await res.json()) as unknown[]).toEqual([])

    // Its child rows cascaded away — asserted directly (the fixture's team), not
    // just transitively via the delete having succeeded.
    const teams = await request.get(
      `${supabaseUrl}/rest/v1/teams?tournament_id=eq.${TOUR_ID}&select=id`,
      { headers: authHeaders(admin) }
    )
    expect((await teams.json()) as unknown[]).toEqual([])

    // Active fell back to another tournament: Default's lineup (Alpha) is visible.
    await page.goto('/admin/lineups')
    await expect(page.getByText('Alpha')).toBeVisible()
  })
})
