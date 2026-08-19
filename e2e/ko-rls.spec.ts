import { test, expect } from '@playwright/test'
import { apiToken, authHeaders, supabaseUrl } from './helpers'
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_MANAGER3_EMAIL,
  TEST_MANAGER3_NEW_PASSWORD
} from './global-setup'

// ko-import #15 / spec §8 — RLS lock-ins on the knockout model, all at the
// REST level with specific error codes (house convention). Uses the isolated
// E2E Knockout RLS category: an empty slot row, a scheduled pool row, and a
// group tie putting e2e-ka (manager3's team) in the category. The spec
// converges its own rows at the end so re-runs start pristine.

const SLOT = 'e2e-korls-slot'
const POOL = 'e2e-korls-pool'

test.describe('knockout RLS (null sides, landing, lineup membership)', () => {
  test('a null-side knockout row is invisible until the team lands on it', async ({ request }) => {
    const manager = await apiToken(request, TEST_MANAGER3_EMAIL, TEST_MANAGER3_NEW_PASSWORD)
    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)

    // Converge: the slot starts empty (null sides) — manager3 must NOT see it
    // or the pool row, while the group tie (ka vs kb) IS visible.
    await request.patch(`${supabaseUrl}/rest/v1/ties?id=eq.${SLOT}`, {
      headers: authHeaders(admin),
      data: { team_a: null, team_b: null, winner_side: null, placed_match_id: null }
    })

    const visible = await request.get(
      `${supabaseUrl}/rest/v1/ties?category_id=eq.e2e-cat-ko-rls&select=id`,
      { headers: authHeaders(manager) }
    )
    const rows = (await visible.json()) as { id: string }[]
    expect(rows.map((r) => r.id)).toContain('e2e-korls-g1')
    expect(rows.map((r) => r.id)).not.toContain(SLOT)
    expect(rows.map((r) => r.id)).not.toContain(POOL)

    // The manager's lineup write to the unscheduled slot must also fail at the
    // tightened membership policy (their team is not on the tie): error 42501.
    const phantom = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
      headers: authHeaders(manager),
      data: {
        tournament_id: 'default',
        tie_id: SLOT,
        team_id: 'e2e-ka',
        player_ids: [[]],
        status: 'draft'
      }
    })
    // PostgREST signals RLS with-check violations as 403/400 carrying code 42501.
    expect([400, 403]).toContain(phantom.status())
    expect((await phantom.json()).code).toBe('42501')

    // The team lands (admin enters it): the slot becomes visible immediately.
    await request.patch(`${supabaseUrl}/rest/v1/ties?id=eq.${SLOT}`, {
      headers: authHeaders(admin),
      data: { team_a: 'e2e-ka' }
    })
    const after = await request.get(
      `${supabaseUrl}/rest/v1/ties?category_id=eq.e2e-cat-ko-rls&select=id`,
      { headers: authHeaders(manager) }
    )
    const afterRows = (await after.json()) as { id: string }[]
    expect(afterRows.map((r) => r.id)).toContain(SLOT)
    // The pool row stays invisible — no side of it holds the team.
    expect(afterRows.map((r) => r.id)).not.toContain(POOL)

    // Positive control: now that the team occupies a side, the same lineup
    // write succeeds (the unscheduled slot never locks).
    const legit = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
      headers: authHeaders(manager),
      data: {
        tournament_id: 'default',
        tie_id: SLOT,
        team_id: 'e2e-ka',
        player_ids: [[]],
        status: 'draft'
      }
    })
    expect(legit.ok()).toBeTruthy()

    // Converge for the re-run: land the team back off the slot and clear the
    // lineup (the global-setup upserts re-assert the rest on next run).
    await request.delete(`${supabaseUrl}/rest/v1/lineups?tie_id=eq.${SLOT}&team_id=eq.e2e-ka`, {
      headers: authHeaders(admin)
    })
    await request.patch(`${supabaseUrl}/rest/v1/ties?id=eq.${SLOT}`, {
      headers: authHeaders(admin),
      data: { team_a: null, winner_side: null }
    })
  })
})
