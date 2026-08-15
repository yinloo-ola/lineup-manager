# 17 — Provision managers from seeded emails

**What to build:** The Provision managers section inside the shell (spec §7), fed by the seed. Each team's manager email arrives pre-filled from the import (seed v1 guarantees one per team) — provisioning becomes confirming/activating those accounts, not typing emails. The page shows per-manager state (active · must change password · not provisioned yet) so the admin can see at a glance which teams are ready before the tournament starts. Account creation goes through the existing edge-function pattern (service-role, caller-JWT authorization per `provision-manager`); no secrets in client code.

**Blocked by:** 12 (seeded emails), 13 (shell).

**Status:** done (2026-08-15)

- [x] Every team shows its seeded manager email, pre-filled and editable only to correct, not to create from scratch
- [x] Provisioning activates the account via the existing edge-function pattern; per-manager state visible and accurate (active / must change password / not provisioned yet)
- [x] A tournament with all teams provisioned is visibly complete at a glance
- [x] Unit tests for state derivation; provisioning path exercised without any client-held service key

## Evidence

Commits `10ab3b9` (implementation) + `aabb4a2` (review fixes). TDD at the domain seam: 9 `provisionView` tests written red first; full suite 193/193, type-check clean.

- **Domain** (`provisionView.ts`, pure): `provisionState` (no account → **Not provisioned yet**; account with the first-login flag → **Must change password**; flag cleared → **Active**), `provisionSummary` (counts + `allProvisioned`, the at-a-glance signal — an empty tournament counts as complete), and `managerEmailError` (seed-shaped validation via the newly shared `isEmailShape`, plus a case-folded clash check against other teams' emails — one manager has exactly one team).
- **Service** (`provisionService.ts`): `fetchProvisionTeams` joins teams (seeded `manager_email`) with `team_managers` through the tournament's team ids (that table deliberately carries no tournament dimension — ADR 0001); `updateTeamManagerEmail` persists a correction, scoped by tournament + team.
- **View:** per-team table (Team · Manager email · State chip · Provision action on unprovisioned rows only), summary subtitle ("N of M team(s) provisioned" / "All N team(s) provisioned — X active, Y still to change their first password") and a success alert when every team has a Team Manager. The provision dialog pre-fills the seeded email (correctable — validated live; a legacy team with no seeded email starts blank), takes the initial password, and invokes the existing `provision-manager` edge function — no service key anywhere in client code. **Review fix:** the corrected email persists only after the account exists, so a failed provisioning never overwrites the seeded value.
- **e2e:** the import happy-path spec now continues into `/provision` — seeded emails visible per team, "0 of 2 team(s) provisioned", one manager provisioned through the dialog with a corrected unique email (exercising the correction path), "1 of 2" after; cleanup goes through the `delete-tournament` edge function (200 asserted) since the imported tournament now owns a real auth account. **Not run here** (Chromium OS libs missing, as with tickets 12–16). Run `npx playwright test` before merging.
- **Known gap, deliberate:** correcting an email **after** activation has no path — the auth account's email is bound at creation; fixing a typo post-activation means re-provisioning on a fresh team import or an organizer-side change. Recorded here rather than half-built.
