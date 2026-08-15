# 14 — Matches dashboard

**What to build:** The fixture table decided in spec §5 — the screen the admin runs a tournament day from. One row per team match, sorted ascending by scheduled time then table number, each team's lineup status inline: **Submitted**, **Not submitted**, or **Missed cutoff** (missing past the cutoff — error chip with alert icon and a red-tinted row, unmissable at a glance). Cutoff-passed team matches carry the calm **Locked** chip; a broken-by-format-edit lineup reads Not submitted with the **Needs attention** marker. Group and round show where available (seed-sourced; omitted when absent). Filters: All / Not submitted / Submitted / Past cutoff. Row click drills into a dialog with both teams' lineups side by side, the metadata line (group · round · table · scheduled), and per-team on-behalf actions — **Edit on behalf**, or **Fill lineup on behalf** (error-toned, with the chase-or-fill alert) for a missed-cutoff team — opening the lineup builder as that team. This ticket absorbs the admin-surface vocabulary sweep: raw status enum strings, the `action needed` chip, and `complete`/`incomplete` wording never reach an admin screen again. Chasing stays visibility-only — no nudge controls.

**Blocked by:** 12 (group/round + status data), 13 (shell).

**Status:** done (2026-08-15)

- [x] Fixture table: sort scheduled-time → table; Scheduled/Table/Group·Round/both teams + chips
- [x] Missed cutoff: error chip + red row; Locked: calm match-level chip; Needs attention marker renders where a confirmed format edit broke a submitted lineup
- [x] Filters All / Not submitted / Submitted / Past cutoff, worded exactly per the vocabulary
- [x] Drill-in dialog: both lineups, metadata, Edit/Fill on behalf into the builder (`?team=`)
- [x] No raw enums, action-needed, or complete/incomplete wording on any admin surface
- [x] Unit tests for sort/filter/status derivation; no nudge controls anywhere

## Evidence

Commits `7d5d906` (implementation) + `568bbec` (review fixes). TDD at the domain seam: 18 new `matchesDashboard` tests written red first; full suite 166/166, type-check clean.

- **Domain:** `matchesDashboard.ts` (pure) — `buildMatchRows` yields one row per team match (ties with no lineups included), re-validating each lineup via `buildAdminLineupRows` for the Needs attention marker; `deriveSideStatus` maps to the on-screen vocabulary (an invalidated lineup reads Not submitted + Needs attention even past the cutoff — it is broken, not missing); `compareMatchRows` sorts scheduled-time → table (numeric) → tieId; `matchMatchesFilter` implements All / Not submitted (any team) / Submitted (both) / Past cutoff (locked). 18 unit tests cover all of it.
- **Service:** `fetchMatches` replaces `fetchAdminLineups` (and its view) — same tournament-scoped queries plus `table_label`/`group_label`/`round_label` and `submitted_at`; every query still stamps `tournament_id`.
- **View:** `MatchesView` — filter toggle worded exactly per the vocabulary, fixture table with calm outlined **Locked** chip on the Scheduled column, `MatchStatusChips` component (status chip + alert icon on Missed cutoff + Needs attention marker) shared by table and drill-in dialog, red-tinted rows for missed cutoffs. Drill-in dialog: metadata line (group · round · table · scheduled), both lineups side by side with player names per match, **Edit on behalf** / error-toned **Fill lineup on behalf** (with the chase-or-fill alert) into the builder via `?team=`. Old `AdminLineupsView` deleted; `/admin/lineups` survives as the route alias.
- **Vocabulary sweep:** the shared lineup builder no longer renders raw status enums (`statusLabel` maps to Submitted / Not submitted / Draft), the "action needed" chip/alert became **Needs attention — the Team Match Format changed…**, the `complete`/`incomplete` chips became "Ready to submit / Not ready to submit", and the admin back-link goes to `/matches`. Known follow-up (pre-existing, out of ticket scope): the builder's "Rubber N" headings should become "Match N" — it's shared manager-surface wording, and the manager experience is out of spec scope.
- **Not run here:** Playwright e2e (Chromium OS libs missing in this environment). Three specs updated for the new surface (`admin` — fixture table wording, `invalidate` — Needs attention, `tournament` — "No team matches yet." empty state). Run `npx playwright test` in the proper environment before merging.
- **E2E update (2026-08-15):** the full Playwright suite now runs in this environment (WSL2 Chromium libs extracted user-locally — see AGENTS.md) — 23/23 green twice, alongside 193/193 units. The first run surfaced and fixed real bugs from the untested stretch of tickets 12–17: the store's ambiguous `ties` embed (PGRST201 → silent empty store on every boot), the selector's invalid `{header}` items + Vuetify's search mirror collapsing the menu, and the delete dialog never opening (`openDelete` missed `deleting = true`).
