# 16 — Team match format freeze and guarded pre-start edits

**What to build:** The two format rules from spec §6. **Freeze:** once the tournament has started (anchored on its start date), the Team match format can no longer be amended — the authoring page shows a frozen/disabled state with its reason, and the rail entry carries the lock icon. **Guarded pre-start edit:** before the freeze, a format save that would break already-submitted lineups first shows an impact preview — which team matches and lineups are affected — and requires explicit confirmation; no silent invalidation. A confirmed break surfaces downstream as Needs attention on the dashboard (ticket 14's marker). The authoring form itself is otherwise fine as-is (walkthrough verdict) — this ticket adds the freeze and the guard, not a redesign.

**Blocked by:** 12 (start-date anchor), 13 (shell + rail lock placement).

**Status:** done (2026-08-15)

- [x] Started tournament: authoring page frozen/disabled with reason; rail entry shows the lock icon
- [x] Pre-start breaking save: impact preview (affected team matches + lineups) then explicit confirm; cancel leaves everything untouched
- [x] Confirmed break produces Needs attention states visible on the Matches dashboard
- [x] Non-breaking pre-start saves proceed without the guard
- [x] Unit tests for freeze determination and break-detection; e2e or integration coverage for the guarded path

## Evidence

Commits `78c75d6` (implementation) + `c07e05f` (review fixes). TDD at the domain seam: 13 `formatFreeze` tests written red first; full suite 184/184, type-check clean.

- **Domain** (`formatFreeze.ts`, pure): `isFormatFrozen(startDate, today?)` — the freeze anchor (start date on/before today; null = not started, so pre-v1 tournaments stay editable); `breakingLineups` — every submitted lineup the proposed format breaks, by re-validating the tournament's lineups with the proposal swapped in (`withProposedFormat`); drafts are never breakage. `startDateEditError` guards the anchor from the settings side (ticket 15's deferred pointer): a **started** tournament must keep a start date in the past — clearing *or future-dating* would lift the freeze.
- **Service:** `saveTieFormat` refuses once frozen (every app save path shares the check; a raw-REST write by the admin remains possible — admin RLS is global by design, noted honestly in the doc comment). `previewFormatImpact` computes the impact; both it and `fetchMatches` now sit on one shared `fetchAdminScopeData` seam (`adminScope.ts`) instead of duplicated six-query blocks.
- **View:** the authoring page shows the frozen reason alert with all editing controls + Save disabled once started (switching events stays possible); the rail lock icon now keys off the domain helper. The guard: Save → impact preview → empty means save directly (non-breaking path); breaks open a persistent confirm dialog listing each affected lineup's team match (`Team vs Opponent — scheduled`) with the Needs-attention consequence spelled out; Cancel leaves everything untouched (e2e verifies the stored format is byte-identical after cancel). While editing the page anyway, its on-screen vocabulary was swept to the ubiquitous language: Team event, Matches/Add match, Save Team Match Format, Min/Max age, titled usage options (no raw enums) — sanctioned by spec §1/§2 despite "no redesign" (labels only, zero flow change).
- **Known minor:** the confirm's break list is a snapshot — a lineup submitted between preview and confirm isn't re-previewed (TOCTOU). Accepted; the re-validation on the dashboard is the safety net.
- **e2e:** new `format-guard.spec.ts` (isolated throwaway tournament; beforeAll converges, afterAll clears the freeze test's start date): breaking save → preview names the team match → cancel is a REST-verified no-op → confirm saves → Needs attention on /matches; started tournament → frozen alert + disabled Save. **Not run here** (Chromium OS libs missing, as with tickets 12–15). Run `npx playwright test` before merging.
- **Deferred deliberately:** a DB-level freeze/anchor constraint — the app-layer guards cover every app path; the admin owns the data and can always write raw REST.
- **E2E update (2026-08-15):** the full Playwright suite now runs in this environment (WSL2 Chromium libs extracted user-locally — see AGENTS.md) — 23/23 green twice, alongside 193/193 units. The first run surfaced and fixed real bugs from the untested stretch of tickets 12–17: the store's ambiguous `ties` embed (PGRST201 → silent empty store on every boot), the selector's invalid `{header}` items + Vuetify's search mirror collapsing the menu, and the delete dialog never opening (`openDelete` missed `deleting = true`).
