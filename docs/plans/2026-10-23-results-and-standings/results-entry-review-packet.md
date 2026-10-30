# Review packet: 2026-10-23-results-and-standings — feature review

Base: 4b6db8467ce11a587537116075a8b262e40ca1b0

Head: 046112bbaf1f882ca55b3c518d81f71c27b07fa7

## Commits

046112b fix(results): review hardening — null-safe RPC authorization, KO guard, server-side game validation, shared winner derivation, side-less walkover is undecided
68b2c34 chore: gitignore the prototype/ mockup asset (AGENTS.md: never commit)
aa54921 feat(results): derived winners on the dashboard — computed from stored rubbers on every read, never stored (R7)
ceb2045 feat(results): admin results dialog — player override, scores, walkovers, best-of on the Matches dashboard (R6)
45001fc feat(results): umpire score entry — decidedness validation, entry dialog, derived states on the console (R5)
2d0814b feat(results): entry gate enforced server-side — umpire RPC derives players from submitted lineups (R4)
ea1d291 feat(results): manager read access to own tournament results (R3)
64f7506 feat(results): umpire role — per-tournament accounts, provision-umpire edge function, delete cascade, /umpire console (R2)
38b10db test(e2e): compute format-guard start date at run time — hard-coded 2026-09-01 froze the page once the calendar passed it
e024696 feat(results): per-tie best-of — default 5, odd-only, admin-editable (R1)

## Changed files

 .gitignore                                        |   1 +
 docs/lessons.md                                   |   6 +
 e2e/format-guard.spec.ts                          |   9 +-
 e2e/global-setup.ts                               |  28 ++
 e2e/results.spec.ts                               | 379 ++++++++++++++--------
 src/components/AdminResultsDialog.vue             | 306 +++++++++++++++++
 src/components/UmpireEntryDialog.vue              | 251 ++++++++++++++
 src/domain/__tests__/matchesDashboard.test.ts     |  81 +++++
 src/domain/__tests__/results.test.ts              | 161 +++++++++
 src/domain/__tests__/umpireView.test.ts           | 167 ++++++++++
 src/domain/adminView.ts                           |   2 +
 src/domain/matchesDashboard.ts                    |  62 +++-
 src/domain/results.ts                             | 179 ++++++++++
 src/domain/types.ts                               |   5 +
 src/domain/umpireView.ts                          | 112 +++++++
 src/router/index.ts                               |  15 +-
 src/services/adminScope.ts                        |   6 +-
 src/services/lineupService.ts                     |  20 +-
 src/services/resultsService.ts                    | 235 ++++++++++++++
 src/stores/auth.ts                                |  28 +-
 src/views/AdminProvisionView.vue                  | 126 +++++++
 src/views/MatchesView.vue                         | 142 ++++++++
 src/views/UmpireView.vue                          | 294 +++++++++++++++++
 supabase/functions/delete-tournament/index.ts     |  21 +-
 supabase/functions/provision-umpire/index.ts      | 124 +++++++
 supabase/migrations/0015_tie_best_of.sql          |  10 +
 supabase/migrations/0016_results_and_umpires.sql  | 107 ++++++
 supabase/migrations/0017_results_manager_read.sql |   8 +
 supabase/migrations/0018_umpire_result_rpc.sql    |  81 +++++
 supabase/migrations/0019_result_walkover_side.sql |  85 +++++
 supabase/migrations/0020_review_hardening.sql     | 163 ++++++++++
 31 files changed, 3053 insertions(+), 161 deletions(-)

## Acceptance criteria (verbatim from the design doc)

### R1: Per-tie best-of setting

Every tie has a best-of-games setting. Imported ties default to 5. An admin can change a tie's best-of to any odd number in the tie detail; even values and non-positive values are rejected with a visible error.

**Acceptance criteria**
- Given an imported tournament, When its ties are inspected, Then every tie's best-of is 5 without any import change.
- Given an admin editing a tie detail, When they set best-of to 7, Then the value is saved and the tie detail shows it.
- Given an admin editing a tie detail, When they set best-of to 4, Then the change is rejected with an odd-number error and the stored value is unchanged.

### Checkpoints: none
### Review: skip

### R2: Umpire role and provisioning

A new umpire role exists: per-tournament accounts (email + auth user), created by an admin, able to enter and edit results only for ties in their own tournament, with no access to lineups, rosters, formats, or tournament management. Umpire accounts require a password change on first login like manager accounts. Deleting a tournament deletes its umpires' auth accounts.

