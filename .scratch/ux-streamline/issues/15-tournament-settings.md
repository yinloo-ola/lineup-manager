# 15 — Tournament settings

**What to build:** The Tournament settings section inside the shell (spec §7): managing the **selected** tournament — rename, start-date edit, delete. The selector owns switching; this page owns managing the one already selected — no tournament list here (that was the rejected design). The start date keys the format freeze (ticket 16) and the selector's Active & upcoming grouping, so editing it takes effect in both. Delete asks for explicit confirmation and makes clear what goes with it.

**Blocked by:** 13 (shell).

**Status:** done (2026-08-15)

- [x] Rename, start-date edit, and delete for the selected tournament, inside the shell
- [x] Start-date changes reflected in the selector's grouping and the format-freeze anchor
- [x] Delete requires explicit confirmation; behavior after delete lands the admin somewhere sensible (setup-aware landing rules)
- [x] No tournament list on the page — pointer to the top-right selector for switching instead
- [x] Unit tests cover the rename/delete state transitions; type-check passes

## Evidence

Commits `464ba4d` (implementation) + `d697f1c` (review fixes). TDD at the domain seam: 5 new `tournamentManage` tests written red first (10 total there); full suite 171/171, type-check clean.

- **Domain:** `editUnchanged` (trimmed-name + empty-date-means-null comparison gating Save) and `deleteReady` (checkbox + literal name-match double-confirm) joined `renameError` as pure, unit-tested helpers.
- **View:** `AdminManageView` reworked from the rejected tournament list into a manage-the-**selected**-tournament page: one card (name, start date) with **Edit name / start date** and **Delete tournament**, copy pointing to the top-right selector for switching. Both dialogs retained; the delete dialog snapshots its target at open so a mid-dialog selector switch can't redirect the confirmation. Saving reloads the store, so the selector's Active & upcoming grouping, the shell's freeze anchor, and the app-bar name all follow a start-date/rename change. After a delete that empties the store, the admin lands on `/setup` (setup-aware landing rules); otherwise the store's first-by-name fallback takes over.
- **e2e:** `manage.spec.ts` updated for the selected-tournament flow (`openSettings` helper switches first, asserts via the app-bar location line); the delete test now asserts the fallback tournament by name rather than a loose `/deleted/i` match.
- **Pointers for other tickets:** start-date-required-when-running (spec §6) is the freeze's anchor rule — belongs to [Format freeze and guarded edits](16-format-freeze-and-guarded-edits.md). The view's direct `supabase` calls (pre-existing layer tension, not introduced here) are a general refactor candidate, out of ticket scope.
- **Not run here:** Playwright e2e (Chromium OS libs missing in this environment), as with tickets 12–14. Run `npx playwright test` in the proper environment before merging.