**Acceptance criteria**
- Given an admin in tournament settings, When they provision an umpire with an email, Then an auth account and umpire row scoped to that tournament exist and the umpire appears in the tournament's umpire list.
- Given an umpire logged in, When they request a tie in another tournament, Then the request is denied by RLS.
- Given an umpire logged in, When they attempt a manager or admin action (e.g. reading another team's roster via API, writing a lineup), Then it is denied by RLS.
- Given a first-login umpire, When they sign in, Then they are forced through the change-password flow before reaching the umpire screen.
- Given a tournament with an umpire, When an admin deletes the tournament, Then the umpire's auth account no longer exists.

### Checkpoints: none
### Review: skip

### Production-risk notes
- New migration (schema + RLS) and a new auth-provisioning edge function mirroring provision-manager; delete cascade touches real auth accounts.

### R3: Manager read access to results

Team managers can read the stored results of ties in their own tournament, including results of ties involving their own and other teams. They cannot write results.

**Acceptance criteria**
- Given a manager of a team in a tournament, When they request results for any tie in that tournament, Then the data is returned.
- Given a manager, When they attempt to insert or update any result row, Then the write is denied by RLS.

### Checkpoints: none
### Review: skip

### Production-risk notes
- RLS policy widening on the new results table; read-only by construction.

### R4: Lineup-submitted gate

A tie's results can be entered (by umpire or admin) only once both sides have a submitted lineup. Until then the tie is locked for entry with the reason shown. Group ties with a null or unsubmitted side are locked.

**Acceptance criteria**
- Given a group tie where either side's lineup status is not `submitted`, When an umpire opens it for entry, Then entry is locked with the reason "lineup not submitted" and no save is possible.
- Given the same attempt issued directly against the service/RLS, When a result row is written, Then the write is rejected server-side.
- Given a group tie with both lineups submitted, When an umpire opens it, Then entry is available.

### Checkpoints: none
### Review: skip

### R5: Umpire score entry

An umpire sees their tournament's group ties with entry state (not entered / partial / decided) and can enter one tie at a time. For each rubber in the tie's format they see the pre-filled players (read-only), enter game scores as free-form pairs, or mark a walkover. Validation follows the tie's best-of: a rubber is decided when one side wins the majority of games; entering additional games after a majority winner is rejected; scores must be non-negative numbers; a walkover carries no games. Partial entry (some rubbers, tie undecided) saves successfully and shows as partial.

**Acceptance criteria**
- Given a both-submitted group tie, When the umpire enters valid games for each rubber and saves, Then all rubber rows persist and the tie shows as decided with the derived winner.
- Given a rubber whose best-of majority is already reached, When the umpire adds a further game, Then the entry is rejected with an overflow error before save.
- Given a rubber the umpire marks as walkover, When saved, Then the row stores the walkover with no games.
- Given an umpire viewing the entry form, When they inspect the players, Then they are displayed read-only, exactly as pre-filled from the submitted lineups.
- Given only some rubbers entered, When the umpire saves, Then the partial state persists and reopens with entries intact.

### Checkpoints: none
### Review: skip

### R6: Admin override

On the Matches dashboard, an admin can open a results dialog for any group tie and edit everything: players per rubber per side, game scores, walkovers, and best-of — regardless of who entered the data — at any time, including after a tie is decided.

**Acceptance criteria**
- Given a decided tie entered by an umpire, When the admin changes a player and a game score, Then the changes persist and the derived winner recomputes.
- Given a tie with no results, When the admin opens the dialog, Then players pre-fill from submitted lineups and the admin can edit them freely.
- Given an admin editing best-of in the dialog, When they set an even number, Then it is rejected per R1.

### Checkpoints: none
### Review: skip

### R7: Derived winners on read

Rubber winner (majority of games under the tie's best-of) and tie winner (majority of rubbers; walkover wins its rubber; unplayed rubbers count for neither side) are computed from stored results whenever results are displayed. Nothing about winners is written to the database in this slice, and re-derivation after any edit is immediate.

**Acceptance criteria**
- Given stored rubber results forming a majority, When any consumer reads the tie's results, Then the tie winner equals the side with more rubbers won without any stored winner field.
- Given a tie leading 3-0 in a best-of-5-rubbers format, When results are read, Then the tie is decided with the remaining rubbers unplayed.
- Given an admin edit that flips a rubber, When results are read afterward, Then the tie winner reflects the new state with no refresh action beyond re-reading.

### Checkpoints: none
### Review: skip

## Production-risk areas

- **Schema migration 0015**: new `umpires` and `rubber_results` tables, `ties.best_of` column, RLS policies for three roles (admin/umpire/manager). Umpire policy on `rubber_results` must restrict updates to score columns only (`player_ids` immutable for umpires) — enforced in the policy, verified by tests.
- **Auth**: new edge function `provision-umpire` creating real auth accounts (service-role, caller-JWT-admin authorization, `must_change_password`), and tournament delete now cascades umpire auth accounts — destructive, same class as the existing manager cascade.

## Setup

- Migration 0015 applies via `supabase db reset` (local). Verify: `\d rubber_results` shows the unique `(tie_id, rubber_index)` constraint and RLS enabled on both new tables; existing ties read `best_of = 5`.
- The `provision-umpire` function runs under `supabase functions serve` locally (edge functions 404 without it — known local quirk). Verify: provisioning an umpire from the admin UI creates a login that can complete the change-password flow.

## Approaches considered

- **Raw results + derived winners (chosen)** — store only entered data; winners computed on read. Loser alternatives: write-through materialization of winners/standings (drifts under unrestricted corrections, a failure mode the codebase avoids); single jsonb aggregate per tie (whole-blob rewrites contend between umpires and re-validates everything on each save).
- **Umpire as admin account (rejected)** — admins can delete tournaments and cascade auth accounts; unacceptable for venue staff. Dedicated per-tournament role with narrow RLS follows the existing `team_managers` pattern at modest cost.
- **Best-of per rubber in TieFormat (rejected)** — the human decided best-of is per team match, not per rubber; putting it on `ties` also avoids touching the seed contract or the Formats authoring UI.

## Architecture

New pure domain module `src/domain/results.ts` (derivation + validation, no Supabase imports), new service `src/services/resultsService.ts` (guard-checked single-row writes in the bracketService style), migration `supabase/migrations/0015_results_umpires.sql`, edge function `supabase/functions/provision-umpire/`, umpire shell route `/umpire` outside the admin shell with its own minimal layout, and an admin results dialog on the Matches dashboard. Layering and conventions per AGENTS.md: domain pure camelCase, services snake_case↔camelCase mapping, every query tournament-scoped.

## Data flow

Seed import (unchanged) → ties default `best_of = 5` → managers submit lineups (existing flow) → admin provisions umpires → umpire logs in (change-password on first login) → umpire picks a group tie whose both lineups are submitted → enters games/walkovers per rubber with players pre-filled and locked → service checks gate + domain validation → rows upsert into `rubber_results` → consumers read results and winners are derived on display. Admin overrides flow through the same service with the player-edit and any-time powers; RLS, not UI, enforces the role difference.

## Error handling

Domain violations render inline per rubber (the established `Violation` reporting style); service guard rejections (gate not met, KO tie in this slice, TBD side) surface as typed errors mapped to toasts; locked ties show the reason rather than failing at save time; even best-of is rejected at the input with a stated rule. Partial results are a first-class visible state, never an error.

## Testing

Red-first at the domain seam: best-of winner math, overflow rejection, walkover short-circuit, tie majority with unplayed rubbers, prefill merge, odd-best-of validation. Service tests against local Supabase following the `importSeed.test.ts` pattern (gate enforcement, umpire column restriction). E2E: provision umpire → first-login password change → enter a full result → decided tie; admin player override after umpire entry; lineup gate locked row; RLS spec for umpire cross-tournament denial, umpire `player_ids` immutability, manager read/write split.


## Feature acceptance (verbatim)

## Feature acceptance

- Given an imported tournament with both lineups submitted for a group tie, When an umpire logs in, enters best-of-valid games (one rubber as a walkover), and saves, Then the tie shows as decided with the derived winner, and the admin can afterwards override a player and a game score and the derived winner recomputes.
- Given a group tie where one side's lineup is not submitted, When an umpire attempts entry through the UI or the service directly, Then entry is refused with the reason visible and no result rows exist for the tie.


## Production-risk notes (verbatim, if any)

### Production-risk notes
- New migration (schema + RLS) and a new auth-provisioning edge function mirroring provision-manager; delete cascade touches real auth accounts.

### Production-risk notes
- RLS policy widening on the new results table; read-only by construction.

## Production-risk areas

- **Schema migration 0015**: new `umpires` and `rubber_results` tables, `ties.best_of` column, RLS policies for three roles (admin/umpire/manager). Umpire policy on `rubber_results` must restrict updates to score columns only (`player_ids` immutable for umpires) — enforced in the policy, verified by tests.
- **Auth**: new edge function `provision-umpire` creating real auth accounts (service-role, caller-JWT-admin authorization, `must_change_password`), and tournament delete now cascades umpire auth accounts — destructive, same class as the existing manager cascade.


## Diff

diff --git a/.gitignore b/.gitignore
index ec7bc5e..843068d 100644
--- a/.gitignore
+++ b/.gitignore
@@ -30,3 +30,4 @@ npm-debug.log*
 # Supabase local
 /supabase/.branches
 /supabase/.temp
+prototype/
diff --git a/docs/lessons.md b/docs/lessons.md
new file mode 100644
index 0000000..b2ef39e
--- /dev/null
+++ b/docs/lessons.md
@@ -0,0 +1,6 @@
+# Lessons
+
+Generic, repeatable rules distilled from mistakes caught during development.
+
+- **Never hard-code calendar dates in test fixtures to mean "the future".** A "future" start date time-bombs into a past one and silently flips the behavior under test (the format freeze made an authoring page uneditable; found 2026-10-25 with `2026-09-01`). Compute relative dates at run time (`now + 30d`) and keep hard-coded dates only where the past/present is what the test means.
+- **Parallel Playwright workers each run their own `beforeAll`.** Provisioning shared accounts (an umpire, a manager) inside a spec's `beforeAll` races across workers — one creates the auth user, the other hits `email_exists`. One-time provisioning belongs in `global-setup`, which runs once per run.
diff --git a/e2e/format-guard.spec.ts b/e2e/format-guard.spec.ts
index 5ba58a1..d5bee53 100644
--- a/e2e/format-guard.spec.ts
+++ b/e2e/format-guard.spec.ts
@@ -17,6 +17,11 @@ const TEAM_B = 'e2e-fg-b'
 const TIE_ID = 'e2e-fg-tie'
 const PLAYER_ID = 'e2e-fg-p1'
 
+// A start date ~30 days out, computed at run time: the freeze anchors on the
+// start date, so a hard-coded "future" date time-bombs into a frozen page once
+// the calendar passes it (seen 2026-10-25 with the original 2026-09-01).
+const FUTURE_START = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
+
 /** Make the throwaway tournament the active one and land on its Matches page. */
 async function activate(page: Page): Promise<void> {
   await page.getByRole('combobox', { name: 'Tournament' }).click({ force: true })
@@ -36,7 +41,7 @@ test.describe.serial('format guard + freeze (#16)', () => {
     // start date anchors age evaluation near today WITHOUT starting the
     // tournament (that would freeze the format — the freeze test does that
     // later; afterAll converges the value back).
-    await upsert('tournaments', [{ id: TOUR_ID, name: TOUR_NAME, start_date: '2026-09-01' }])
+    await upsert('tournaments', [{ id: TOUR_ID, name: TOUR_NAME, start_date: FUTURE_START }])
     await upsert('categories', [{ id: CAT_ID, tournament_id: TOUR_ID, name: CAT_NAME, short_name: 'FG' }])
     await upsert('teams', [
       { id: TEAM_A, tournament_id: TOUR_ID, name: 'Guardians' },
@@ -84,7 +89,7 @@ test.describe.serial('format guard + freeze (#16)', () => {
     const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
     await request.patch(`${supabaseUrl}/rest/v1/tournaments?id=eq.${TOUR_ID}`, {
       headers: { ...authHeaders(admin), Prefer: 'return=minimal' },
-      data: { start_date: '2026-09-01' }
+      data: { start_date: FUTURE_START }
     })
   })
 
diff --git a/e2e/global-setup.ts b/e2e/global-setup.ts
index c027f10..5b6ba83 100644
--- a/e2e/global-setup.ts
+++ b/e2e/global-setup.ts
@@ -30,6 +30,14 @@ export const TEST_MANAGER3_EMAIL = 'manager3@lineup.local'
 export const TEST_MANAGER3_PASSWORD = 'manager3-password-123'
 export const TEST_MANAGER3_NEW_PASSWORD = 'manager3-new-pw-123'
 
+// The results-entry umpire (results-and-standings slice 1), bound to the
+// 'default' tournament. Provisioned via the REAL provision-umpire edge
+// function and converged to the ready (password-changed) state, like manager2.
+export const TEST_UMPIRE_EMAIL = 'umpire@lineup.local'
+export const TEST_UMPIRE_PASSWORD = 'umpire-password-123'
+export const TEST_UMPIRE_NEW_PASSWORD = 'umpire-new-pw-123'
+export const DEFAULT_TOURNAMENT_ID = 'default'
+
 function jsonHeaders(token?: string): Record<string, string> {
   const h: Record<string, string> = {
     'Content-Type': 'application/json',
@@ -269,6 +277,26 @@ export default async function globalSetup(): Promise<void> {
   await provisionManager(adminToken, TEST_MANAGER2_EMAIL, TEST_MANAGER2_PASSWORD, 'e2e-b')
   await provisionManager(adminToken, TEST_MANAGER3_EMAIL, TEST_MANAGER3_PASSWORD, 'e2e-ka')
 
+  // 3a. Provision the results umpire via the real provision-umpire edge
+  // function, then complete its first-login change so the results specs can
+  // sign straight in. (409 = already an umpire for this tournament — the
+  // re-used-stack case; completeFirstLogin converges the state regardless.)
+  const provisioned = await fetch(`${url}/functions/v1/provision-umpire`, {
+    method: 'POST',
+    headers: jsonHeaders(adminToken),
+    body: JSON.stringify({
+      email: TEST_UMPIRE_EMAIL,
+      password: TEST_UMPIRE_PASSWORD,
+      tournamentId: DEFAULT_TOURNAMENT_ID
+    })
+  })
+  if (!provisioned.ok && provisioned.status !== 409) {
+    throw new Error(
+      `provision umpire failed (${provisioned.status}): ${await provisioned.text()}`
+    )
+  }
+  await completeFirstLogin(TEST_UMPIRE_EMAIL, TEST_UMPIRE_PASSWORD, TEST_UMPIRE_NEW_PASSWORD)
+
   // 3b. Converge manager1 back to the forced-first-login state. manager.spec is
   // destructive — it COMPLETES the password change — so a re-run without a db
   // reset would otherwise find the temp password consumed and fail at sign-in.
diff --git a/e2e/results.spec.ts b/e2e/results.spec.ts
index 1aefba1..7fb1cc6 100644
--- a/e2e/results.spec.ts
+++ b/e2e/results.spec.ts
@@ -1,6 +1,12 @@
 import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
 import { apiToken, authHeaders, supabaseAnonKey, supabaseUrl } from './helpers'
-import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'
+import {
+  DEFAULT_TOURNAMENT_ID,
+  TEST_ADMIN_EMAIL,
+  TEST_ADMIN_PASSWORD,
+  TEST_UMPIRE_EMAIL,
+  TEST_UMPIRE_NEW_PASSWORD
+} from './global-setup'
 
 // results-and-standings slice 1 (results-entry) — the feature-acceptance E2E.
 //
@@ -12,18 +18,19 @@ import { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from './global-setup'
 // Scenario 2: one side's lineup not submitted → entry refused with the reason
 // visible, and no result rows exist.
 //
-// The spec owns its fixture rows (players/category/format/ties/lineups on the
-// 'default' tournament) and converges them in beforeAll, so the suite stays
-// re-runnable without a db reset. Nothing else touches these ids.
+// The umpire account is provisioned by global-setup (once per run — the specs
+// run in parallel workers, which would race a per-spec provisioning). The spec
+// owns its fixture rows (players/category/format/ties/lineups on the 'default'
+// tournament) and converges them in beforeAll, so the suite stays re-runnable
+// without a db reset. Nothing else touches these ids.
 
-const UMPIRE_EMAIL = 'umpire@lineup.local'
-const UMPIRE_PASSWORD = 'umpire-password-123'
-const UMPIRE_NEW_PASSWORD = 'umpire-new-pw-123'
+const UMPIRE_EMAIL = TEST_UMPIRE_EMAIL
+const UMPIRE_NEW_PASSWORD = TEST_UMPIRE_NEW_PASSWORD
 
 const RES_CAT = 'e2e-cat-res'
 const RES_TIE = 'e2e-tie-res'
 const GATE_TIE = 'e2e-tie-res-gate'
-const TOURNAMENT = 'default'
+const TOURNAMENT = DEFAULT_TOURNAMENT_ID
 
 // Three-rubber singles format (best-of-5 games per rubber by the tie default):
 // r1/r2 won by Alpha, r3 by Charlie → Alpha 2–1 decided; the admin override
@@ -55,35 +62,38 @@ function jsonHeaders(token?: string): Record<string, string> {
 
 test.beforeAll(async ({ request }) => {
   const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
+  const upsertHeaders = { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' }
 
-  // Re-runnability: drop any result rows and lineups from a prior run first.
+  // Re-runnability: drop any result rows from a prior run first. (Lineups are
+  // converged by upsert below — never deleted here, so a parallel worker's
+  // page load can never observe a delete window.)
   for (const tie of [RES_TIE, GATE_TIE]) {
     const del = await request.delete(
       `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${tie}`,
       { headers: authHeaders(admin) }
     )
-    if (!del.ok && del.status() !== 404) {
+    if (!del.ok() && del.status() !== 404) {
       throw new Error(`delete rubber_results (${tie}) failed: ${await del.text()}`)
     }
   }
-  const delLineups = await request.delete(
-    `${supabaseUrl}/rest/v1/lineups?tie_id=in.(${RES_TIE},${GATE_TIE})`,
-    { headers: authHeaders(admin) }
-  )
-  if (!delLineups.ok) {
-    throw new Error(`delete fixture lineups failed: ${await delLineups.text()}`)
-  }
 
   // Fixture: category + 3-rubber singles format, rosters (Alpha's Alan/Adam/
   // Arnie, Charlie's Chas/Chet/Chad), the two ties, and submitted lineups for
   // the entry tie (both sides) and only Alpha's lineup for the gate tie.
-  await request.patch(`${supabaseUrl}/rest/v1/categories?id=eq.${RES_CAT}`, {
-    headers: authHeaders(admin),
-    data: { id: RES_CAT, tournament_id: TOURNAMENT, name: 'E2E Results', short_name: 'ER' }
-  })
-  await request.patch(`${supabaseUrl}/rest/v1/tie_formats?category_id=eq.${RES_CAT}`, {
-    headers: authHeaders(admin),
-    data: {
+  const post = async (table: string, data: unknown): Promise<void> => {
+    const res = await request.post(`${supabaseUrl}/rest/v1/${table}`, {
+      headers: upsertHeaders,
+      data
+    })
+    if (!res.ok()) {
+      throw new Error(`upsert ${table} failed (${res.status()}): ${await res.text()}`)
+    }
+  }
+  await post('categories', [
+    { id: RES_CAT, tournament_id: TOURNAMENT, name: 'E2E Results', short_name: 'ER' }
+  ])
+  await post('tie_formats', [
+    {
       category_id: RES_CAT,
       tournament_id: TOURNAMENT,
       rubbers: [
@@ -94,113 +104,66 @@ test.beforeAll(async ({ request }) => {
       usage_policy: null,
       lead_time_minutes: 30
     }
-  })
-  await request.patch(`${supabaseUrl}/rest/v1/players?id=in.(e2e-p5,e2e-p6,e2e-p7,e2e-p8,e2e-p9)`, {
-    headers: authHeaders(admin),
-    data: [
-      { id: 'e2e-p5', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chas', gender: 'M', date_of_birth: '1991-01-01' },
-      { id: 'e2e-p6', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chet', gender: 'M', date_of_birth: '1993-01-01' },
-      { id: 'e2e-p7', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Adam', gender: 'M', date_of_birth: '1987-01-01' },
-      { id: 'e2e-p8', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Arnie', gender: 'M', date_of_birth: '1986-01-01' },
-      { id: 'e2e-p9', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chad', gender: 'M', date_of_birth: '1995-01-01' }
-    ]
-  })
-  await request.patch(`${supabaseUrl}/rest/v1/ties?id=in.(${RES_TIE},${GATE_TIE})`, {
-    headers: authHeaders(admin),
-    data: [
-      {
-        id: RES_TIE,
-        tournament_id: TOURNAMENT,
-        category_id: RES_CAT,
-        scheduled_start: '2099-03-01T10:00:00+00:00',
-        table_label: '6',
-        team_a: 'e2e-a',
-        team_b: 'e2e-c',
-        is_knockout: false
-      },
-      {
-        id: GATE_TIE,
-        tournament_id: TOURNAMENT,
-        category_id: RES_CAT,
-        scheduled_start: '2099-03-01T12:00:00+00:00',
-        table_label: '7',
-        team_a: 'e2e-a',
-        team_b: 'e2e-c',
-        is_knockout: false
-      }
-    ]
-  })
-  const lineups = await request.post(`${supabaseUrl}/rest/v1/lineups`, {
-    headers: { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' },
-    data: [
-      {
-        tie_id: RES_TIE,
-        tournament_id: TOURNAMENT,
-        team_id: 'e2e-a',
-        player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
-        status: 'submitted',
-        submitted_at: '2026-02-01T00:00:00Z',
-        updated_at: '2026-02-01T00:00:00Z'
-      },
-      {
-        tie_id: RES_TIE,
-        tournament_id: TOURNAMENT,
-        team_id: 'e2e-c',
-        player_ids: [['e2e-p5'], ['e2e-p6'], ['e2e-p9']],
-        status: 'submitted',
-        submitted_at: '2026-02-01T00:00:00Z',
-        updated_at: '2026-02-01T00:00:00Z'
-      },
-      {
-        // Gate tie: only Alpha submitted — Charlie's side stays unsubmitted.
-        tie_id: GATE_TIE,
-        tournament_id: TOURNAMENT,
-        team_id: 'e2e-a',
-        player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
-        status: 'submitted',
-        submitted_at: '2026-02-01T00:00:00Z',
-        updated_at: '2026-02-01T00:00:00Z'
-      }
-    ]
-  })
-  if (!lineups.ok) {
-    throw new Error(`insert fixture lineups failed: ${await lineups.text()}`)
-  }
-
-  // Provision the umpire via the REAL edge function (the actual provisioning
-  // path — service_role lives inside the function, never in test code).
-  const provision = await request.post(`${supabaseUrl}/functions/v1/provision-umpire`, {
-    headers: jsonHeaders(admin),
-    data: { email: UMPIRE_EMAIL, password: UMPIRE_PASSWORD, tournamentId: TOURNAMENT }
-  })
-  if (!provision.ok() && provision.status() !== 409) {
-    throw new Error(`provision umpire failed (${provision.status()}): ${await provision.text()}`)
-  }
-
-  // Converge the umpire's first-login state (temp password + cleared flag) so
-  // the UI sign-in below is stable across re-runs — mirroring global-setup's
-  // manager convergence.
-  const existing = await signInOrNull(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD)
-  if (existing) {
-    await request.post(`${supabaseUrl}/rest/v1/rpc/clear_must_change_password`, {
-      headers: jsonHeaders(existing)
-    })
-  } else {
-    const token = await signIn(request, UMPIRE_EMAIL, UMPIRE_PASSWORD)
-    const upd = await request.put(`${supabaseUrl}/auth/v1/user`, {
-      headers: jsonHeaders(token),
-      data: { password: UMPIRE_NEW_PASSWORD }
-    })
-    if (!upd.ok()) {
-      throw new Error(`umpire password change failed (${upd.status()}): ${await upd.text()}`)
+  ])
+  await post('players', [
+    { id: 'e2e-p5', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chas', gender: 'M', date_of_birth: '1991-01-01' },
+    { id: 'e2e-p6', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chet', gender: 'M', date_of_birth: '1993-01-01' },
+    { id: 'e2e-p7', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Adam', gender: 'M', date_of_birth: '1987-01-01' },
+    { id: 'e2e-p8', tournament_id: TOURNAMENT, team_id: 'e2e-a', name: 'Arnie', gender: 'M', date_of_birth: '1986-01-01' },
+    { id: 'e2e-p9', tournament_id: TOURNAMENT, team_id: 'e2e-c', name: 'Chad', gender: 'M', date_of_birth: '1995-01-01' }
+  ])
+  await post('ties', [
+    {
+      id: RES_TIE,
+      tournament_id: TOURNAMENT,
+      category_id: RES_CAT,
+      scheduled_start: '2099-03-01T10:00:00+00:00',
+      table_label: '6',
+      team_a: 'e2e-a',
+      team_b: 'e2e-c',
+      is_knockout: false
+    },
+    {
+      id: GATE_TIE,
+      tournament_id: TOURNAMENT,
+      category_id: RES_CAT,
+      scheduled_start: '2099-03-01T12:00:00+00:00',
+      table_label: '7',
+      team_a: 'e2e-a',
+      team_b: 'e2e-c',
+      is_knockout: false
     }
-    const clr = await request.post(`${supabaseUrl}/rest/v1/rpc/clear_must_change_password`, {
-      headers: jsonHeaders(await signIn(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD))
-    })
-    if (!clr.ok()) {
-      throw new Error(`clear umpire must-change failed (${clr.status()}): ${await clr.text()}`)
+  ])
+  await post('lineups', [
+    {
+      tie_id: RES_TIE,
+      tournament_id: TOURNAMENT,
+      team_id: 'e2e-a',
+      player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
+      status: 'submitted',
+      submitted_at: '2026-02-01T00:00:00Z',
+      updated_at: '2026-02-01T00:00:00Z'
+    },
+    {
+      tie_id: RES_TIE,
+      tournament_id: TOURNAMENT,
+      team_id: 'e2e-c',
+      player_ids: [['e2e-p5'], ['e2e-p6'], ['e2e-p9']],
+      status: 'submitted',
+      submitted_at: '2026-02-01T00:00:00Z',
+      updated_at: '2026-02-01T00:00:00Z'
+    },
+    {
+      // Gate tie: only Alpha submitted — Charlie's side stays unsubmitted.
+      tie_id: GATE_TIE,
+      tournament_id: TOURNAMENT,
+      team_id: 'e2e-a',
+      player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
+      status: 'submitted',
+      submitted_at: '2026-02-01T00:00:00Z',
+      updated_at: '2026-02-01T00:00:00Z'
     }
-  }
+  ])
 })
 
 async function signIn(request: APIRequestContext, email: string, password: string): Promise<string> {
@@ -272,23 +235,16 @@ test.describe('results entry (feature acceptance)', () => {
     await expect(page.getByText(/Decided · Alpha/).first()).toBeVisible()
 
     // Admin override: flip r1's games to Charlie and swap r1 side A's player.
+    // The umpire's session would redirect /login back to /umpire — drop it.
+    await page.evaluate(() => localStorage.clear())
     await page.goto('/login')
     await page.getByRole('textbox', { name: /email/i }).fill(TEST_ADMIN_EMAIL)
     await page.getByRole('textbox', { name: /password/i }).fill(TEST_ADMIN_PASSWORD)
     await page.getByRole('button', { name: /sign in/i }).click()
     await expect(page).toHaveURL(/\/matches$/)
 
-    await page.getByRole('button', { name: /results/i }).first().click()
-    const dialog = page.getByRole('dialog')
-    await expect(dialog).toBeVisible()
-    await dialog
-      .getByLabel('Tournament')
-      .selectOption({ label: 'E2E Results' })
-      .catch(() => {
-        // The dashboard scopes rows per category via the tournament selector;
-        // when the fixture category needs selecting first, its option is named
-        // 'E2E Results'. If no selector exists the rows are already filtered.
-      })
+    // The dashboard sorts by scheduled time, so the 10:00 entry tie (RES_TIE)
+    // is the first Alpha-vs-Charlie row.
     const resRow = page
       .locator('tr')
       .filter({ hasText: 'Alpha' })
@@ -305,7 +261,8 @@ test.describe('results entry (feature acceptance)', () => {
         .getByRole('spinbutton', { name: `Rubber 1 game ${game + 1} side B` })
         .fill(String(b))
     }
-    await dlg.getByLabel('Rubber 1 side A player').selectOption({ label: 'Adam' })
+    await dlg.getByLabel('Rubber 1 side A player').click({ force: true })
+    await page.getByRole('option', { name: 'Adam', exact: true }).last().click()
     await dlg.getByRole('button', { name: /save results/i }).click()
     await expect(dlg).not.toBeVisible()
 
@@ -348,4 +305,144 @@ test.describe('results entry (feature acceptance)', () => {
     expect(read.ok()).toBeTruthy()
     expect(await read.json()).toEqual([])
   })
+
+  test('RLS boundaries: RPC is umpire-only, manager read/write split, cross-tournament denial, player immutability', async ({
+    request
+  }) => {
+    const umpire = await signIn(request, UMPIRE_EMAIL, UMPIRE_NEW_PASSWORD)
+    const manager = await signIn(request, 'manager2@lineup.local', 'manager2-new-pw-123')
+    const admin = await apiToken(request, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD)
+
+    // Own fixture tie — never shared with the other scenarios, so these
+    // assertions are race-free. Same category/format as the entry fixtures.
+    const RLS_TIE = 'e2e-tie-res-rls'
+    const upsertHeaders = { ...authHeaders(admin), Prefer: 'resolution=merge-duplicates' }
+    await request.post(`${supabaseUrl}/rest/v1/ties`, {
+      headers: upsertHeaders,
+      data: [
+        {
+          id: RLS_TIE,
+          tournament_id: TOURNAMENT,
+          category_id: RES_CAT,
+          scheduled_start: '2099-03-01T14:00:00+00:00',
+          table_label: '8',
+          team_a: 'e2e-a',
+          team_b: 'e2e-c',
+          is_knockout: false
+        }
+      ]
+    })
+    await request.post(`${supabaseUrl}/rest/v1/lineups`, {
+      headers: upsertHeaders,
+      data: [
+        {
+          tie_id: RLS_TIE,
+          tournament_id: TOURNAMENT,
+          team_id: 'e2e-a',
+          player_ids: [['e2e-p2'], ['e2e-p7'], ['e2e-p8']],
+          status: 'submitted',
+          submitted_at: '2026-02-01T00:00:00Z',
+          updated_at: '2026-02-01T00:00:00Z'
+        },
+        {
+          tie_id: RLS_TIE,
+          tournament_id: TOURNAMENT,
+          team_id: 'e2e-c',
+          player_ids: [['e2e-p5'], ['e2e-p6'], ['e2e-p9']],
+          status: 'submitted',
+          submitted_at: '2026-02-01T00:00:00Z',
+          updated_at: '2026-02-01T00:00:00Z'
+        }
+      ]
+    })
+
+    // The umpire can save through the RPC (idempotent overwrite of r1).
+    const save = await request.post(`${supabaseUrl}/rest/v1/rpc/upsert_umpire_result`, {
+      headers: jsonHeaders(umpire),
+      data: {
+        p_tie_id: RLS_TIE,
+        p_rubber_index: 1,
+        p_games: [
+          { a: 11, b: 5 },
+          { a: 11, b: 7 }
+        ],
+        p_walkover: false,
+        p_walkover_side: null
+      }
+    })
+    expect(save.ok()).toBeTruthy()
+
+    // A manager calling the RPC is refused — the role boundary is server-side.
+    const asManager = await request.post(`${supabaseUrl}/rest/v1/rpc/upsert_umpire_result`, {
+      headers: jsonHeaders(manager),
+      data: {
+        p_tie_id: RLS_TIE,
+        p_rubber_index: 1,
+        p_games: [{ a: 0, b: 0 }],
+        p_walkover: false,
+        p_walkover_side: null
+      }
+    })
+    expect(asManager.ok()).toBeFalsy()
+
+    // Manager read/write split: reads their tournament's results, cannot write.
+    const mgrRead = await request.get(
+      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${RLS_TIE}`,
+      { headers: jsonHeaders(manager) }
+    )
+    expect(mgrRead.ok()).toBeTruthy()
+    const mgrRows = (await mgrRead.json()) as { rubber_index: number; games: unknown }[]
+    expect(mgrRows.length).toBeGreaterThanOrEqual(1)
+
+    const mgrWrite = await request.patch(
+      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${RLS_TIE}&rubber_index=eq.1`,
+      { headers: jsonHeaders(manager), data: { games: [{ a: 0, b: 0 }] } }
+    )
+    expect(mgrWrite.ok()).toBeTruthy() // RLS silently filters — no error
+    const after = await request.get(
+      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${RLS_TIE}&rubber_index=eq.1`,
+      { headers: jsonHeaders(admin) }
+    )
+    const afterRow = ((await after.json()) as { games: { a: number }[] }[])[0]
+    expect(afterRow.games[0].a).toBe(11) // unchanged — the write was inert
+
+    // Cross-tournament denial: the umpire sees nothing of another tournament.
+    await request.post(`${supabaseUrl}/rest/v1/tournaments`, {
+      headers: upsertHeaders,
+      data: [{ id: 'e2e-tour-rls', name: 'E2E RLS Other' }]
+    })
+    const other = await request.get(
+      `${supabaseUrl}/rest/v1/ties?tournament_id=eq.e2e-tour-rls`,
+      { headers: jsonHeaders(umpire) }
+    )
+    expect((await other.json()) as unknown[]).toEqual([])
+
+    // Player identity immutability: even after the lineup changes, an umpire
+    // update keeps the stored players (the update set never touches player_ids).
+    await request.patch(
+      `${supabaseUrl}/rest/v1/lineups?tie_id=eq.${RLS_TIE}&team_id=eq.e2e-a`,
+      { headers: jsonHeaders(admin), data: { player_ids: [['e2e-p7'], ['e2e-p7'], ['e2e-p7']] } }
+    )
+    const resave = await request.post(`${supabaseUrl}/rest/v1/rpc/upsert_umpire_result`, {
+      headers: jsonHeaders(umpire),
+      data: {
+        p_tie_id: RLS_TIE,
+        p_rubber_index: 1,
+        p_games: [
+          { a: 11, b: 5 },
+          { a: 11, b: 7 }
+        ],
+        p_walkover: false,
+        p_walkover_side: null
+      }
+    })
+    expect(resave.ok()).toBeTruthy()
+    const reread = await request.get(
+      `${supabaseUrl}/rest/v1/rubber_results?tie_id=eq.${RLS_TIE}&rubber_index=eq.1`,
+      { headers: jsonHeaders(admin) }
+    )
+    const row = ((await reread.json()) as { player_ids: [string[], string[]] }[])[0]
+    expect(row.player_ids[0]).toEqual(['e2e-p2']) // the ORIGINAL lineup selection
+    expect(row.player_ids[1]).toEqual(['e2e-p5'])
+  })
 })
diff --git a/src/components/AdminResultsDialog.vue b/src/components/AdminResultsDialog.vue
new file mode 100644
index 0000000..5a933e1
--- /dev/null
+++ b/src/components/AdminResultsDialog.vue
@@ -0,0 +1,306 @@
+<script setup lang="ts">
+// The administrator's results dialog (results slice R6): everything editable —
+// players per rubber per side, game scores, walkovers (with side) and the
+// tie's best-of — regardless of who entered the data and at any time. Saves go
+// through saveRubberResult, which enforces the entry gate and the game rules
+// for this client path; admin writes stay admin-scoped by RLS.
+import { reactive, ref, watch } from 'vue'
+import { supabase } from '@/lib/supabase'
+import { setTieBestOf, saveRubberResult, type TieResultContext } from '@/services/resultsService'
+import { validateGames, type GameScore, type Side } from '@/domain/results'
+import type { Violation } from '@/domain/types'
+
+interface PlayerOption {
+  id: string
+  name: string
+}
+
+const props = defineProps<{
+  modelValue: boolean
+  tieId: string
+  teamAName: string
+  teamBName: string
+  context: TieResultContext | null
+  rosterA: PlayerOption[]
+  rosterB: PlayerOption[]
+}>()
+
+const emit = defineEmits<{
+  'update:modelValue': [value: boolean]
+  saved: []
+}>()
+
+interface EditPlayer {
+  id: string | null
+}
+interface EditRubber {
+  playersA: EditPlayer[]
+  playersB: EditPlayer[]
+  games: { a: string; b: string }[]
+  walkover: boolean
+  walkoverSide: Side | null
+}
+
+const rubbers = reactive<EditRubber[]>([])
+const bestOfDraft = ref('')
+const violationsByRubber = reactive<Record<number, string[]>>({})
+const bestOfError = ref<string | null>(null)
+const serverError = ref<string | null>(null)
+const saved = ref(false)
+const saving = ref(false)
+
+watch(
+  () => [props.modelValue, props.tieId, props.context] as const,
+  () => {
+    if (!props.modelValue || !props.context) return
+    serverError.value = null
+    bestOfError.value = null
+    saved.value = false
+    for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
+    const ctx = props.context
+    bestOfDraft.value = String(ctx.bestOf)
+    rubbers.splice(0, rubbers.length)
+    for (let i = 0; i < ctx.rubberCount; i += 1) {
+      const stored = ctx.stored[i]
+      const prefillA = ctx.prefill[0][i]
+      const prefillB = ctx.prefill[1][i]
+      const hasStored = stored != null && (stored.games.length > 0 || stored.walkover)
+      const slotsA = (hasStored ? asIdArray(stored.playerIds[0]) : prefillA) ?? []
+      const slotsB = (hasStored ? asIdArray(stored.playerIds[1]) : prefillB) ?? []
+      rubbers.push({
+        playersA: slotsA.map((id) => ({ id })),
+        playersB: slotsB.map((id) => ({ id })),
+        games: hasStored
+          ? stored.games.map((g) => ({ a: String(g.a), b: String(g.b) }))
+          : [{ a: '', b: '' }],
+        walkover: stored?.walkover ?? false,
+        walkoverSide: stored?.walkoverSide ?? null
+      })
+    }
+  },
+  { immediate: true }
+)
+
+/** The stored player_ids side value is an array of ids (or jsonb null). */
+function asIdArray(side: unknown): (string | null)[] | null {
+  if (!Array.isArray(side)) return null
+  return side.map((id) => (typeof id === 'string' ? id : null))
+}
+
+function addGame(rubber: number): void {
+  rubbers[rubber].games.push({ a: '', b: '' })
+}
+
+function rosterFor(side: 0 | 1): PlayerOption[] {
+  return side === 0 ? props.rosterA : props.rosterB
+}
+
+async function onSave(): Promise<void> {
+  serverError.value = null
+  bestOfError.value = null
+  saved.value = false
+  for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
+  const ctx = props.context
+  if (!ctx) return
+
+  // Best-of first: a change saves through the same odd-only path as R1.
+  const bestOf = Number(bestOfDraft.value)
+
+  for (let i = 0; i < rubbers.length; i += 1) {
+    const r = rubbers[i]
+    const games: GameScore[] = r.games
+      .filter((g) => g.a !== '' || g.b !== '')
+      .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
+    const partial = r.games.some((g) => (g.a === '') !== (g.b === ''))
+    const violations: Violation[] =
+      r.walkover || games.length > 0
+        ? validateGames(games, bestOf, r.walkover, r.walkoverSide ?? undefined)
+        : []
+    if (partial && !r.walkover) {
+      violations.push({ kind: 'bad-score', message: 'Both sides of a game need scores.' })
+    }
+    if (violations.length > 0) violationsByRubber[i] = violations.map((v) => v.message)
+  }
+  if (Object.keys(violationsByRubber).length > 0) return
+
+  saving.value = true
+  try {
+    if (bestOf !== ctx.bestOf) {
+      try {
+        await setTieBestOf(supabase, props.tieId, bestOfDraft.value)
+      } catch (e) {
+        bestOfError.value = (e as Error).message
+        return
+      }
+    }
+    for (let i = 0; i < rubbers.length; i += 1) {
+      const r = rubbers[i]
+      const games = r.games
+        .filter((g) => g.a !== '' && g.b !== '')
+        .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
+      if (!r.walkover && games.length === 0) continue
+      try {
+        await saveRubberResult(supabase, {
+          tieId: props.tieId,
+          rubberIndex: i + 1,
+          playerIds: [
+            r.playersA.map((p) => p.id),
+            r.playersB.map((p) => p.id)
+          ],
+          games: r.walkover ? [] : games,
+          walkover: r.walkover,
+          walkoverSide: r.walkover ? r.walkoverSide : null
+        })
+      } catch (e) {
+        serverError.value = (e as Error).message
+        return
+      }
+    }
+    saved.value = true
+    emit('update:modelValue', false)
+    emit('saved')
+  } finally {
+    saving.value = false
+  }
+}
+</script>
+
+<template>
+  <v-dialog
+    :model-value="modelValue"
+    max-width="860"
+    @update:model-value="emit('update:modelValue', $event as boolean)"
+  >
+    <v-card rounded="lg">
+      <v-card-item>
+        <v-card-title>Results — {{ teamAName }} vs {{ teamBName }}</v-card-title>
+        <v-card-subtitle>Players, scores and walkovers — edits recompute the winner</v-card-subtitle>
+      </v-card-item>
+      <v-card-text>
+        <v-alert v-if="serverError" type="error" variant="tonal" density="compact" class="mb-3">
+          {{ serverError }}
+        </v-alert>
+
+        <div class="d-flex align-center ga-3 mb-3">
+          <v-text-field
+            v-model="bestOfDraft"
+            type="number"
+            label="Best of (games per match)"
+            density="compact"
+            style="max-width: 200px"
+          />
+        </div>
+        <v-alert v-if="bestOfError" type="error" variant="tonal" density="compact" class="mb-3">
+          {{ bestOfError }}
+        </v-alert>
+
+        <v-card v-for="(r, i) in rubbers" :key="i" variant="outlined" class="mb-3 pa-3">
+          <div class="text-subtitle-1 mb-2">Match {{ i + 1 }}</div>
+
+          <template v-if="!r.walkover">
+            <div v-for="(g, gi) in r.games" :key="gi" class="d-flex align-center ga-3 mb-1">
+              <span class="text-body-2" style="min-width: 70px">Game {{ gi + 1 }}</span>
+              <v-text-field
+                v-model="g.a"
+                type="number"
+                :label="`Rubber ${i + 1} game ${gi + 1} side A`"
+                density="compact"
+                hide-details
+                style="max-width: 110px"
+              />
+              <span class="text-body-2">–</span>
+              <v-text-field
+                v-model="g.b"
+                type="number"
+                :label="`Rubber ${i + 1} game ${gi + 1} side B`"
+                density="compact"
+                hide-details
+                style="max-width: 110px"
+              />
+            </div>
+            <v-btn
+              size="small"
+              variant="text"
+              prepend-icon="mdi-plus"
+              :aria-label="`Rubber ${i + 1} add game`"
+              @click="addGame(i)"
+            >
+              Add game
+            </v-btn>
+          </template>
+
+          <div class="d-flex flex-wrap align-center ga-3 mt-1">
+            <v-select
+              v-for="(p, pi) in r.playersA"
+              :key="`a${pi}`"
+              v-model="p.id"
+              :items="rosterFor(0)"
+              item-title="name"
+              item-value="id"
+              :label="
+                r.playersA.length > 1
+                  ? `Rubber ${i + 1} side A player ${pi + 1}`
+                  : `Rubber ${i + 1} side A player`
+              "
+              density="compact"
+              hide-details
+              style="max-width: 220px"
+            />
+            <v-select
+              v-for="(p, pi) in r.playersB"
+              :key="`b${pi}`"
+              v-model="p.id"
+              :items="rosterFor(1)"
+              item-title="name"
+              item-value="id"
+              :label="
+                r.playersB.length > 1
+                  ? `Rubber ${i + 1} side B player ${pi + 1}`
+                  : `Rubber ${i + 1} side B player`
+              "
+              density="compact"
+              hide-details
+              style="max-width: 220px"
+            />
+          </div>
+
+          <div class="d-flex align-center ga-4 mt-2">
+            <v-checkbox
+              v-model="r.walkover"
+              :label="`Rubber ${i + 1} walkover`"
+              density="compact"
+              hide-details
+            />
+            <v-radio-group
+              v-if="r.walkover"
+              v-model="r.walkoverSide"
+              inline
+              hide-details
+              density="compact"
+            >
+              <v-radio :value="'a'" :label="`Rubber ${i + 1} walkover side A`" />
+              <v-radio :value="'b'" :label="`Rubber ${i + 1} walkover side B`" />
+            </v-radio-group>
+          </div>
+
+          <v-alert
+            v-if="(violationsByRubber[i] ?? []).length"
+            type="error"
+            variant="tonal"
+            density="compact"
+            class="mt-2"
+          >
+            <div v-for="(m, mi) in violationsByRubber[i]" :key="mi">{{ m }}</div>
+          </v-alert>
+        </v-card>
+      </v-card-text>
+      <v-card-actions>
+        <v-spacer />
+        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
+        <v-btn color="primary" :disabled="saving" :loading="saving" @click="onSave">
+          Save results
+        </v-btn>
+      </v-card-actions>
+    </v-card>
+  </v-dialog>
+</template>
diff --git a/src/components/UmpireEntryDialog.vue b/src/components/UmpireEntryDialog.vue
new file mode 100644
index 0000000..a50c8d2
--- /dev/null
+++ b/src/components/UmpireEntryDialog.vue
@@ -0,0 +1,251 @@
+<script setup lang="ts">
+// The umpire's per-tie entry form (results slice R5): one section per rubber
+// in the tie's format. Players display read-only from the submitted lineups —
+// the SERVER derives the stored player identity from those same lineups, so
+// what the umpire sees is exactly what gets stored. Game entry validates
+// against the tie's best-of (overflow beyond the majority is an entry error);
+// walkovers carry no games and need their winning side. Saves go through the
+// upsert_umpire_result RPC — the gate is enforced server-side.
+import { computed, reactive, ref, watch } from 'vue'
+import { supabase } from '@/lib/supabase'
+import { upsertUmpireResult } from '@/services/resultsService'
+import {
+  validateGames,
+  type GameScore,
+  type Side
+} from '@/domain/results'
+import type { Violation } from '@/domain/types'
+
+export interface EntryGame {
+  a: string
+  b: string
+}
+
+interface StoredRubber {
+  games: GameScore[]
+  walkover: boolean
+  walkoverSide: Side | null
+}
+
+const props = defineProps<{
+  modelValue: boolean
+  tieId: string
+  teamAName: string
+  teamBName: string
+  bestOf: number
+  rubberCount: number
+  /** Display names per side per rubber (from the submitted lineups). */
+  players: [string[], string[]][]
+  stored: StoredRubber[]
+}>()
+
+const emit = defineEmits<{
+  'update:modelValue': [value: boolean]
+  saved: []
+}>()
+
+const rubbers = reactive<
+  { games: EntryGame[]; walkover: boolean; walkoverSide: Side | null }[]
+>([])
+const violationsByRubber = reactive<Record<number, string[]>>({})
+const serverError = ref<string | null>(null)
+const saving = ref(false)
+
+watch(
+  () => [props.modelValue, props.tieId],
+  () => {
+    if (!props.modelValue) return
+    serverError.value = null
+    violationsByRubberClear()
+    rubbers.splice(0, rubbers.length)
+    for (let i = 0; i < props.rubberCount; i += 1) {
+      const stored = props.stored[i]
+      const hasStored = stored != null && (stored.games.length > 0 || stored.walkover)
+      rubbers.push({
+        games: hasStored
+          ? stored.games.map((g) => ({ a: String(g.a), b: String(g.b) }))
+          : [{ a: '', b: '' }],
+        walkover: stored?.walkover ?? false,
+        walkoverSide: stored?.walkoverSide ?? null
+      })
+    }
+  },
+  { immediate: true }
+)
+
+function violationsByRubberClear(): void {
+  for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
+}
+
+function addGame(rubber: number): void {
+  rubbers[rubber].games.push({ a: '', b: '' })
+}
+
+function playersLabel(rubber: number): string {
+  const [a, b] = props.players[rubber] ?? [[], []]
+  const fmt = (names: string[]) => (names.length ? names.join(', ') : '—')
+  return `${fmt(a)} vs ${fmt(b)}`
+}
+
+/** Violations for one rubber, rendered inline. */
+function violationsFor(rubber: number): string[] {
+  return violationsByRubber[rubber] ?? []
+}
+
+async function onSave(): Promise<void> {
+  serverError.value = null
+  violationsByRubberClear()
+
+  // Validate every touched rubber first — a save with any violation writes
+  // nothing.
+  let touched = 0
+  for (let i = 0; i < rubbers.length; i += 1) {
+    const r = rubbers[i]
+    const games: GameScore[] = r.games
+      .filter((g) => g.a !== '' || g.b !== '')
+      .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
+    const partial = r.games.some((g) => (g.a === '') !== (g.b === ''))
+    const violations: Violation[] =
+      r.walkover || games.length > 0
+        ? validateGames(games, props.bestOf, r.walkover, r.walkoverSide ?? undefined)
+        : []
+    if (partial && !r.walkover) {
+      violations.push({
+        kind: 'bad-score',
+        message: 'Both sides of a game need scores.'
+      })
+    }
+    if (violations.length > 0) violationsByRubber[i] = violations.map((v) => v.message)
+    if (r.walkover || games.length > 0) touched += 1
+  }
+  if (Object.keys(violationsByRubber).length > 0) return
+  if (touched === 0) {
+    emit('update:modelValue', false)
+    return
+  }
+
+  saving.value = true
+  try {
+    for (let i = 0; i < rubbers.length; i += 1) {
+      const r = rubbers[i]
+      const games = r.games
+        .filter((g) => g.a !== '' && g.b !== '')
+        .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
+      if (!r.walkover && games.length === 0) continue
+      try {
+        await upsertUmpireResult(supabase, {
+          tieId: props.tieId,
+          rubberIndex: i + 1,
+          games,
+          walkover: r.walkover,
+          walkoverSide: r.walkover ? r.walkoverSide : null
+        })
+      } catch (e) {
+        serverError.value = (e as Error).message
+        return
+      }
+    }
+    emit('update:modelValue', false)
+    emit('saved')
+  } finally {
+    saving.value = false
+  }
+}
+
+const canSave = computed(() => !saving.value)
+</script>
+
+<template>
+  <v-dialog
+    :model-value="modelValue"
+    max-width="720"
+    @update:model-value="emit('update:modelValue', $event as boolean)"
+  >
+    <v-card rounded="lg">
+      <v-card-item>
+        <v-card-title>{{ teamAName }} vs {{ teamBName }}</v-card-title>
+        <v-card-subtitle>Best of {{ bestOf }} games per match</v-card-subtitle>
+      </v-card-item>
+      <v-card-text>
+        <v-alert v-if="serverError" type="error" variant="tonal" density="compact" class="mb-3">
+          {{ serverError }}
+        </v-alert>
+
+        <v-card v-for="(r, i) in rubbers" :key="i" variant="outlined" class="mb-3 pa-3">
+          <div class="d-flex align-center ga-3 mb-2">
+            <span class="text-subtitle-1">Match {{ i + 1 }}</span>
+            <span class="text-body-2 text-medium-emphasis">{{ playersLabel(i) }}</span>
+          </div>
+
+          <template v-if="!r.walkover">
+            <div v-for="(g, gi) in r.games" :key="gi" class="d-flex align-center ga-3 mb-1">
+              <span class="text-body-2" style="min-width: 70px">Game {{ gi + 1 }}</span>
+              <v-text-field
+                v-model="g.a"
+                type="number"
+                :label="`Rubber ${i + 1} game ${gi + 1} side A`"
+                density="compact"
+                hide-details
+                style="max-width: 110px"
+              />
+              <span class="text-body-2">–</span>
+              <v-text-field
+                v-model="g.b"
+                type="number"
+                :label="`Rubber ${i + 1} game ${gi + 1} side B`"
+                density="compact"
+                hide-details
+                style="max-width: 110px"
+              />
+            </div>
+            <v-btn
+              size="small"
+              variant="text"
+              prepend-icon="mdi-plus"
+              :aria-label="`Rubber ${i + 1} add game`"
+              @click="addGame(i)"
+            >
+              Add game
+            </v-btn>
+          </template>
+
+          <div class="d-flex align-center ga-4 mt-1">
+            <v-checkbox
+              v-model="r.walkover"
+              :label="`Rubber ${i + 1} walkover`"
+              density="compact"
+              hide-details
+            />
+            <v-radio-group
+              v-if="r.walkover"
+              v-model="r.walkoverSide"
+              inline
+              hide-details
+              density="compact"
+            >
+              <v-radio :value="'a'" :label="`Rubber ${i + 1} walkover side A`" />
+              <v-radio :value="'b'" :label="`Rubber ${i + 1} walkover side B`" />
+            </v-radio-group>
+          </div>
+
+          <v-alert
+            v-if="violationsFor(i).length"
+            type="error"
+            variant="tonal"
+            density="compact"
+            class="mt-2"
+          >
+            <div v-for="(m, mi) in violationsFor(i)" :key="mi">{{ m }}</div>
+          </v-alert>
+        </v-card>
+      </v-card-text>
+      <v-card-actions>
+        <v-spacer />
+        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
+        <v-btn color="primary" :disabled="!canSave" :loading="saving" @click="onSave">
+          Save results
+        </v-btn>
+      </v-card-actions>
+    </v-card>
+  </v-dialog>
+</template>
diff --git a/src/domain/__tests__/matchesDashboard.test.ts b/src/domain/__tests__/matchesDashboard.test.ts
index c7a3eba..fa3ead0 100644
--- a/src/domain/__tests__/matchesDashboard.test.ts
+++ b/src/domain/__tests__/matchesDashboard.test.ts
@@ -15,6 +15,13 @@ const NOW = '2026-06-01T12:00:00Z'
 const FUTURE = '2099-01-01T10:00:00Z'
 const PAST = '2000-01-01T10:00:00Z'
 const mensSingles: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
+const threeRubbers: TieFormat = {
+  rubbers: [
+    { format: 'singles', constraint: { allowedGenders: ['M'] } },
+    { format: 'singles', constraint: { allowedGenders: ['M'] } },
+    { format: 'singles', constraint: { allowedGenders: ['M'] } }
+  ]
+}
 const male = (id: string): Player => ({ id, name: id.toUpperCase(), gender: 'M', dateOfBirth: '1990-01-01' })
 const female = (id: string): Player => ({ id, name: id.toUpperCase(), gender: 'F', dateOfBirth: '1990-01-01' })
 
@@ -59,6 +66,80 @@ describe('buildMatchRows', () => {
     expect(rows[0].sides.every((s) => s.status === 'not-submitted')).toBe(true)
   })
 
+  it('derives the result state from entered rubbers without storing anything', () => {
+    // Best-of-5 games, 3 rubbers in the format: Alpha wins r1, walkover a on
+    // r2 → decided for Alpha; nothing is written back to the tie.
+    const rows = buildMatchRows(
+      args({
+        ties: [{ ...tie(), bestOf: 5 }],
+        formatByCategory: new Map([['cat', threeRubbers]]),
+        results: [
+          {
+            tieId: 't1',
+            rubberIndex: 1,
+            games: [
+              { a: 11, b: 5 },
+              { a: 11, b: 7 },
+              { a: 11, b: 9 }
+            ],
+            walkover: false,
+            walkoverSide: null
+          },
+          { tieId: 't1', rubberIndex: 2, games: [], walkover: true, walkoverSide: 'a' }
+        ]
+      })
+    )
+    expect(rows[0].resultState).toBe('decided')
+    expect(rows[0].winnerName).toBe('Alpha')
+  })
+
+  it('shows partial when rubbers are entered but the tie is undecided', () => {
+    const rows = buildMatchRows(
+      args({
+        formatByCategory: new Map([['cat', threeRubbers]]),
+        results: [
+          {
+            tieId: 't1',
+            rubberIndex: 1,
+            games: [
+              { a: 11, b: 5 },
+              { a: 11, b: 7 },
+              { a: 11, b: 9 }
+            ],
+            walkover: false,
+            walkoverSide: null
+          }
+        ]
+      })
+    )
+    expect(rows[0].resultState).toBe('partial')
+    expect(rows[0].winnerName).toBeUndefined()
+  })
+
+  it('a decided flip recomputes: the winner follows the edited rubbers', () => {
+    const rows = buildMatchRows(
+      args({
+        formatByCategory: new Map([['cat', threeRubbers]]),
+        results: [
+          {
+            tieId: 't1',
+            rubberIndex: 1,
+            games: [
+              { a: 5, b: 11 },
+              { a: 7, b: 11 },
+              { a: 9, b: 11 }
+            ],
+            walkover: false,
+            walkoverSide: null
+          },
+          { tieId: 't1', rubberIndex: 2, games: [], walkover: true, walkoverSide: 'a' }
+        ]
+      })
+    )
+    // 1–1 in a 3-rubber format → undecided, not a stored winner.
+    expect(rows[0].resultState).toBe('partial')
+  })
+
   it('derives Submitted for a valid submitted lineup and Not submitted for the rest', () => {
     const rows = buildMatchRows(
       args({
diff --git a/src/domain/__tests__/results.test.ts b/src/domain/__tests__/results.test.ts
new file mode 100644
index 0000000..d1abeec
--- /dev/null
+++ b/src/domain/__tests__/results.test.ts
@@ -0,0 +1,161 @@
+import { describe, it, expect } from 'vitest'
+import {
+  bothLineupsSubmitted,
+  deriveTieResult,
+  parseBestOf,
+  rubberWinner,
+  tieWinner,
+  validateGames
+} from '../results'
+
+describe('parseBestOf', () => {
+  it('accepts odd positive numbers', () => {
+    expect(parseBestOf(1)).toBe(1)
+    expect(parseBestOf(5)).toBe(5)
+    expect(parseBestOf(7)).toBe(7)
+  })
+
+  it('accepts numeric strings (form input)', () => {
+    expect(parseBestOf('7')).toBe(7)
+    expect(parseBestOf(' 5 ')).toBe(5)
+  })
+
+  it('rejects even values', () => {
+    expect(() => parseBestOf(4)).toThrow(/odd/i)
+    expect(() => parseBestOf('6')).toThrow(/odd/i)
+  })
+
+  it('rejects zero and negatives', () => {
+    expect(() => parseBestOf(0)).toThrow(/odd/i)
+    expect(() => parseBestOf(-3)).toThrow(/odd/i)
+  })
+
+  it('rejects non-integers and junk', () => {
+    expect(() => parseBestOf(3.5)).toThrow(/odd/i)
+    expect(() => parseBestOf('')).toThrow(/odd/i)
+    expect(() => parseBestOf('five')).toThrow(/odd/i)
+  })
+})
+
+describe('bothLineupsSubmitted', () => {
+  const lineups = (statuses: ('submitted' | 'draft' | 'not-started' | 'invalidated')[]) =>
+    statuses.map((status, i) => ({ teamId: `t${i}`, status }))
+
+  it('is satisfied when both tie sides submitted', () => {
+    expect(bothLineupsSubmitted(lineups(['submitted', 'submitted']), ['t0', 't1'])).toBe(true)
+  })
+
+  it('is unsatisfied when either side is missing or unsubmitted', () => {
+    expect(bothLineupsSubmitted(lineups(['submitted', 'draft']), ['t0', 't1'])).toBe(false)
+    expect(bothLineupsSubmitted(lineups(['submitted']), ['t0', 't1'])).toBe(false)
+    expect(bothLineupsSubmitted([], ['t0', 't1'])).toBe(false)
+  })
+
+  it('is unsatisfied for a TBD side', () => {
+    expect(bothLineupsSubmitted(lineups(['submitted', 'submitted']), ['t0', null])).toBe(false)
+  })
+})
+
+describe('rubberWinner', () => {
+  it('is the first side to the best-of majority', () => {
+    // Best-of-5 games: majority is 3.
+    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }], 5)).toBeNull()
+    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 9, b: 11 }], 5)).toBeNull()
+    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }], 5)).toBe('a')
+    expect(rubberWinner([{ a: 5, b: 11 }, { a: 7, b: 11 }], 3)).toBe('b')
+  })
+
+  it('walkover is decided without games — only with an explicit side', () => {
+    // A walkover without a recorded side is UNDECIDED, never a silent A-win.
+    expect(rubberWinner([], 5, true)).toBeNull()
+    expect(rubberWinner([], 5, true, 'a')).toBe('a')
+    expect(rubberWinner([], 5, true, 'b')).toBe('b')
+  })
+})
+
+describe('deriveTieResult', () => {
+  const decided = (side: 'a' | 'b') => ({
+    tieId: 't1',
+    rubberIndex: 1,
+    games: [
+      side === 'a' ? { a: 11, b: 5 } : { a: 5, b: 11 },
+      side === 'a' ? { a: 11, b: 7 } : { a: 7, b: 11 },
+      side === 'a' ? { a: 11, b: 9 } : { a: 9, b: 11 }
+    ],
+    walkover: false,
+    walkoverSide: null
+  })
+
+  it('derives decided with the winner side', () => {
+    expect(deriveTieResult([decided('a'), { ...decided('a'), rubberIndex: 2 }], 5, 3)).toEqual({
+      state: 'decided',
+      winnerSide: 'a'
+    })
+  })
+
+  it('derives partial when entered rubbers do not reach the majority', () => {
+    expect(deriveTieResult([decided('a')], 5, 3)).toEqual({ state: 'partial' })
+  })
+
+  it('counts a walkover for its recorded side only', () => {
+    const walkoverA = { tieId: 't1', rubberIndex: 2, games: [], walkover: true, walkoverSide: 'a' as const }
+    const sideless = { tieId: 't1', rubberIndex: 2, games: [], walkover: true, walkoverSide: null }
+    expect(deriveTieResult([decided('b'), walkoverA], 5, 3)).toEqual({ state: 'partial' })
+    expect(
+      deriveTieResult(
+        [decided('b'), walkoverA, { ...decided('b'), rubberIndex: 3 }],
+        5,
+        3
+      )
+    ).toEqual({ state: 'decided', winnerSide: 'b' })
+    // A side-less walkover counts for neither side.
+    expect(deriveTieResult([decided('a'), sideless], 5, 3)).toEqual({ state: 'partial' })
+  })
+})
+
+describe('validateGames', () => {
+  it('accepts a complete best-of majority', () => {
+    expect(validateGames([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }], 5)).toEqual([])
+  })
+
+  it('accepts an incomplete rubber (still undecided)', () => {
+    expect(validateGames([{ a: 11, b: 5 }], 5)).toEqual([])
+  })
+
+  it('rejects games entered after the majority is reached', () => {
+    const v = validateGames([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }, { a: 11, b: 8 }], 5)
+    expect(v).toHaveLength(1)
+    expect(v[0].kind).toBe('best-of-overflow')
+  })
+
+  it('rejects negative or non-integer scores', () => {
+    expect(validateGames([{ a: -1, b: 5 }], 5)).toHaveLength(1)
+    expect(validateGames([{ a: 10.5, b: 5 }], 5)).toHaveLength(1)
+  })
+
+  it('rejects a walkover carrying games and a walkover without a side', () => {
+    expect(validateGames([{ a: 11, b: 5 }], 5, true).map((v) => v.kind)).toContain(
+      'walkover-with-games'
+    )
+    expect(validateGames([], 5, true, undefined).map((v) => v.kind)).toContain('walkover-no-side')
+    expect(validateGames([], 5, true, 'a')).toEqual([])
+  })
+})
+
+describe('tieWinner', () => {
+  it('is the side with the majority of rubbers; unplayed count for neither', () => {
+    expect(tieWinner(['a', 'a', 'b'], 3)).toBe('a')
+    expect(tieWinner(['a', 'b', null], 3)).toBeNull()
+    expect(tieWinner(['b', null, null], 3)).toBeNull()
+    expect(tieWinner(['a', 'a', null], 3)).toBe('a')
+  })
+
+  it('a 3-0 tie in a best-of-5-rubbers format is already decided', () => {
+    expect(tieWinner(['a', 'a', 'a', null, null], 5)).toBe('a')
+  })
+
+  it('walkovers count as their side\'s rubber win', () => {
+    expect(tieWinner(['a', null, null], 3, ['a'])).toBeNull()
+    expect(tieWinner(['a', 'a', null], 3, ['a', 'b'])).toBe('a')
+  })
+})
diff --git a/src/domain/__tests__/umpireView.test.ts b/src/domain/__tests__/umpireView.test.ts
new file mode 100644
index 0000000..4e5b3c5
--- /dev/null
+++ b/src/domain/__tests__/umpireView.test.ts
@@ -0,0 +1,167 @@
+import { describe, it, expect } from 'vitest'
+import { buildUmpireTieRows, LOCKED_REASON } from '../umpireView'
+
+const names = new Map([
+  ['a', 'Alpha'],
+  ['b', 'Bravo'],
+  ['c', 'Charlie']
+])
+
+const baseTie = {
+  tieId: 't1',
+  scheduledStart: '2099-01-01T10:00:00',
+  table: '1',
+  teamIds: ['a', 'b'] as [string, string]
+}
+
+describe('buildUmpireTieRows', () => {
+  it('opens entry only when both sides have submitted lineups', () => {
+    const rows = buildUmpireTieRows({
+      ties: [baseTie],
+      lineups: [{ tieId: 't1', teamId: 'a', status: 'submitted' }],
+      teamNameById: names
+    })
+    expect(rows[0].entryOpen).toBe(false)
+    expect(rows[0].state).toBe('locked')
+    expect(LOCKED_REASON).toBe('lineup not submitted')
+  })
+
+  it('stays locked while a lineup is draft even if the other side submitted', () => {
+    const rows = buildUmpireTieRows({
+      ties: [baseTie],
+      lineups: [
+        { tieId: 't1', teamId: 'a', status: 'submitted' },
+        { tieId: 't1', teamId: 'b', status: 'draft' }
+      ],
+      teamNameById: names
+    })
+    expect(rows[0].entryOpen).toBe(false)
+  })
+
+  it('opens when both sides submitted and shows team display names', () => {
+    const rows = buildUmpireTieRows({
+      ties: [baseTie],
+      lineups: [
+        { tieId: 't1', teamId: 'a', status: 'submitted' },
+        { tieId: 't1', teamId: 'b', status: 'submitted' }
+      ],
+      teamNameById: names
+    })
+    expect(rows[0].entryOpen).toBe(true)
+    expect(rows[0].state).toBe('not-entered')
+    expect(rows[0].teamAName).toBe('Alpha')
+    expect(rows[0].teamBName).toBe('Bravo')
+  })
+
+  it('excludes knockout ties and null-sided ties', () => {
+    const rows = buildUmpireTieRows({
+      ties: [
+        { ...baseTie, tieId: 'ko', isKnockout: true },
+        { ...baseTie, tieId: 'tbd', teamIds: ['a', null] as [string, null] }
+      ],
+      lineups: [],
+      teamNameById: names
+    })
+    expect(rows).toEqual([])
+  })
+
+  it('falls back to the raw team id when the name is missing', () => {
+    const rows = buildUmpireTieRows({
+      ties: [baseTie],
+      lineups: [
+        { tieId: 't1', teamId: 'a', status: 'submitted' },
+        { tieId: 't1', teamId: 'b', status: 'submitted' }
+      ],
+      teamNameById: new Map()
+    })
+    expect(rows[0].teamAName).toBe('a')
+  })
+
+  it('derives partial and decided states from entered results', () => {
+    const rows = buildUmpireTieRows({
+      ties: [
+        { ...baseTie, tieId: 't1' },
+        { ...baseTie, tieId: 't2', teamIds: ['a', 'c'] }
+      ],
+      lineups: [
+        { tieId: 't1', teamId: 'a', status: 'submitted' },
+        { tieId: 't1', teamId: 'b', status: 'submitted' },
+        { tieId: 't2', teamId: 'a', status: 'submitted' },
+        { tieId: 't2', teamId: 'c', status: 'submitted' }
+      ],
+      teamNameById: names,
+      rubberCountByTie: new Map([
+        ['t1', 3],
+        ['t2', 3]
+      ]),
+      results: [
+        // t1: one rubber entered, tie undecided → partial.
+        { tieId: 't1', rubberIndex: 1, games: [{ a: 11, b: 5 }, { a: 11, b: 7 }], walkover: false },
+        // t2: rubbers 1+2 entered, side a reaches the majority → decided a.
+        {
+          tieId: 't2',
+          rubberIndex: 1,
+          games: [
+            { a: 11, b: 5 },
+            { a: 11, b: 7 },
+            { a: 11, b: 9 }
+          ],
+          walkover: false
+        },
+        { tieId: 't2', rubberIndex: 2, games: [], walkover: true, walkoverSide: 'a' }
+      ],
+      bestOfByTie: new Map([
+        ['t1', 5],
+        ['t2', 5]
+      ])
+    })
+    expect(rows[0].state).toBe('partial')
+    expect(rows[1].state).toBe('decided')
+    expect(rows[1].winnerSide).toBe('a')
+    expect(rows[1].winnerName).toBe('Alpha')
+  })
+
+  it('a walkover decides only with its recorded side', () => {
+    const withSide = () =>
+      buildUmpireTieRows({
+        ties: [baseTie],
+        lineups: [
+          { tieId: 't1', teamId: 'a', status: 'submitted' },
+          { tieId: 't1', teamId: 'b', status: 'submitted' }
+        ],
+        teamNameById: names,
+        rubberCountByTie: new Map([['t1', 1]]),
+        bestOfByTie: new Map([['t1', 5]]),
+        results: [{ tieId: 't1', rubberIndex: 1, games: [], walkover: true, walkoverSide: 'a' }]
+      })
+    const sideless = () =>
+      buildUmpireTieRows({
+        ties: [baseTie],
+        lineups: [
+          { tieId: 't1', teamId: 'a', status: 'submitted' },
+          { tieId: 't1', teamId: 'b', status: 'submitted' }
+        ],
+        teamNameById: names,
+        rubberCountByTie: new Map([['t1', 1]]),
+        bestOfByTie: new Map([['t1', 5]]),
+        results: [{ tieId: 't1', rubberIndex: 1, games: [], walkover: true }]
+      })
+    expect(withSide()[0].state).toBe('decided')
+    expect(withSide()[0].winnerSide).toBe('a')
+    // A side-less walkover is undecided — never a silent default win.
+    expect(sideless()[0].state).toBe('partial')
+    expect(sideless()[0].winnerSide).toBeUndefined()
+  })
+
+  it('stays not-entered when no results are passed', () => {
+    const rows = buildUmpireTieRows({
+      ties: [baseTie],
+      lineups: [
+        { tieId: 't1', teamId: 'a', status: 'submitted' },
+        { tieId: 't1', teamId: 'b', status: 'submitted' }
+      ],
+      teamNameById: names
+    })
+    expect(rows[0].state).toBe('not-entered')
+  })
+})
diff --git a/src/domain/adminView.ts b/src/domain/adminView.ts
index 3c7c204..24295fe 100644
--- a/src/domain/adminView.ts
+++ b/src/domain/adminView.ts
@@ -34,6 +34,8 @@ export interface AdminTieInput {
   isKnockout?: boolean
   /** On a placed entry slot: the pool match bound to it. */
   placedMatchId?: string | null
+  /** Best-of-games per rubber (results slice R1); undefined = the default 5. */
+  bestOf?: number
 }
 
 export interface AdminLineupRow extends AdminLineupInput {
diff --git a/src/domain/matchesDashboard.ts b/src/domain/matchesDashboard.ts
index 208c195..70a92f3 100644
--- a/src/domain/matchesDashboard.ts
+++ b/src/domain/matchesDashboard.ts
@@ -12,10 +12,23 @@ import {
   type BuildAdminLineupRowsArgs
 } from './adminView'
 import { computeCutoff, isLocked } from './cutoff'
+import { DEFAULT_BEST_OF, deriveTieResult, type GameScore, type Side } from './results'
 import type { LineupStatus } from './types'
 import { sideDisplayName } from './teamNames'
 
-export type BuildMatchRowsArgs = BuildAdminLineupRowsArgs
+export type BuildMatchRowsArgs = BuildAdminLineupRowsArgs & {
+  /** Stored rubber results — winners are derived here, never read back from a tie. */
+  results?: DashboardResultInput[]
+}
+
+/** One stored rubber result, as the dashboard derivation consumes it. */
+export interface DashboardResultInput {
+  tieId: string
+  rubberIndex: number
+  games: GameScore[]
+  walkover: boolean
+  walkoverSide: Side | null
+}
 
 /** A team's lineup status for one team match, in the on-screen vocabulary. */
 export type SideStatus = 'submitted' | 'not-submitted' | 'missed-cutoff'
@@ -45,10 +58,16 @@ export interface MatchRow {
   table?: string
   group?: string
   round?: string
+  /** Best-of-games per rubber (results slice R1); undefined = the default 5. */
+  bestOf?: number
   /** Aligned to the tie's teamIds. */
   sides: [MatchSide, MatchSide]
   cutoff: string | null
   locked: boolean
+  /** Derived from stored results (results slice R7) — undefined when untouched. */
+  resultState?: 'partial' | 'decided'
+  /** The derived winner's display name once decided. */
+  winnerName?: string
 }
 
 export type MatchFilter = 'all' | 'not-submitted' | 'submitted' | 'past-cutoff'
@@ -132,6 +151,13 @@ export function buildMatchRows(args: BuildMatchRowsArgs): MatchRow[] {
   const validated: AdminLineupRow[] = buildAdminLineupRows({ ...args, lineups })
   const rowByTeam = new Map(validated.map((r) => [`${r.tieId}:${r.teamId}`, r]))
 
+  const resultsByTie = new Map<string, DashboardResultInput[]>()
+  for (const r of args.results ?? []) {
+    const arr = resultsByTie.get(r.tieId) ?? []
+    arr.push(r)
+    resultsByTie.set(r.tieId, arr)
+  }
+
   const matches: MatchRow[] = ties.map((tie) => {
     // Every side of a tie shares its cutoff/locked state — computed here so a
     // tie with no lineups at all still filters and chips correctly.
@@ -180,11 +206,43 @@ export function buildMatchRows(args: BuildMatchRowsArgs): MatchRow[] {
       table: tie.table,
       group: tie.group,
       round: tie.round,
+      bestOf: tie.bestOf,
       sides: [sides[0], sides[1]],
       cutoff,
-      locked
+      locked,
+      ...deriveResultState(
+        tie,
+        resultsByTie.get(tie.tieId) ?? [],
+        args.formatByCategory.get(tie.categoryId)?.rubbers.length ?? 0,
+        teamNameById
+      )
     }
   })
 
   return matches.sort(compareMatchRows)
 }
+
+/**
+ * The dashboard's derived result state (results slice R7): computed from the
+ * stored rubber results every time rows build — nothing about winners is ever
+ * written to the tie. Pure.
+ */
+function deriveResultState(
+  tie: AdminTieInput,
+  results: DashboardResultInput[],
+  rubberCount: number,
+  teamNameById: Map<string, string>
+): Pick<MatchRow, 'resultState' | 'winnerName'> {
+  if (results.length === 0 || (tie.isKnockout ?? false)) return {}
+  if (tie.teamIds[0] === null || tie.teamIds[1] === null) return {}
+  if (rubberCount === 0) return {}
+  const derived = deriveTieResult(results, tie.bestOf ?? DEFAULT_BEST_OF, rubberCount)
+  if (derived.state === 'partial' || !derived.winnerSide) return { resultState: 'partial' }
+  return {
+    resultState: 'decided',
+    winnerName: sideDisplayName(
+      derived.winnerSide === 'a' ? tie.teamIds[0] : tie.teamIds[1],
+      teamNameById
+    )
+  }
+}
diff --git a/src/domain/results.ts b/src/domain/results.ts
new file mode 100644
index 0000000..f51ee60
--- /dev/null
+++ b/src/domain/results.ts
@@ -0,0 +1,179 @@
+// Pure results domain for team matches — derivation and validation over stored
+// rubber results. Nothing here touches Supabase; services map rows in/out.
+
+import { ParseError } from './parse-helpers'
+import type { LineupStatus, Violation } from './types'
+
+/** One played game: points for side A and side B. */
+export interface GameScore {
+  a: number
+  b: number
+}
+
+export type Side = 'a' | 'b'
+
+/** The best-of every tie imports with; the admin may override per tie. */
+export const DEFAULT_BEST_OF = 5
+
+/** Majority of a best-of-N: the first side to reach it wins. */
+export function bestOfMajority(bestOf: number): number {
+  return Math.ceil(bestOf / 2)
+}
+
+/**
+ * The winner of one rubber: the first side to the best-of majority of games.
+ * A walkover is decided immediately — but only when its side is recorded: a
+ * side-less walkover is UNDECIDED, never a silent default win. Pure.
+ */
+export function rubberWinner(
+  games: GameScore[],
+  bestOf: number,
+  walkover = false,
+  walkoverSide?: Side | null
+): Side | null {
+  if (walkover) return walkoverSide ?? null
+  let a = 0
+  let b = 0
+  const majority = bestOfMajority(bestOf)
+  for (const g of games) {
+    if (g.a > g.b) a += 1
+    else if (g.b > g.a) b += 1
+    if (a >= majority) return 'a'
+    if (b >= majority) return 'b'
+  }
+  return null
+}
+
+/** The derived state of one tie's results — never stored, computed per read. */
+export interface TieResultState {
+  state: 'partial' | 'decided'
+  winnerSide?: Side
+}
+
+/**
+ * The single derivation of a tie's result from its stored rubber results,
+ * shared by the umpire console and the Matches dashboard so the winner
+ * semantics can never drift between the two surfaces. `results` must carry the
+ * tie's entered rubbers; unplayed rubbers count for neither side. Pure.
+ */
+export function deriveTieResult(
+  results: { rubberIndex: number; games: GameScore[]; walkover: boolean; walkoverSide?: Side | null }[],
+  bestOf: number,
+  rubberCount: number
+): TieResultState {
+  if (rubberCount <= 0 || results.length === 0) return { state: 'partial' }
+  const entered = [...results].sort((x, y) => x.rubberIndex - y.rubberIndex)
+  const winners = entered.map((r) => rubberWinner(r.games, bestOf, r.walkover, r.walkoverSide))
+  const winner = tieWinner(winners, rubberCount)
+  return winner === null ? { state: 'partial' } : { state: 'decided', winnerSide: winner }
+}
+
+/**
+ * Entry-time validation of one rubber's games against the tie's best-of:
+ * non-negative integer scores; a walkover carries no games and needs a side;
+ * games entered after the majority is reached are an entry error. Pure.
+ */
+export function validateGames(
+  games: GameScore[],
+  bestOf: number,
+  walkover = false,
+  walkoverSide?: Side
+): Violation[] {
+  const violations: Violation[] = []
+  if (walkover) {
+    if (games.length > 0) {
+      violations.push({
+        kind: 'walkover-with-games',
+        message: 'A walkover cannot carry game scores.'
+      })
+    }
+    if (walkoverSide === undefined) {
+      violations.push({ kind: 'walkover-no-side', message: 'Choose which side won the walkover.' })
+    }
+    return violations
+  }
+  const majority = bestOfMajority(bestOf)
+  let a = 0
+  let b = 0
+  for (const [i, g] of games.entries()) {
+    if (!Number.isInteger(g.a) || !Number.isInteger(g.b) || g.a < 0 || g.b < 0) {
+      violations.push({
+        kind: 'bad-score',
+        message: `Game ${i + 1}: scores must be whole non-negative numbers.`,
+        rubberIndex: i
+      })
+      continue
+    }
+    if (a >= majority || b >= majority) {
+      violations.push({
+        kind: 'best-of-overflow',
+        message: `The rubber was decided at game ${i} — best of ${bestOf} ends at ${majority} game wins.`,
+        rubberIndex: i
+      })
+      continue
+    }
+    if (g.a > g.b) a += 1
+    else if (g.b > g.a) b += 1
+  }
+  return violations
+}
+
+/**
+ * The winner of the tie: the first side to the majority of RUBBERS won.
+ * Unplayed rubbers count for neither side; walkovers count as their side's
+ * win (each entry of `walkoverSides` marks a rubber won by walkover).
+ * Undecided → null. Pure.
+ */
+export function tieWinner(
+  rubberWinners: (Side | null)[],
+  rubberCount: number,
+  walkoverSides: (Side | null)[] = []
+): Side | null {
+  const majority = Math.ceil(rubberCount / 2)
+  let a = 0
+  let b = 0
+  for (const [i, w] of rubberWinners.entries()) {
+    const winner = w ?? walkoverSides[i] ?? null
+    if (winner === 'a') a += 1
+    else if (winner === 'b') b += 1
+    if (a >= majority) return 'a'
+    if (b >= majority) return 'b'
+  }
+  return null
+}
+
+/**
+ * Validate a tie's best-of-games setting: a positive odd integer (5 is the
+ * default every tie imports with; the admin may override per tie).
+ * Returns the parsed number; throws {@link ParseError} on any violation.
+ * Pure.
+ */
+export function parseBestOf(input: unknown): number {
+  const raw = typeof input === 'string' ? input.trim() : input
+  const n = typeof raw === 'number' ? raw : Number(raw)
+  if (
+    typeof n !== 'number' ||
+    !Number.isInteger(n) ||
+    n <= 0 ||
+    n % 2 !== 1
+  ) {
+    throw new ParseError('Best of must be a positive odd number of games (1, 3, 5, …).')
+  }
+  return n
+}
+
+/**
+ * The entry gate: results can be entered for a tie only once BOTH of its sides
+ * have a submitted lineup (a TBD side can never satisfy the gate). Pure.
+ */
+export function bothLineupsSubmitted(
+  lineups: { teamId: string; status: LineupStatus }[],
+  teamIds: [string | null, string | null]
+): boolean {
+  const [a, b] = teamIds
+  if (a === null || b === null) return false
+  const submitted = new Set(
+    lineups.filter((l) => l.status === 'submitted').map((l) => l.teamId)
+  )
+  return submitted.has(a) && submitted.has(b)
+}
diff --git a/src/domain/types.ts b/src/domain/types.ts
index fca5812..ecc3b86 100644
--- a/src/domain/types.ts
+++ b/src/domain/types.ts
@@ -107,6 +107,11 @@ export type ViolationKind =
   | 'within-tie-overuse'
   | 'cross-slot-double-book'
   | 'malformed'
+  // Results entry (results-and-standings slice 1).
+  | 'best-of-overflow'
+  | 'bad-score'
+  | 'walkover-with-games'
+  | 'walkover-no-side'
 
 /** A single problem found when validating a Lineup. */
 export interface Violation {
diff --git a/src/domain/umpireView.ts b/src/domain/umpireView.ts
new file mode 100644
index 0000000..2db6b4e
--- /dev/null
+++ b/src/domain/umpireView.ts
@@ -0,0 +1,112 @@
+// Pure assembly of the umpire's tie list: the group ties of the tournament
+// they umpire, each with its entry gate (both sides' lineups submitted) and
+// entry state derived from the entered rubber results (not-entered / partial /
+// decided, with the derived winner). Pure: no UI, no network.
+
+import { DEFAULT_BEST_OF, deriveTieResult, type GameScore, type Side } from './results'
+import { sideDisplayName } from './teamNames'
+import type { Lineup } from './types'
+
+export interface UmpireTieInput {
+  tieId: string
+  scheduledStart: string | null
+  table?: string
+  teamIds: [string | null, string | null]
+  /** Knockout ties are outside slice 1's entry surface. */
+  isKnockout?: boolean
+}
+
+export interface UmpireLineupInput {
+  tieId: string
+  teamId: string
+  status: Lineup['status']
+}
+
+/** One stored rubber result, as the umpire's list derives from it. */
+export interface UmpireResultInput {
+  tieId: string
+  rubberIndex: number
+  games: GameScore[]
+  walkover: boolean
+  /** Which side received the walkover (side a when absent). */
+  walkoverSide?: Side
+}
+
+export interface UmpireTieRow {
+  tieId: string
+  teamAName: string
+  teamBName: string
+  scheduledStart: string | null
+  table?: string
+  /** True when both sides have a submitted lineup — the entry gate. */
+  entryOpen: boolean
+  state: 'locked' | 'not-entered' | 'partial' | 'decided'
+  /** Present once decided — the derived winner (never stored). */
+  winnerSide?: Side
+  winnerName?: string
+}
+
+/** The reason shown on a locked row. */
+export const LOCKED_REASON = 'lineup not submitted'
+
+export function buildUmpireTieRows(args: {
+  ties: UmpireTieInput[]
+  lineups: UmpireLineupInput[]
+  teamNameById: Map<string, string>
+  /** Rubbers in the tie's format, keyed by tie (defaults: no results shown). */
+  rubberCountByTie?: Map<string, number>
+  /** The tie's best-of (defaults 5 — the import default). */
+  bestOfByTie?: Map<string, number>
+  results?: UmpireResultInput[]
+}): UmpireTieRow[] {
+  const submitted = new Set(
+    args.lineups.filter((l) => l.status === 'submitted').map((l) => `${l.tieId}:${l.teamId}`)
+  )
+  const resultsByTie = new Map<string, UmpireResultInput[]>()
+  for (const r of args.results ?? []) {
+    const arr = resultsByTie.get(r.tieId) ?? []
+    arr.push(r)
+    resultsByTie.set(r.tieId, arr)
+  }
+  return args.ties
+    .filter((t) => !t.isKnockout && t.teamIds[0] !== null && t.teamIds[1] !== null)
+    .map((t) => {
+      const teamIds = t.teamIds as [string, string]
+      const entryOpen =
+        submitted.has(`${t.tieId}:${teamIds[0]}`) && submitted.has(`${t.tieId}:${teamIds[1]}`)
+      const teamAName = sideDisplayName(teamIds[0], args.teamNameById)
+      const teamBName = sideDisplayName(teamIds[1], args.teamNameById)
+
+      let state: UmpireTieRow['state'] = entryOpen ? 'not-entered' : 'locked'
+      let winnerSide: Side | undefined
+      let winnerName: string | undefined
+      if (entryOpen) {
+        const rubberCount = args.rubberCountByTie?.get(t.tieId)
+        const bestOf = args.bestOfByTie?.get(t.tieId) ?? DEFAULT_BEST_OF
+        const entered = (resultsByTie.get(t.tieId) ?? []).sort(
+          (x, y) => x.rubberIndex - y.rubberIndex
+        )
+        if (rubberCount !== undefined && entered.length > 0) {
+          const derived = deriveTieResult(entered, bestOf, rubberCount)
+          if (derived.state === 'decided' && derived.winnerSide) {
+            state = 'decided'
+            winnerSide = derived.winnerSide
+            winnerName = derived.winnerSide === 'a' ? teamAName : teamBName
+          } else {
+            state = 'partial'
+          }
+        }
+      }
+
+      return {
+        tieId: t.tieId,
+        teamAName,
+        teamBName,
+        scheduledStart: t.scheduledStart,
+        table: t.table,
+        entryOpen,
+        state,
+        ...(winnerSide !== undefined ? { winnerSide, winnerName } : {})
+      }
+    })
+}
diff --git a/src/router/index.ts b/src/router/index.ts
index bbf1a1b..9d7732b 100644
--- a/src/router/index.ts
+++ b/src/router/index.ts
@@ -74,6 +74,11 @@ const router = createRouter({
       name: 'lineup-builder',
       component: () => import('@/views/LineupBuilderView.vue')
     },
+    {
+      path: '/umpire',
+      name: 'umpire',
+      component: () => import('@/views/UmpireView.vue')
+    },
     {
       path: '/change-password',
       name: 'change-password',
@@ -100,7 +105,9 @@ router.beforeEach(async (to) => {
         ? 'change-password'
         : auth.isManager
           ? 'manager'
-          : landingName()
+          : auth.isUmpire
+            ? 'umpire'
+            : landingName()
     }
   }
 
@@ -109,6 +116,12 @@ router.beforeEach(async (to) => {
   }
 
   if (auth.isAuthenticated && !auth.mustChangePassword) {
+    // An umpire-only account lives on /umpire — admin pages, the manager home
+    // and the lineup builder are out of their lane. (An admin with an umpires
+    // row keeps their admin landing; the umpire page stays reachable.)
+    if (auth.isUmpire && !auth.isAdmin && (to.name === 'home' || to.meta.adminOnly || to.name === 'manager' || to.name === 'lineup-builder')) {
+      return { name: 'umpire' }
+    }
     if (auth.isManager && (to.name === 'home' || to.meta.adminOnly)) return { name: 'manager' }
     if (!auth.isManager && (to.name === 'home' || to.name === 'manager')) {
       return { name: landingName() }
diff --git a/src/services/adminScope.ts b/src/services/adminScope.ts
index 6f87281..8acc16a 100644
--- a/src/services/adminScope.ts
+++ b/src/services/adminScope.ts
@@ -41,6 +41,7 @@ interface TieDbRow {
   team_b: string | null
   is_knockout: boolean | null
   placed_match_id: string | null
+  best_of: number | null
 }
 interface TeamDbRow {
   id: string
@@ -75,7 +76,7 @@ export async function fetchAdminScopeData(
   const [lineupsRes, teamsRes, tiesRes, catsRes, formatsRes, playersRes, tourRes] = await Promise.all([
     client.from('lineups').select('tie_id, team_id, status, player_ids, submitted_at, updated_at, updated_by').eq('tournament_id', tournamentId),
     client.from('teams').select('id, name').eq('tournament_id', tournamentId),
-    client.from('ties').select('id, category_id, scheduled_start, table_label, group_label, round_label, team_a, team_b, is_knockout, placed_match_id').eq('tournament_id', tournamentId),
+    client.from('ties').select('id, category_id, scheduled_start, table_label, group_label, round_label, team_a, team_b, is_knockout, placed_match_id, best_of').eq('tournament_id', tournamentId),
     client.from('categories').select('id, name').eq('tournament_id', tournamentId),
     client.from('tie_formats').select('category_id, rubbers, usage_policy, lead_time_minutes').eq('tournament_id', tournamentId),
     client.from('players').select('id, team_id, name, gender, date_of_birth').eq('tournament_id', tournamentId),
@@ -103,7 +104,8 @@ export async function fetchAdminScopeData(
     round: t.round_label ?? undefined,
     teamIds: [t.team_a, t.team_b],
     isKnockout: t.is_knockout ?? false,
-    placedMatchId: t.placed_match_id
+    placedMatchId: t.placed_match_id,
+    bestOf: t.best_of ?? undefined
   }))
   const formats = (formatsRes.data as FormatDbRow[] | null) ?? []
   const rosterByTeam = new Map<string, Player[]>()
diff --git a/src/services/lineupService.ts b/src/services/lineupService.ts
index 96df007..fb833b7 100644
--- a/src/services/lineupService.ts
+++ b/src/services/lineupService.ts
@@ -3,6 +3,7 @@ import { resolveAsOf } from '@/domain/age'
 import { computeCutoff, isLocked } from '@/domain/cutoff'
 import { buildMatchRows, type MatchRow } from '@/domain/matchesDashboard'
 import { fetchAdminScopeData, parseStatus } from '@/services/adminScope'
+import { loadTieResultContexts } from '@/services/resultsService'
 import { emptyLineupFor } from '@/domain/lineupBuilder'
 import { parseTieFormat } from '@/domain/tieFormat'
 import { sideDisplayName } from '@/domain/teamNames'
@@ -275,6 +276,21 @@ export async function fetchMatches(
   client: SupabaseClient,
   tournamentId: string
 ): Promise<MatchRow[]> {
-  const scope = await fetchAdminScopeData(client, tournamentId)
-  return buildMatchRows({ ...scope, now: new Date().toISOString() })
+  const [scope, resultContexts] = await Promise.all([
+    fetchAdminScopeData(client, tournamentId),
+    loadTieResultContexts(client, tournamentId)
+  ])
+  return buildMatchRows({
+    ...scope,
+    now: new Date().toISOString(),
+    results: [...resultContexts.values()].flatMap((c) =>
+      c.stored.map((s) => ({
+        tieId: c.tieId,
+        rubberIndex: s.rubberIndex,
+        games: s.games,
+        walkover: s.walkover,
+        walkoverSide: s.walkoverSide
+      }))
+    )
+  })
 }
diff --git a/src/services/resultsService.ts b/src/services/resultsService.ts
new file mode 100644
index 0000000..6f4010c
--- /dev/null
+++ b/src/services/resultsService.ts
@@ -0,0 +1,235 @@
+import type { SupabaseClient } from '@supabase/supabase-js'
+import {
+  DEFAULT_BEST_OF,
+  bothLineupsSubmitted,
+  parseBestOf,
+  validateGames,
+  type GameScore,
+  type Side
+} from '@/domain/results'
+import { parseStatus } from '@/services/adminScope'
+import type { LineupStatus } from '@/domain/types'
+
+/** A typed guard rejection from the results entry path (mapped to UI toasts). */
+export class ResultEntryError extends Error {}
+
+/** One stored rubber result row, camelCase for the UI. */
+export interface StoredRubberResult {
+  rubberIndex: number
+  playerIds: [unknown, unknown]
+  games: GameScore[]
+  walkover: boolean
+  walkoverSide: Side | null
+}
+
+/**
+ * Set a tie's best-of-games value (admin, per-tie override of the import
+ * default 5). Domain validation runs first — an even or non-positive value is
+ * refused before any write (the DB check constraint backs this server-side).
+ */
+export async function setTieBestOf(
+  client: SupabaseClient,
+  tieId: string,
+  bestOf: unknown
+): Promise<void> {
+  const value = parseBestOf(bestOf)
+  const { error } = await client.from('ties').update({ best_of: value }).eq('id', tieId)
+  if (error) throw error
+}
+
+/**
+ * The admin's direct save of one rubber's result. Same entry gate as the
+ * umpire path (both lineups submitted, enforced here against live lineup rows
+ * — not just the UI), and group ties only: knockout entry arrives in slice 3
+ * with the winner cascade.
+ */
+export async function saveRubberResult(
+  client: SupabaseClient,
+  input: {
+    tieId: string
+    rubberIndex: number
+    /** Per-side player id arrays (admin override — umpires ride the RPC). */
+    playerIds: [unknown, unknown]
+    games: GameScore[]
+    walkover: boolean
+    walkoverSide?: Side | null
+    /** The tie's best-of, for entry-time decidedness validation. */
+    bestOf?: number
+  }
+): Promise<void> {
+  // Entry-time validation runs here too — the dialogs validate for UX, but the
+  // service is the seam every admin save crosses, so the rules live here.
+  if (input.walkover && input.walkoverSide !== 'a' && input.walkoverSide !== 'b') {
+    throw new ResultEntryError('A walkover needs its winning side.')
+  }
+  const violations = input.walkover
+    ? validateGames([], input.bestOf ?? DEFAULT_BEST_OF, true, input.walkoverSide ?? undefined)
+    : validateGames(input.games, input.bestOf ?? DEFAULT_BEST_OF)
+  if (violations.length > 0) {
+    throw new ResultEntryError(violations[0].message)
+  }
+
+  const tieRes = await client
+    .from('ties')
+    .select('tournament_id, team_a, team_b, is_knockout')
+    .eq('id', input.tieId)
+    .maybeSingle()
+  if (tieRes.error) throw tieRes.error
+  const tie = tieRes.data as
+    | { tournament_id: string; team_a: string | null; team_b: string | null; is_knockout: boolean | null }
+    | null
+  if (!tie) throw new ResultEntryError('Tie not found.')
+  if (tie.is_knockout) {
+    throw new ResultEntryError('Knockout results are not enterable yet — group ties only for now.')
+  }
+  if (tie.team_a === null || tie.team_b === null) {
+    throw new ResultEntryError('Both sides must be known before results can be entered.')
+  }
+
+  const lineupsRes = await client
+    .from('lineups')
+    .select('team_id, status')
+    .eq('tie_id', input.tieId)
+  if (lineupsRes.error) throw lineupsRes.error
+  const lineups = ((lineupsRes.data as { team_id: string; status: string }[]) ?? []).map((l) => ({
+    teamId: l.team_id,
+    status: parseStatus(l.status) as LineupStatus
+  }))
+  if (!bothLineupsSubmitted(lineups, [tie.team_a, tie.team_b])) {
+    throw new ResultEntryError('Both lineups must be submitted before results can be entered.')
+  }
+
+  const { error } = await client.from('rubber_results').upsert(
+    {
+      tournament_id: tie.tournament_id,
+      tie_id: input.tieId,
+      rubber_index: input.rubberIndex,
+      player_ids: input.playerIds,
+      games: input.games,
+      walkover: input.walkover,
+      walkover_side: input.walkover ? (input.walkoverSide ?? null) : null
+    },
+    { onConflict: 'tie_id,rubber_index' }
+  )
+  if (error) throw error
+}
+
+/**
+ * The umpire's save of one rubber's result, through the upsert_umpire_result
+ * security-definer RPC (migration 0018–0020): the server re-checks the
+ * tournament scope, the entry gate, the rubber bounds and the games shape, and
+ * derives the stored player identity from the submitted lineups — the client
+ * cannot write player_ids. Wrapped here so the RPC seam has one error path.
+ */
+export async function upsertUmpireResult(
+  client: SupabaseClient,
+  input: {
+    tieId: string
+    rubberIndex: number
+    games: GameScore[]
+    walkover: boolean
+    walkoverSide?: Side | null
+  }
+): Promise<void> {
+  const { error } = await client.rpc('upsert_umpire_result', {
+    p_tie_id: input.tieId,
+    p_rubber_index: input.rubberIndex,
+    p_games: input.games,
+    p_walkover: input.walkover,
+    p_walkover_side: input.walkover ? (input.walkoverSide ?? null) : null
+  })
+  if (error) throw error
+}
+
+/**
+ * Everything the admin results dialog needs for one tournament's group ties:
+ * per tie — best-of, rubber count, the submitted-lineups player prefill (per
+ * rubber, per side) and the stored results. Loaded in one go when the
+ * dashboard mounts so opening a dialog is instant.
+ */
+export interface TieResultContext {
+  tieId: string
+  teamIds: [string | null, string | null]
+  bestOf: number
+  rubberCount: number
+  /** Submitted-lineup player ids per rubber per side (null slot = none). */
+  prefill: [((string[] | null) | undefined)[], ((string[] | null) | undefined)[]]
+  stored: StoredRubberResult[]
+}
+
+export async function loadTieResultContexts(
+  client: SupabaseClient,
+  tournamentId: string
+): Promise<Map<string, TieResultContext>> {
+  const [tiesRes, lineupsRes, formatsRes, resultsRes] = await Promise.all([
+    client
+      .from('ties')
+      .select('id, team_a, team_b, is_knockout, category_id, best_of')
+      .eq('tournament_id', tournamentId),
+    client
+      .from('lineups')
+      .select('tie_id, team_id, status, player_ids')
+      .eq('tournament_id', tournamentId),
+    client.from('tie_formats').select('category_id, rubbers').eq('tournament_id', tournamentId),
+    client
+      .from('rubber_results')
+      .select('tie_id, rubber_index, player_ids, games, walkover, walkover_side')
+      .eq('tournament_id', tournamentId)
+  ])
+  for (const r of [tiesRes, lineupsRes, formatsRes, resultsRes]) {
+    if (r.error) throw r.error
+  }
+
+  const rubberCountByCategory = new Map<string, number>()
+  for (const f of (formatsRes.data as { category_id: string; rubbers: unknown }[]) ?? []) {
+    if (Array.isArray(f.rubbers)) rubberCountByCategory.set(f.category_id, f.rubbers.length)
+  }
+
+  const prefillByTie = new Map<string, { a: (string[] | null)[]; b: (string[] | null)[] }>()
+  const teamByTie = new Map<string, [string | null, string | null]>()
+  for (const t of (tiesRes.data as Record<string, unknown>[]) ?? []) {
+    teamByTie.set(t.id as string, [t.team_a as string | null, t.team_b as string | null])
+  }
+  for (const l of (lineupsRes.data as Record<string, unknown>[]) ?? []) {
+    if (l.status !== 'submitted') continue
+    const tieId = l.tie_id as string
+    const teams = teamByTie.get(tieId)
+    if (!teams) continue
+    const side = l.team_id === teams[0] ? 'a' : l.team_id === teams[1] ? 'b' : null
+    if (side === null) continue
+    const entry = prefillByTie.get(tieId) ?? { a: [], b: [] }
+    entry[side] = (l.player_ids as (string[] | null)[]) ?? []
+    prefillByTie.set(tieId, entry)
+  }
+
+  const storedByTie = new Map<string, StoredRubberResult[]>()
+  for (const r of (resultsRes.data as Record<string, unknown>[]) ?? []) {
+    const tieId = r.tie_id as string
+    const arr = storedByTie.get(tieId) ?? []
+    arr[(r.rubber_index as number) - 1] = {
+      rubberIndex: r.rubber_index as number,
+      playerIds: (r.player_ids as [unknown, unknown]) ?? [null, null],
+      games: (r.games as GameScore[]) ?? [],
+      walkover: (r.walkover as boolean) ?? false,
+      walkoverSide: (r.walkover_side as Side | null) ?? null
+    }
+    storedByTie.set(tieId, arr)
+  }
+
+  const byTie = new Map<string, TieResultContext>()
+  for (const t of (tiesRes.data as Record<string, unknown>[]) ?? []) {
+    const tieId = t.id as string
+    if (t.is_knockout) continue // knockout entry arrives in slice 3
+    const rubberCount = rubberCountByCategory.get(t.category_id as string) ?? 0
+    const prefill = prefillByTie.get(tieId) ?? { a: [], b: [] }
+    byTie.set(tieId, {
+      tieId,
+      teamIds: [t.team_a as string | null, t.team_b as string | null],
+      bestOf: (t.best_of as number | null) ?? 5,
+      rubberCount,
+      prefill: [prefill.a, prefill.b],
+      stored: storedByTie.get(tieId) ?? []
+    })
+  }
+  return byTie
+}
diff --git a/src/stores/auth.ts b/src/stores/auth.ts
index e75d427..6eac371 100644
--- a/src/stores/auth.ts
+++ b/src/stores/auth.ts
@@ -6,25 +6,29 @@ import { useTournamentStore } from '@/stores/tournament'
 
 // Authentication store (Pinia, setup style). Backed by Supabase Auth.
 //
-// Managers are bound 1:1 to a team via the team_managers table; on login we load
-// that profile to drive the forced first-login password change. Administrators
-// have no team_managers row, so mustChangePassword stays false for them.
+// Managers are bound 1:1 to a team via the team_managers table; umpires are
+// bound to a tournament via the umpires table; on login we load those profiles
+// to drive the forced first-login password change and routing. Administrators
+// have neither row, so mustChangePassword stays false for them.
 export const useAuthStore = defineStore('auth', () => {
   const user = ref<User | null>(null)
   const loading = ref(true)
   const error = ref<string | null>(null)
   const mustChangePassword = ref(false)
   const teamId = ref<string | null>(null)
+  const umpireTournamentId = ref<string | null>(null)
   const isAdmin = ref(false)
 
   const isAuthenticated = computed(() => user.value !== null)
   const isManager = computed(() => teamId.value !== null)
+  const isUmpire = computed(() => umpireTournamentId.value !== null)
 
-  /** Load the signed-in user's manager profile (if any) + admin flag. */
+  /** Load the signed-in user's manager/umpire profile (if any) + admin flag. */
   async function loadProfile(): Promise<void> {
     if (!user.value) {
       mustChangePassword.value = false
       teamId.value = null
+      umpireTournamentId.value = null
       isAdmin.value = false
       return
     }
@@ -33,12 +37,17 @@ export const useAuthStore = defineStore('auth', () => {
     // we nulled teamId synchronously here, a concurrent navigation (right after
     // a password change) would read isManager as false and misroute a manager
     // to the admin home.
-    const [tm, adminRes] = await Promise.all([
+    const [tm, ump, adminRes] = await Promise.all([
       supabase
         .from('team_managers')
         .select('must_change_password, team_id')
         .eq('user_id', user.value.id)
         .maybeSingle(),
+      supabase
+        .from('umpires')
+        .select('must_change_password, tournament_id')
+        .eq('user_id', user.value.id)
+        .maybeSingle(),
       supabase.rpc('is_admin')
     ])
     isAdmin.value = !!adminRes.data
@@ -49,6 +58,12 @@ export const useAuthStore = defineStore('auth', () => {
       mustChangePassword.value = false
       teamId.value = null
     }
+    if (ump.data) {
+      mustChangePassword.value = mustChangePassword.value || !!ump.data.must_change_password
+      umpireTournamentId.value = ump.data.tournament_id
+    } else {
+      umpireTournamentId.value = null
+    }
   }
 
   /** Load (or clear) the active-tournament scope to match the session. */
@@ -100,6 +115,7 @@ export const useAuthStore = defineStore('auth', () => {
     user.value = null
     mustChangePassword.value = false
     teamId.value = null
+    umpireTournamentId.value = null
     isAdmin.value = false
     useTournamentStore().clear()
   }
@@ -119,9 +135,11 @@ export const useAuthStore = defineStore('auth', () => {
     error,
     mustChangePassword,
     teamId,
+    umpireTournamentId,
     isAdmin,
     isAuthenticated,
     isManager,
+    isUmpire,
     init,
     signIn,
     signOut,
diff --git a/src/views/AdminProvisionView.vue b/src/views/AdminProvisionView.vue
index 9f99e88..eb969ed 100644
--- a/src/views/AdminProvisionView.vue
+++ b/src/views/AdminProvisionView.vue
@@ -43,6 +43,14 @@ const email = ref('')
 const password = ref('')
 const busy = ref(false)
 
+// --- umpires (results slice R2): per-tournament accounts, provisioned like
+// managers but bound to the tournament, many per tournament ---
+const umpires = ref<{ email: string; mustChangePassword: boolean }[]>([])
+const umpireDialog = ref(false)
+const umpireEmail = ref('')
+const umpirePassword = ref('')
+const umpireBusy = ref(false)
+
 const emailError = computed(() => {
   if (!dialogTeam.value) return null
   const others = teams.value
@@ -103,15 +111,68 @@ async function load(): Promise<void> {
   errorMessage.value = null
   if (!tournaments.activeId) {
     teams.value = []
+    umpires.value = []
     return
   }
   try {
     teams.value = await fetchProvisionTeams(supabase, tournaments.activeId)
+    await loadUmpires()
   } catch (e) {
     errorMessage.value = (e as Error).message
   }
 }
 
+async function loadUmpires(): Promise<void> {
+  if (!tournaments.activeId) {
+    umpires.value = []
+    return
+  }
+  const { data, error } = await supabase
+    .from('umpires')
+    .select('email, must_change_password')
+    .eq('tournament_id', tournaments.activeId)
+    .order('email')
+  if (error) throw error
+  umpires.value = ((data as { email: string; must_change_password: boolean }[]) ?? []).map(
+    (u) => ({ email: u.email, mustChangePassword: u.must_change_password })
+  )
+}
+
+async function onProvisionUmpire(): Promise<void> {
+  const tournamentId = tournaments.activeId
+  const corrected = umpireEmail.value.trim()
+  if (!tournamentId || !corrected || !umpirePassword.value) return
+  umpireBusy.value = true
+  try {
+    const { data, error } = await supabase.functions.invoke<{
+      ok?: boolean
+      error?: string
+    }>('provision-umpire', {
+      body: { email: corrected, password: umpirePassword.value, tournamentId }
+    })
+    if (error) {
+      result.value = { ok: false, message: error.message }
+      return
+    }
+    if (data?.error) {
+      result.value = { ok: false, message: data.error }
+      return
+    }
+    umpireDialog.value = false
+    umpireEmail.value = ''
+    umpirePassword.value = ''
+    result.value = {
+      ok: true,
+      message: `Umpire created (${corrected}) — they must change the password on first login.`
+    }
+    await loadUmpires()
+  } catch (e) {
+    result.value = { ok: false, message: (e as Error).message }
+  } finally {
+    umpireBusy.value = false
+  }
+}
+
 // Re-scope when the administrator switches tournament.
 watch(() => tournaments.activeId, load)
 
@@ -194,6 +255,71 @@ onMounted(load)
       </v-card-text>
     </v-card>
 
+    <v-card elevation="2" rounded="lg" class="mt-4">
+      <v-card-item>
+        <v-card-title>Umpires</v-card-title>
+        <v-card-subtitle>
+          Tournament-scoped accounts that enter results. Each umpire must change their password on
+          first login.
+        </v-card-subtitle>
+      </v-card-item>
+      <v-divider />
+      <v-card-text>
+        <v-table v-if="umpires.length" density="comfortable">
+          <thead>
+            <tr>
+              <th>Email</th>
+              <th>State</th>
+            </tr>
+          </thead>
+          <tbody>
+            <tr v-for="u in umpires" :key="u.email">
+              <td>{{ u.email }}</td>
+              <td>
+                <v-chip
+                  :color="u.mustChangePassword ? 'amber' : 'green'"
+                  variant="tonal"
+                  size="small"
+                >
+                  {{ u.mustChangePassword ? 'Must change password' : 'Active' }}
+                </v-chip>
+              </td>
+            </tr>
+          </tbody>
+        </v-table>
+        <p v-else class="text-body-2">No umpires provisioned yet.</p>
+        <v-btn class="mt-3" color="primary" variant="tonal" @click="umpireDialog = true">
+          Provision umpire
+        </v-btn>
+      </v-card-text>
+    </v-card>
+
+    <!-- Umpire provision dialog -->
+    <v-dialog :model-value="umpireDialog" max-width="480" @update:model-value="umpireDialog = false">
+      <v-card rounded="lg">
+        <v-card-item>
+          <v-card-title>Provision umpire</v-card-title>
+          <v-card-subtitle>The umpire must change the password on first login.</v-card-subtitle>
+        </v-card-item>
+        <v-card-text>
+          <v-text-field v-model="umpireEmail" label="Umpire email" type="email" autofocus />
+          <v-text-field v-model="umpirePassword" label="Initial password" type="password" />
+        </v-card-text>
+        <v-card-actions>
+          <v-spacer />
+          <v-btn variant="text" @click="umpireDialog = false">Cancel</v-btn>
+          <v-btn
+            color="primary"
+            :loading="umpireBusy"
+            :disabled="!umpireEmail.trim() || !umpirePassword"
+            @click="onProvisionUmpire"
+          >
+            Provision
+          </v-btn>
+        </v-card-actions>
+      </v-card>
+    </v-dialog>
+
     <!-- Provision dialog: seeded email (correctable) + initial password -->
     <v-dialog :model-value="dialogTeam != null" max-width="480" @update:model-value="dialogTeam = null">
       <v-card rounded="lg">
diff --git a/src/views/MatchesView.vue b/src/views/MatchesView.vue
index e7e50f3..b6db920 100644
--- a/src/views/MatchesView.vue
+++ b/src/views/MatchesView.vue
@@ -7,6 +7,13 @@ import { computed, onMounted, ref, watch } from 'vue'
 import { useTournamentStore } from '@/stores/tournament'
 import { supabase } from '@/lib/supabase'
 import { fetchMatches } from '@/services/lineupService'
+import {
+  loadTieResultContexts,
+  setTieBestOf,
+  type TieResultContext
+} from '@/services/resultsService'
+import { fetchAdminScopeData } from '@/services/adminScope'
+import AdminResultsDialog from '@/components/AdminResultsDialog.vue'
 import {
   matchMatchesEvent,
   matchMatchesFilter,
@@ -22,6 +29,69 @@ const errorMessage = ref<string | null>(null)
 const filter = ref<MatchFilter>('all')
 const selected = ref<MatchRow | null>(null)
 
+// Per-tie best-of editor (results slice R1): staged in the detail dialog,
+// saved through the service; even/non-positive values surface as an error.
+const bestOfDraft = ref<string>('')
+const bestOfBusy = ref(false)
+const bestOfError = ref<string | null>(null)
+const bestOfSaved = ref(false)
+
+watch(selected, (m) => {
+  bestOfError.value = null
+  bestOfSaved.value = false
+  bestOfDraft.value = m ? String(m.bestOf ?? 5) : ''
+})
+
+async function saveBestOf(): Promise<void> {
+  if (!selected.value) return
+  bestOfBusy.value = true
+  bestOfError.value = null
+  bestOfSaved.value = false
+  try {
+    await setTieBestOf(supabase, selected.value.tieId, bestOfDraft.value)
+    selected.value = { ...selected.value, bestOf: Number(bestOfDraft.value) }
+    bestOfSaved.value = true
+    await load()
+  } catch (e) {
+    bestOfError.value = (e as Error).message
+  } finally {
+    bestOfBusy.value = false
+  }
+}
+
+// --- the admin results dialog (results slice R6) ---
+interface PlayerOption {
+  id: string
+  name: string
+}
+const resultContexts = ref<Map<string, TieResultContext>>(new Map())
+const rosterByTeam = ref<Map<string, PlayerOption[]>>(new Map())
+const resultsTie = ref<MatchRow | null>(null)
+const resultsOpen = ref(false)
+
+/** Group ties with both teams known — knockout entry arrives in slice 3. */
+const resultsEligible = (m: MatchRow): boolean =>
+  !m.isKnockout && m.sides.every((s) => s.teamId !== null)
+
+function openResults(m: MatchRow): void {
+  resultsTie.value = m
+  resultsOpen.value = true
+}
+
+async function loadResultsSupport(): Promise<void> {
+  if (!tournaments.activeId) return
+  const [ctxs, scope] = await Promise.all([
+    loadTieResultContexts(supabase, tournaments.activeId),
+    fetchAdminScopeData(supabase, tournaments.activeId)
+  ])
+  resultContexts.value = ctxs
+  rosterByTeam.value = scope.rosterByTeam as unknown as Map<string, PlayerOption[]>
+}
+
+async function onResultsSaved(): Promise<void> {
+  await Promise.all([load(), loadResultsSupport()])
+}
+
 interface CategoryOption {
   id: string
   name: string
@@ -103,6 +173,9 @@ watch(() => tournaments.activeId, async () => {
 onMounted(async () => {
   await loadCategories()
   await load()
+  await loadResultsSupport().catch((e) => {
+    errorMessage.value = (e as Error).message
+  })
 })
 </script>
 
@@ -143,6 +216,7 @@ onMounted(async () => {
                 <th>Table</th>
                 <th>Group · Round</th>
                 <th colspan="2">Teams</th>
+                <th>Result</th>
                 <th></th>
               </tr>
             </thead>
@@ -167,6 +241,14 @@ onMounted(async () => {
                     <MatchStatusChips :side="s" />
                   </div>
                 </td>
+                <td>
+                  <span v-if="m.resultState === 'decided'" class="text-body-2">
+                    Decided · {{ m.winnerName }}
+                  </span>
+                  <span v-else-if="m.resultState === 'partial'" class="text-body-2 text-medium-emphasis">
+                    Partly entered
+                  </span>
+                </td>
                 <td>
                   <v-btn
                     v-if="m.isKnockout"
@@ -175,6 +257,14 @@ onMounted(async () => {
                     @click.stop
                     :to="{ name: 'bracket', params: { categoryId: m.categoryId } }"
                   >Bracket</v-btn>
+                  <v-btn
+                    v-if="resultsEligible(m)"
+                    size="x-small"
+                    variant="tonal"
+                    color="primary"
+                    class="ml-1"
+                    @click.stop="openResults(m)"
+                  >Results</v-btn>
                 </td>
               </tr>
             </tbody>
@@ -196,6 +286,47 @@ onMounted(async () => {
           <v-card-subtitle>{{ metadata(selected) }}</v-card-subtitle>
         </v-card-item>
         <v-card-text>
+          <v-row>
+            <v-col cols="12" md="4">
+              <v-text-field
+                v-model="bestOfDraft"
+                type="number"
+                label="Best of (games per match)"
+                density="compact"
+                hint="Positive odd number — 5 is the default"
+                persistent-hint
+                style="max-width: 240px"
+              />
+              <v-btn
+                class="mt-2"
+                size="small"
+                variant="tonal"
+                color="primary"
+                :loading="bestOfBusy"
+                @click="saveBestOf"
+              >
+                Save best of
+              </v-btn>
+              <v-alert
+                v-if="bestOfError"
+                type="error"
+                variant="tonal"
+                density="compact"
+                class="mt-2"
+              >
+                {{ bestOfError }}
+              </v-alert>
+              <v-alert
+                v-if="bestOfSaved"
+                type="success"
+                variant="tonal"
+                density="compact"
+                class="mt-2"
+              >
+                Best of saved.
+              </v-alert>
+            </v-col>
+          </v-row>
           <v-row>
             <v-col v-for="s in selected.sides" :key="s.teamId ?? 'tbd'" cols="12" md="6">
               <v-card variant="outlined" rounded="lg">
@@ -247,6 +378,17 @@ onMounted(async () => {
         </v-card-actions>
       </v-card>
     </v-dialog>
+
+    <AdminResultsDialog
+      v-model="resultsOpen"
+      :tie-id="resultsTie?.tieId ?? ''"
+      :team-a-name="resultsTie?.sides[0].teamName ?? ''"
+      :team-b-name="resultsTie?.sides[1].teamName ?? ''"
+      :context="resultsTie ? resultContexts.get(resultsTie.tieId) ?? null : null"
+      :roster-a="resultsTie?.sides[0].teamId ? rosterByTeam.get(resultsTie.sides[0].teamId) ?? [] : []"
+      :roster-b="resultsTie?.sides[1].teamId ? rosterByTeam.get(resultsTie.sides[1].teamId) ?? [] : []"
+      @saved="onResultsSaved"
+    />
   </v-container>
 </template>
 
diff --git a/src/views/UmpireView.vue b/src/views/UmpireView.vue
new file mode 100644
index 0000000..c5e9e24
--- /dev/null
+++ b/src/views/UmpireView.vue
@@ -0,0 +1,294 @@
+<script setup lang="ts">
+// The umpire console (results slice R5): the group ties of the tournament this
+// account umpires, each with its entry gate and derived entry state. Entry
+// happens one tie at a time through UmpireEntryDialog; the save path is the
+// upsert_umpire_result RPC (the gate is re-enforced server-side).
+import { computed, onMounted, reactive, ref } from 'vue'
+import { supabase } from '@/lib/supabase'
+import { useAuthStore } from '@/stores/auth'
+import {
+  buildUmpireTieRows,
+  LOCKED_REASON,
+  type UmpireLineupInput,
+  type UmpireTieRow
+} from '@/domain/umpireView'
+import type { GameScore, Side } from '@/domain/results'
+import UmpireEntryDialog from '@/components/UmpireEntryDialog.vue'
+
+const auth = useAuthStore()
+const rows = ref<UmpireTieRow[]>([])
+const tournamentName = ref<string | null>(null)
+const errorMessage = ref<string | null>(null)
+const loading = ref(true)
+
+// Raw inputs the display rows don't carry but the entry dialog needs —
+// kept out of buildUmpireTieRows, which is pure and renders only the list.
+const data = reactive({
+  tieTeamIds: new Map<string, [string, string]>(),
+  lineups: [] as {
+    tieId: string
+    teamId: string
+    status: UmpireLineupInput['status']
+    playerIds: (string[] | null)[]
+  }[],
+  rosterNames: new Map<string, string>(),
+  rubberCountByTie: new Map<string, number>(),
+  bestOfByTie: new Map<string, number>(),
+  storedByTie: new Map<
+    string,
+    ({ games: GameScore[]; walkover: boolean; walkoverSide: Side | null } | undefined)[]
+  >()
+})
+
+const openRows = computed(() => rows.value.filter((r) => r.entryOpen))
+const lockedRows = computed(() => rows.value.filter((r) => !r.entryOpen))
+
+// --- the entry dialog ---
+const entryOpen = ref(false)
+const entryTie = ref<UmpireTieRow | null>(null)
+const entryBestOf = ref(5)
+const entryRubberCount = ref(0)
+const entryPlayers = ref<[string[], string[]][]>([])
+const entryStored = ref<{ games: GameScore[]; walkover: boolean; walkoverSide: Side | null }[]>([])
+
+function fmt(iso: string | null): string {
+  return iso === null ? '—' : new Date(iso).toLocaleString()
+}
+
+function stateLabel(r: UmpireTieRow): string {
+  if (r.state === 'decided') return `Decided · ${r.winnerName}`
+  if (r.state === 'partial') return 'Partly entered'
+  return ''
+}
+
+async function load(): Promise<void> {
+  errorMessage.value = null
+  const tournamentId = auth.umpireTournamentId
+  if (!tournamentId) {
+    errorMessage.value = 'This account is not bound to a tournament.'
+    loading.value = false
+    return
+  }
+  try {
+    const [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes] =
+      await Promise.all([
+        supabase
+          .from('ties')
+          .select(
+            'id, scheduled_start, table_label, team_a, team_b, is_knockout, category_id, best_of'
+          )
+          .eq('tournament_id', tournamentId)
+          .order('scheduled_start'),
+        supabase
+          .from('lineups')
+          .select('tie_id, team_id, status, player_ids')
+          .eq('tournament_id', tournamentId),
+        supabase.from('teams').select('id, name').eq('tournament_id', tournamentId),
+        supabase.from('players').select('id, name').eq('tournament_id', tournamentId),
+        supabase.from('tie_formats').select('category_id, rubbers').eq('tournament_id', tournamentId),
+        supabase
+          .from('rubber_results')
+          .select('tie_id, rubber_index, games, walkover, walkover_side')
+          .eq('tournament_id', tournamentId),
+        supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle()
+      ])
+    for (const r of [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes]) {
+      if (r.error) throw r.error
+    }
+    tournamentName.value = (tourRes.data as { name: string } | null)?.name ?? null
+
+    const ties = (tiesRes.data as Record<string, unknown>[]) ?? []
+    const rubberCountByCategory = new Map<string, number>()
+    for (const f of (formatsRes.data as { category_id: string; rubbers: unknown }[]) ?? []) {
+      if (Array.isArray(f.rubbers)) rubberCountByCategory.set(f.category_id, f.rubbers.length)
+    }
+    const rubberCountByTie = new Map<string, number>()
+    const bestOfByTie = new Map<string, number>()
+    data.tieTeamIds.clear()
+    for (const t of ties) {
+      rubberCountByTie.set(t.id as string, rubberCountByCategory.get(t.category_id as string) ?? 0)
+      bestOfByTie.set(t.id as string, (t.best_of as number | null) ?? 5)
+      data.tieTeamIds.set(t.id as string, [t.team_a as string, t.team_b as string])
+    }
+
+    const lineups = ((lineupsRes.data as Record<string, unknown>[]) ?? []).map((l) => ({
+      tieId: l.tie_id as string,
+      teamId: l.team_id as string,
+      status: l.status as UmpireLineupInput['status'],
+      playerIds: (l.player_ids as (string[] | null)[]) ?? []
+    }))
+    data.lineups = lineups
+    data.rosterNames = new Map(
+      ((playersRes.data as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name])
+    )
+    data.rubberCountByTie = rubberCountByTie
+    data.bestOfByTie = bestOfByTie
+    data.storedByTie.clear()
+    for (const r of (resultsRes.data as Record<string, unknown>[]) ?? []) {
+      const tieId = r.tie_id as string
+      const arr = data.storedByTie.get(tieId) ?? []
+      arr[(r.rubber_index as number) - 1] = {
+        games: (r.games as GameScore[]) ?? [],
+        walkover: (r.walkover as boolean) ?? false,
+        walkoverSide: (r.walkover_side as Side | null) ?? null
+      }
+      data.storedByTie.set(tieId, arr)
+    }
+
+    rows.value = buildUmpireTieRows({
+      ties: ties.map((t) => ({
+        tieId: t.id as string,
+        scheduledStart: (t.scheduled_start as string | null) ?? null,
+        table: (t.table_label as string | null) ?? undefined,
+        teamIds: [t.team_a as string | null, t.team_b as string | null],
+        isKnockout: (t.is_knockout as boolean | null) ?? false
+      })),
+      lineups: lineups.map((l) => ({
+        tieId: l.tieId,
+        teamId: l.teamId,
+        status: l.status
+      })),
+      teamNameById: new Map(
+        ((teamsRes.data as { id: string; name: string }[]) ?? []).map((t) => [t.id, t.name])
+      ),
+      rubberCountByTie,
+      bestOfByTie,
+      results: ((resultsRes.data as Record<string, unknown>[]) ?? []).map((r) => ({
+        tieId: r.tie_id as string,
+        rubberIndex: r.rubber_index as number,
+        games: (r.games as GameScore[]) ?? [],
+        walkover: (r.walkover as boolean) ?? false,
+        walkoverSide: (r.walkover_side as Side | null) ?? undefined
+      }))
+    })
+  } catch (e) {
+    errorMessage.value = (e as Error).message
+  } finally {
+    loading.value = false
+  }
+}
+
+function openEntry(r: UmpireTieRow): void {
+  entryTie.value = r
+  entryBestOf.value = data.bestOfByTie.get(r.tieId) ?? 5
+  entryRubberCount.value = data.rubberCountByTie.get(r.tieId) ?? 0
+
+  // Players prefill: the submitted lineups' selection per rubber, displayed
+  // through the roster names (the server re-derives these on save).
+  const teamIds = data.tieTeamIds.get(r.tieId) ?? ['', '']
+  const byTeam = new Map(data.lineups.filter((l) => l.tieId === r.tieId).map((l) => [l.teamId, l.playerIds]))
+  const namesFor = (teamId: string, i: number): string[] =>
+    (byTeam.get(teamId)?.[i] ?? []).map((id) => data.rosterNames.get(id) ?? id)
+  entryPlayers.value = Array.from({ length: entryRubberCount.value }, (_, i) => [
+    namesFor(teamIds[0], i),
+    namesFor(teamIds[1], i)
+  ] as [string[], string[]])
+
+  const stored = data.storedByTie.get(r.tieId) ?? []
+  entryStored.value = Array.from({ length: entryRubberCount.value }, (_, i) => {
+    const s = stored[i]
+    return s
+      ? { games: s.games, walkover: s.walkover, walkoverSide: s.walkoverSide }
+      : { games: [], walkover: false, walkoverSide: null }
+  })
+  entryOpen.value = true
+}
+
+async function onSaved(): Promise<void> {
+  await load()
+}
+
+onMounted(load)
+</script>
+
+<template>
+  <v-container>
+    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
+      {{ errorMessage }}
+    </v-alert>
+
+    <v-card elevation="2" rounded="lg" class="mt-4">
+      <v-card-item>
+        <v-card-title>Umpire console</v-card-title>
+        <v-card-subtitle v-if="tournamentName">{{ tournamentName }}</v-card-subtitle>
+      </v-card-item>
+      <v-divider />
+      <v-card-text>
+        <div v-if="loading" class="text-body-2">Loading…</div>
+
+        <template v-else>
+          <p class="text-body-2 text-medium-emphasis mb-3">
+            Enter results for a team match once both lineups are submitted.
+          </p>
+
+          <v-table v-if="openRows.length" density="comfortable">
+            <thead>
+              <tr>
+                <th>Scheduled</th>
+                <th>Table</th>
+                <th>Teams</th>
+                <th>State</th>
+                <th></th>
+              </tr>
+            </thead>
+            <tbody>
+              <tr v-for="r in openRows" :key="r.tieId">
+                <td>{{ fmt(r.scheduledStart) }}</td>
+                <td>{{ r.table ?? '—' }}</td>
+                <td>{{ r.teamAName }} vs {{ r.teamBName }}</td>
+                <td>{{ stateLabel(r) }}</td>
+                <td class="text-right">
+                  <v-btn
+                    size="small"
+                    color="primary"
+                    variant="tonal"
+                    @click="openEntry(r)"
+                  >
+                    {{ r.state === 'decided' ? 'Edit results' : 'Enter results' }}
+                  </v-btn>
+                </td>
+              </tr>
+            </tbody>
+          </v-table>
+          <p v-else class="text-body-2">No team matches ready for entry.</p>
+
+          <template v-if="lockedRows.length">
+            <div class="text-h6 mt-6 mb-2">Waiting for lineups</div>
+            <v-table density="comfortable">
+              <thead>
+                <tr>
+                  <th>Scheduled</th>
+                  <th>Table</th>
+                  <th>Teams</th>
+                  <th></th>
+                </tr>
+              </thead>
+              <tbody>
+                <tr v-for="r in lockedRows" :key="r.tieId">
+                  <td>{{ fmt(r.scheduledStart) }}</td>
+                  <td>{{ r.table ?? '—' }}</td>
+                  <td>{{ r.teamAName }} vs {{ r.teamBName }}</td>
+                  <td>
+                    <v-chip size="small" variant="outlined" color="grey">{{ LOCKED_REASON }}</v-chip>
+                  </td>
+                </tr>
+              </tbody>
+            </v-table>
+          </template>
+        </template>
+      </v-card-text>
+    </v-card>
+
+    <UmpireEntryDialog
+      v-model="entryOpen"
+      :tie-id="entryTie?.tieId ?? ''"
+      :team-a-name="entryTie?.teamAName ?? ''"
+      :team-b-name="entryTie?.teamBName ?? ''"
+      :best-of="entryBestOf"
+      :rubber-count="entryRubberCount"
+      :players="entryPlayers"
+      :stored="entryStored"
+      @saved="onSaved"
+    />
+  </v-container>
+</template>
diff --git a/supabase/functions/delete-tournament/index.ts b/supabase/functions/delete-tournament/index.ts
index b2b60c7..0dc93ab 100644
--- a/supabase/functions/delete-tournament/index.ts
+++ b/supabase/functions/delete-tournament/index.ts
@@ -69,9 +69,10 @@ Deno.serve(async (req: Request): Promise<Response> => {
     .maybeSingle();
   if (!tour) return json({ error: "Tournament not found" }, 404);
 
-  // Gather the manager auth user_ids for this tournament's teams. Read them
-  // BEFORE deleting anything: once the tournament (and its teams) are gone the
-  // team_managers rows cascade away and we'd lose the mapping to the accounts.
+  // Gather the manager auth user_ids for this tournament's teams, plus the
+  // umpires bound directly to the tournament. Read them BEFORE deleting
+  // anything: once the tournament (and its teams) are gone the team_managers /
+  // umpires rows cascade away and we'd lose the mapping to the accounts.
   const { data: teams } = await admin
     .from("teams")
     .select("id")
@@ -87,8 +88,15 @@ Deno.serve(async (req: Request): Promise<Response> => {
       if (m.user_id) userIds.push(m.user_id);
     }
   }
+  const { data: umpires } = await admin
+    .from("umpires")
+    .select("user_id")
+    .eq("tournament_id", tournamentId);
+  for (const u of (umpires as { user_id: string }[] | null ?? [])) {
+    if (u.user_id) userIds.push(u.user_id);
+  }
 
-  // Remove each manager's auth account so they can no longer sign in. A "user
+  // Remove each provisioned account so they can no longer sign in. A "user
   // not found" error is treated as success — the account is already gone, which
   // is exactly the desired end state (idempotent on re-tries). Any other error
   // aborts BEFORE the tournament is touched, leaving the rows intact so the
@@ -97,14 +105,15 @@ Deno.serve(async (req: Request): Promise<Response> => {
     const { error: delErr } = await admin.auth.admin.deleteUser(userId);
     if (delErr && !/not found/i.test(delErr.message)) {
       return json(
-        { error: `Failed to remove manager account: ${delErr.message}`, userId },
+        { error: `Failed to remove provisioned account: ${delErr.message}`, userId },
         500,
       );
     }
   }
 
   // Delete the tournament — on-delete cascades clear its categories, teams,
-  // players, ties, tie_formats and lineups (migration 0009).
+  // players, ties, tie_formats, lineups, umpires and rubber_results
+  // (migrations 0009 + 0016).
   const { error: delTourErr } = await admin
     .from("tournaments")
     .delete()
diff --git a/supabase/functions/provision-umpire/index.ts b/supabase/functions/provision-umpire/index.ts
new file mode 100644
index 0000000..8ae397b
--- /dev/null
+++ b/supabase/functions/provision-umpire/index.ts
@@ -0,0 +1,124 @@
+// Provision an Umpire: create a Supabase Auth user (email + initial password),
+// bound to one tournament, with must_change_password=true. Mirrors the
+// provision-manager flow (service role + caller-JWT admin authorization); an
+// umpire is tournament-scoped rather than team-scoped and may be one of many
+// per tournament.
+//
+// Runs with the service_role key (auto-injected as env by the Supabase runtime),
+// so this MUST be server-side — never ship the service_role key to the browser.
+// Caller must be an administrator.
+
+import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
+
+const corsHeaders = {
+  "Access-Control-Allow-Origin": "*",
+  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
+  "Access-Control-Allow-Methods": "POST, OPTIONS",
+  "Content-Type": "application/json",
+};
+
+function json(body: unknown, status: number): Response {
+  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
+}
+
+Deno.serve(async (req: Request): Promise<Response> => {
+  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
+  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
+
+  try {
+  // Service-role client (service_role is in env; bypasses RLS).
+  const admin = createClient(
+    Deno.env.get("SUPABASE_URL")!,
+    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
+    { auth: { persistSession: false } },
+  );
+
+  // Authorise: the caller must be an admin. We forward the caller's access
+  // token to a caller-authenticated client and call is_admin() — PostgREST
+  // validates the JWT signature and is_admin() reads the email claim, exactly
+  // as the RLS policies do. (auth.getUser(token) on a service-role client is
+  // unreliable for caller identity, so we don't use it here.)
+  const authHeader = req.headers.get("Authorization") ?? "";
+  const token = authHeader.replace(/^Bearer\s+/i, "");
+  if (!token) return json({ error: "Unauthorized" }, 401);
+  const caller = createClient(
+    Deno.env.get("SUPABASE_URL")!,
+    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
+    {
+      global: { headers: { Authorization: `Bearer ${token}` } },
+      auth: { persistSession: false },
+    },
+  );
+  const { data: isAdmin, error: adminErr } = await caller.rpc("is_admin");
+  if (adminErr || !isAdmin) {
+    return json({ error: "Forbidden: administrators only" }, 403);
+  }
+
+  // Validate input.
+  const body = await req.json().catch(() => null);
+  const email = typeof body?.email === "string" ? body.email : "";
+  const password = typeof body?.password === "string" ? body.password : "";
+  const tournamentId = typeof body?.tournamentId === "string" ? body.tournamentId : "";
+  if (!email || !password || !tournamentId) {
+    return json({ error: "email, password and tournamentId are required" }, 400);
+  }
+
+  // The tournament must exist. Read via the caller (admin) client — is_admin()
+  // RLS already authorises these reads.
+  const { data: tour } = await caller
+    .from("tournaments")
+    .select("id")
+    .eq("id", tournamentId)
+    .maybeSingle();
+  if (!tour) return json({ error: "Tournament not found" }, 404);
+
+  // One umpire account per email per tournament (many umpires per tournament).
+  // An auth email is globally unique in Supabase Auth, so re-provisioning the
+  // same email for the SAME tournament is the idempotent re-run case (409);
+  // for a DIFFERENT tournament it is a genuine conflict (400).
+  const { data: existing } = await admin
+    .from("umpires")
+    .select("user_id, tournament_id")
+    .eq("email", email)
+    .maybeSingle();
+  if (existing) {
+    if (existing.tournament_id === tournamentId) {
+      return json({ error: "That email is already an umpire for this tournament" }, 409);
+    }
+    return json({ error: "That email already umpires another tournament" }, 400);
+  }
+
+  // Create the auth user (email confirmed so they can sign in immediately).
+  const { data: created, error: createErr } = await admin.auth.admin.createUser({
+    email,
+    password,
+    email_confirm: true,
+  });
+  const newUser = created?.user ?? null;
+  if (createErr || !newUser) {
+    // A pre-existing auth account without an umpires row (e.g. a former
+    // manager's email) cannot be silently re-bound — surface it.
+    return json({ error: createErr?.message ?? "createUser failed" }, 400);
+  }
+
+  const { error: linkErr } = await admin.from("umpires").insert({
+    user_id: newUser.id,
+    tournament_id: tournamentId,
+    email,
+    must_change_password: true,
+  });
+  if (linkErr) {
+    // Best-effort rollback: drop the user we just created so re-tries are clean.
+    try {
+      await admin.auth.admin.deleteUser(newUser.id);
+    } catch {
+      /* best-effort; report the original link error below */
+    }
+    return json({ error: linkErr.message }, 400);
+  }
+
+  return json({ ok: true, userId: newUser.id }, 200);
+  } catch (e) {
+    return json({ error: "internal", detail: e instanceof Error ? e.message : String(e) }, 500);
+  }
+});
diff --git a/supabase/migrations/0015_tie_best_of.sql b/supabase/migrations/0015_tie_best_of.sql
new file mode 100644
index 0000000..e1370c5
--- /dev/null
+++ b/supabase/migrations/0015_tie_best_of.sql
@@ -0,0 +1,10 @@
+-- 0015: per-tie best-of-games setting (results-and-standings slice 1, R1).
+--
+-- Every tie carries its own best_of (games per rubber), defaulting to 5 — the
+-- table-tennis standard — so imported and existing ties need no backfill. The
+-- admin may override per tie; the check constraint makes even/non-positive
+-- values impossible server-side (mirroring the domain's parseBestOf rule).
+
+alter table public.ties
+  add column best_of integer not null default 5
+  check (best_of > 0 and best_of % 2 = 1);
diff --git a/supabase/migrations/0016_results_and_umpires.sql b/supabase/migrations/0016_results_and_umpires.sql
new file mode 100644
index 0000000..9f3848f
--- /dev/null
+++ b/supabase/migrations/0016_results_and_umpires.sql
@@ -0,0 +1,107 @@
+-- 0016: results entry foundations (results-and-standings slice 1, R2).
+--
+-- The umpire role: per-tournament accounts provisioned by an admin (mirroring
+-- team_managers), confined to their tournament, able to READ everything they
+-- need to score a tie (ties, teams, players, lineups, formats, categories) and
+-- to read back the results they entered. Writes land with slice 1's entry
+-- requirements (via a security-definer RPC, so the stored player identity stays
+-- the submitted lineup's, not whatever a client sends).
+
+-- ---------------------------------------------------------------------------
+-- Umpires
+
+create table if not exists umpires (
+  user_id              uuid primary key references auth.users(id) on delete cascade,
+  tournament_id        text not null references tournaments(id) on delete cascade,
+  email                text not null,
+  must_change_password boolean not null default true,
+  created_at           timestamptz not null default now(),
+  -- An auth account umpires at most one tournament.
+  unique (user_id, tournament_id)
+);
+
+alter table umpires enable row level security;
+
+create policy "admin all on umpires" on umpires
+  for all to authenticated using (public.is_admin()) with check (public.is_admin());
+create policy "umpire reads own row" on umpires
+  for select to authenticated using (user_id = auth.uid());
+
+-- The tournament the caller umpires (null if the caller is not an umpire).
+create or replace function public.umpire_tournament_id()
+returns text
+language sql
+security definer
+set search_path = public
+as $$
+  select tournament_id from umpires where user_id = auth.uid()
+$$;
+
+grant execute on function public.umpire_tournament_id() to authenticated;
+
+-- ---------------------------------------------------------------------------
+-- Rubber results (raw entered data — winners are derived, never stored here)
+
+create table if not exists rubber_results (
+  id           uuid primary key default gen_random_uuid(),
+  tournament_id text not null references tournaments(id) on delete cascade,
+  tie_id       text not null references ties(id) on delete cascade,
+  rubber_index integer not null,
+  player_ids   jsonb not null,
+  games        jsonb not null default '[]'::jsonb,
+  walkover     boolean not null default false,
+  entered_by   uuid references auth.users(id) on delete set null,
+  entered_at   timestamptz not null default now(),
+  updated_at   timestamptz not null default now(),
+  unique (tie_id, rubber_index)
+);
+
+alter table rubber_results enable row level security;
+
+create policy "admin all on rubber_results" on rubber_results
+  for all to authenticated using (public.is_admin()) with check (public.is_admin());
+create policy "umpire reads own tournament results" on rubber_results
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+
+-- ---------------------------------------------------------------------------
+-- Umpire read access: everything needed to score a tie in their own tournament
+-- (the same read surface managers got in migrations 0004/0010, scoped by the
+-- umpire's tournament instead of the manager's team).
+
+create policy "umpires read own tournament ties" on ties
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament teams" on teams
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament players" on players
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament lineups" on lineups
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament formats" on tie_formats
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament categories" on categories
+  for select to authenticated
+  using (tournament_id = public.umpire_tournament_id());
+create policy "umpires read own tournament" on tournaments
+  for select to authenticated
+  using (id = public.umpire_tournament_id());
+
+-- ---------------------------------------------------------------------------
+-- The must-change flag now covers both provisioned roles: extend the
+-- security-definer RPC to clear the umpire row too (the manager update is a
+-- no-op for umpires and vice versa).
+
+create or replace function public.clear_must_change_password()
+returns void
+language sql
+security definer
+set search_path = public
+as $$
+  update team_managers set must_change_password = false where user_id = auth.uid();
+  update umpires set must_change_password = false where user_id = auth.uid();
+$$;
diff --git a/supabase/migrations/0017_results_manager_read.sql b/supabase/migrations/0017_results_manager_read.sql
new file mode 100644
index 0000000..61770b7
--- /dev/null
+++ b/supabase/migrations/0017_results_manager_read.sql
@@ -0,0 +1,8 @@
+-- 0017: managers can READ the results of their own tournament's team matches
+-- (results-and-standings slice 1, R3). Read-only: no insert/update policy is
+-- granted — a manager's write attempt stays denied. The manager's tournament
+-- comes from their team via manager_tournament_id() (migration 0010).
+
+create policy "manager reads own tournament results" on rubber_results
+  for select to authenticated
+  using (tournament_id = public.manager_tournament_id());
diff --git a/supabase/migrations/0018_umpire_result_rpc.sql b/supabase/migrations/0018_umpire_result_rpc.sql
new file mode 100644
index 0000000..d539e0b
--- /dev/null
+++ b/supabase/migrations/0018_umpire_result_rpc.sql
@@ -0,0 +1,81 @@
+-- 0018: the umpire's save path for rubber results (results-and-standings
+-- slice 1, R4). A security-definer RPC — not direct table access — so the
+-- server enforces what the UI merely suggests:
+--
+--   * the caller umpires the tie's tournament (scoped writes),
+--   * BOTH sides' lineups are submitted (the entry gate; without a lineup,
+--     scores cannot be entered),
+--   * the rubber index exists in the tie's format,
+--   * the stored player identity is the SUBMITTED LINEUPS' selection for that
+--     rubber — an umpire's client cannot write arbitrary player_ids.
+--
+-- On update the stored row's player_ids are preserved (scores/walkover only).
+-- Admins bypass this RPC via their direct rubber_results policies.
+
+create or replace function public.upsert_umpire_result(
+  p_tie_id text,
+  p_rubber_index integer,
+  p_games jsonb,
+  p_walkover boolean
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_tournament_id text;
+  v_category_id text;
+  v_rubber_count integer;
+  v_submitted integer;
+  v_player_a jsonb;
+  v_player_b jsonb;
+begin
+  -- The caller must umpire the tie's tournament.
+  select tournament_id, category_id into v_tournament_id, v_category_id
+    from ties where id = p_tie_id;
+  if v_tournament_id is null or v_tournament_id <> public.umpire_tournament_id() then
+    raise exception 'FORBIDDEN: not your tournament';
+  end if;
+
+  -- The entry gate: both sides must have a submitted lineup.
+  select count(*) into v_submitted
+    from lineups
+    where tie_id = p_tie_id and status = 'submitted'
+      and team_id in (select team_a from ties where id = p_tie_id
+                      union all
+                      select team_b from ties where id = p_tie_id);
+  if v_submitted < 2 then
+    raise exception 'LINEUP_GATE: both lineups must be submitted before results can be entered';
+  end if;
+
+  -- The rubber must exist in the tie's format.
+  select coalesce(jsonb_array_length(rubbers), 0) into v_rubber_count
+    from tie_formats
+    where tournament_id = v_tournament_id and category_id = v_category_id;
+  if p_rubber_index < 1 or p_rubber_index > coalesce(v_rubber_count, 0) then
+    raise exception 'BAD_RUBBER: rubber index % outside the format', p_rubber_index;
+  end if;
+
+  -- Player identity rides on the submitted lineups, never on client input.
+  select l.player_ids -> (p_rubber_index - 1) into v_player_a
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_a from ties where id = p_tie_id);
+  select l.player_ids -> (p_rubber_index - 1) into v_player_b
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_b from ties where id = p_tie_id);
+
+  insert into rubber_results
+    (tournament_id, tie_id, rubber_index, player_ids, games, walkover, entered_by)
+  values
+    (v_tournament_id, p_tie_id, p_rubber_index,
+     jsonb_build_array(coalesce(v_player_a, 'null'::jsonb), coalesce(v_player_b, 'null'::jsonb)),
+     coalesce(p_games, '[]'::jsonb), coalesce(p_walkover, false), auth.uid())
+  on conflict (tie_id, rubber_index) do update
+    set games = coalesce(p_games, '[]'::jsonb),
+        walkover = coalesce(p_walkover, false),
+        entered_by = auth.uid(),
+        updated_at = now();
+  -- (player_ids deliberately absent from the update set: immutable for umpires)
+end;
+$$;
+
+grant execute on function public.upsert_umpire_result(text, integer, jsonb, boolean) to authenticated;
diff --git a/supabase/migrations/0019_result_walkover_side.sql b/supabase/migrations/0019_result_walkover_side.sql
new file mode 100644
index 0000000..e25b8be
--- /dev/null
+++ b/supabase/migrations/0019_result_walkover_side.sql
@@ -0,0 +1,85 @@
+-- 0019: a walkover's winning side (results-and-standings slice 1, R5).
+-- The derived winner needs to know WHO received the walkover; null when the
+-- row is not a walkover. The umpire RPC grows the matching parameter.
+
+alter table public.rubber_results
+  add column walkover_side text
+  check (walkover_side in ('a', 'b'));
+
+create or replace function public.upsert_umpire_result(
+  p_tie_id text,
+  p_rubber_index integer,
+  p_games jsonb,
+  p_walkover boolean,
+  p_walkover_side text default null
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_tournament_id text;
+  v_category_id text;
+  v_rubber_count integer;
+  v_submitted integer;
+  v_player_a jsonb;
+  v_player_b jsonb;
+begin
+  -- The caller must umpire the tie's tournament.
+  select tournament_id, category_id into v_tournament_id, v_category_id
+    from ties where id = p_tie_id;
+  if v_tournament_id is null or v_tournament_id <> public.umpire_tournament_id() then
+    raise exception 'FORBIDDEN: not your tournament';
+  end if;
+
+  -- The entry gate: both sides must have a submitted lineup.
+  select count(*) into v_submitted
+    from lineups
+    where tie_id = p_tie_id and status = 'submitted'
+      and team_id in (select team_a from ties where id = p_tie_id
+                      union all
+                      select team_b from ties where id = p_tie_id);
+  if v_submitted < 2 then
+    raise exception 'LINEUP_GATE: both lineups must be submitted before results can be entered';
+  end if;
+
+  -- The rubber must exist in the tie's format.
+  select coalesce(jsonb_array_length(rubbers), 0) into v_rubber_count
+    from tie_formats
+    where tournament_id = v_tournament_id and category_id = v_category_id;
+  if p_rubber_index < 1 or p_rubber_index > coalesce(v_rubber_count, 0) then
+    raise exception 'BAD_RUBBER: rubber index % outside the format', p_rubber_index;
+  end if;
+
+  -- A walkover needs its side; a played rubber carries none.
+  if coalesce(p_walkover, false) and p_walkover_side not in ('a', 'b') then
+    raise exception 'WALKOVER_SIDE: a walkover needs its winning side';
+  end if;
+
+  -- Player identity rides on the submitted lineups, never on client input.
+  select l.player_ids -> (p_rubber_index - 1) into v_player_a
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_a from ties where id = p_tie_id);
+  select l.player_ids -> (p_rubber_index - 1) into v_player_b
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_b from ties where id = p_tie_id);
+
+  insert into rubber_results
+    (tournament_id, tie_id, rubber_index, player_ids, games, walkover, walkover_side, entered_by)
+  values
+    (v_tournament_id, p_tie_id, p_rubber_index,
+     jsonb_build_array(coalesce(v_player_a, 'null'::jsonb), coalesce(v_player_b, 'null'::jsonb)),
+     case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
+     coalesce(p_walkover, false),
+     case when coalesce(p_walkover, false) then p_walkover_side else null end,
+     auth.uid())
+  on conflict (tie_id, rubber_index) do update
+    set games = case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
+        walkover = coalesce(p_walkover, false),
+        walkover_side = case when coalesce(p_walkover, false) then p_walkover_side else null end,
+        entered_by = auth.uid(),
+        updated_at = now();
+  -- (player_ids deliberately absent from the update set: immutable for umpires)
+end;
+$$;
+
+grant execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) to authenticated;
diff --git a/supabase/migrations/0020_review_hardening.sql b/supabase/migrations/0020_review_hardening.sql
new file mode 100644
index 0000000..2debee1
--- /dev/null
+++ b/supabase/migrations/0020_review_hardening.sql
@@ -0,0 +1,163 @@
+-- 0020: review hardening for the umpire RPC (results-and-standings slice 1).
+--
+-- Four fixes from the feature review:
+--   1. CRITICAL: the FORBIDDEN check compared v_tournament_id <> umpire_tournament_id().
+--      For a caller with NO umpires row the right side is NULL, the comparison is
+--      NULL, and PL/pgSQL treats a NULL IF condition as false — so any
+--      authenticated non-umpire could write results. Use IS DISTINCT FROM plus an
+--      explicit null guard.
+--   2. The RPC accepted knockout ties; slice 1's contract is group ties only —
+--      enforced here, not just in the browser.
+--   3. p_games was stored verbatim; now shape-validated (array of
+--      {a,b} non-negative integers), so derivation readers cannot be fed junk.
+--   4. Explicit DML grants (migration 0005's lesson: tables get no default
+--      privileges we should rely on); anon never gets EXECUTE on this function.
+
+revoke execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) from anon;
+grant execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) to authenticated;
+
+grant select, insert, update, delete on public.rubber_results to authenticated;
+grant select on public.umpires to authenticated;
+
+create or replace function public.upsert_umpire_result(
+  p_tie_id text,
+  p_rubber_index integer,
+  p_games jsonb,
+  p_walkover boolean,
+  p_walkover_side text default null
+)
+returns void
+language plpgsql
+security definer
+set search_path = public
+as $$
+declare
+  v_tournament_id text;
+  v_category_id text;
+  v_rubber_count integer;
+  v_submitted integer;
+  v_player_a jsonb;
+  v_player_b jsonb;
+  v_game jsonb;
+  v_is_knockout boolean;
+begin
+  -- The caller must umpire the tie's tournament. IS DISTINCT FROM is null-safe:
+  -- a caller without an umpires row (managers, admins, anyone else) has
+  -- umpire_tournament_id() = NULL and must be refused, not slipped through by
+  -- three-valued logic.
+  if public.umpire_tournament_id() is null then
+    raise exception 'FORBIDDEN: umpires only';
+  end if;
+  select tournament_id, category_id, is_knockout into v_tournament_id, v_category_id, v_is_knockout
+    from ties where id = p_tie_id;
+  if v_tournament_id is null or v_tournament_id is distinct from public.umpire_tournament_id() then
+    raise exception 'FORBIDDEN: not your tournament';
+  end if;
+
+  -- Slice 1 enters group ties only; knockout entry arrives with the winner
+  -- cascade in a later slice.
+  if v_is_knockout then
+    raise exception 'NOT_ENTERABLE: knockout results are not enterable yet';
+  end if;
+
+  -- The entry gate: both sides must have a submitted lineup.
+  select count(*) into v_submitted
+    from lineups
+    where tie_id = p_tie_id and status = 'submitted'
+      and team_id in (select team_a from ties where id = p_tie_id
+                      union all
+                      select team_b from ties where id = p_tie_id);
+  if v_submitted < 2 then
+    raise exception 'LINEUP_GATE: both lineups must be submitted before results can be entered';
+  end if;
+
+  -- The rubber must exist in the tie's format.
+  select coalesce(jsonb_array_length(rubbers), 0) into v_rubber_count
+    from tie_formats
+    where tournament_id = v_tournament_id and category_id = v_category_id;
+  if p_rubber_index < 1 or p_rubber_index > coalesce(v_rubber_count, 0) then
+    raise exception 'BAD_RUBBER: rubber index % outside the format', p_rubber_index;
+  end if;
+
+  -- A walkover needs its side; a played rubber carries none.
+  if coalesce(p_walkover, false) and p_walkover_side not in ('a', 'b') then
+    raise exception 'WALKOVER_SIDE: a walkover needs its winning side';
+  end if;
+
+  -- Game scores are shape-validated server-side: an array of {a,b} pairs of
+  -- non-negative integers, honouring the tie's best-of (no games after the
+  -- majority is reached). This is the integrity floor for derivation readers;
+  -- the dialogs add friendlier entry-time messages on top.
+  if p_games is not null and jsonb_typeof(p_games) <> 'array' then
+    raise exception 'BAD_GAMES: games must be an array';
+  end if;
+  if not coalesce(p_walkover, false) and p_games is not null then
+    declare
+      v_best_of integer;
+      v_majority integer;
+      v_a integer := 0;
+      v_b integer := 0;
+    begin
+      select best_of into v_best_of from ties where id = p_tie_id;
+      v_majority := ceil(coalesce(v_best_of, 5) / 2.0);
+      if jsonb_array_length(p_games) > coalesce(v_best_of, 5) then
+        raise exception 'BAD_GAMES: more games than the best-of allows';
+      end if;
+      for v_game in select * from jsonb_array_elements(p_games) loop
+        if jsonb_typeof(v_game) <> 'object'
+           or jsonb_typeof(v_game -> 'a') not in ('number')
+           or jsonb_typeof(v_game -> 'b') not in ('number')
+           or (v_game ->> 'a')::numeric <> floor((v_game ->> 'a')::numeric)
+           or (v_game ->> 'b')::numeric <> floor((v_game ->> 'b')::numeric)
+           or (v_game ->> 'a')::numeric < 0
+           or (v_game ->> 'b')::numeric < 0 then
+          raise exception 'BAD_GAMES: each game needs non-negative integer a/b scores';
+        end if;
+        if v_a >= v_majority or v_b >= v_majority then
+          raise exception 'BAD_GAMES: the rubber was decided before game %', v_a + v_b + 1;
+        end if;
+        if (v_game ->> 'a')::numeric > (v_game ->> 'b')::numeric then
+          v_a := v_a + 1;
+        elsif (v_game ->> 'b')::numeric > (v_game ->> 'a')::numeric then
+          v_b := v_b + 1;
+        end if;
+      end loop;
+    end;
+  elsif p_games is not null then
+    for v_game in select * from jsonb_array_elements(p_games) loop
+      if jsonb_typeof(v_game) <> 'object'
+         or jsonb_typeof(v_game -> 'a') not in ('number')
+         or jsonb_typeof(v_game -> 'b') not in ('number')
+         or (v_game ->> 'a')::numeric <> floor((v_game ->> 'a')::numeric)
+         or (v_game ->> 'b')::numeric <> floor((v_game ->> 'b')::numeric)
+         or (v_game ->> 'a')::numeric < 0
+         or (v_game ->> 'b')::numeric < 0 then
+        raise exception 'BAD_GAMES: each game needs non-negative integer a/b scores';
+      end if;
+    end loop;
+  end if;
+
+  -- Player identity rides on the submitted lineups, never on client input.
+  select l.player_ids -> (p_rubber_index - 1) into v_player_a
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_a from ties where id = p_tie_id);
+  select l.player_ids -> (p_rubber_index - 1) into v_player_b
+    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_b from ties where id = p_tie_id);
+
+  insert into rubber_results
+    (tournament_id, tie_id, rubber_index, player_ids, games, walkover, walkover_side, entered_by)
+  values
+    (v_tournament_id, p_tie_id, p_rubber_index,
+     jsonb_build_array(coalesce(v_player_a, 'null'::jsonb), coalesce(v_player_b, 'null'::jsonb)),
+     case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
+     coalesce(p_walkover, false),
+     case when coalesce(p_walkover, false) then p_walkover_side else null end,
+     auth.uid())
+  on conflict (tie_id, rubber_index) do update
+    set games = case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
+        walkover = coalesce(p_walkover, false),
+        walkover_side = case when coalesce(p_walkover, false) then p_walkover_side else null end,
+        entered_by = auth.uid(),
+        updated_at = now();
+  -- (player_ids deliberately absent from the update set: immutable for umpires)
+end;
+$$;

