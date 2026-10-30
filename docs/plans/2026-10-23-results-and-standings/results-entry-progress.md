# Progress: results-entry

Design: docs/plans/2026-10-23-results-and-standings/results-entry-design.md

Branch: 2026-10-23-results-and-standings

Setup: done

Started: 2026-10-25T13:16:14Z

Last updated: 2026-10-25T14:19:02.783Z

Feature phase: done

## Requirements
| # | Done | Requirement | Per-req ceremony | Commit |
|---|------|-------------|-----------------|--------|
| 1 | ✅ | Per-tie best-of setting, default 5, odd-only, admin-editable | — | e024696 |
| 2 | ✅ | Umpire role: per-tournament accounts, provisioned by admin, results-only access | — | 64f7506 |
| 3 | ✅ | Managers can read results of their own tournament's ties | — | ea1d291 |
| 4 | ✅ | Result entry is blocked until both sides' lineups are submitted | — | 2d0814b |
| 5 | ✅ | Umpire enters rubber results (games, walkover) with players locked to the pre-filled lineup | — | 45001fc |
| 6 | ✅ | Admin can enter and freely override any result, including players, at any time | — | ceb2045 |
| 7 | ✅ | Rubber winner and tie winner are derived from stored results and shown without being stored | — | aa54921 |

## Execution summary
| R# | Requirement | How it was built | Deviated? | Evidence |
|----|-------------|------------------|-----------|----------|
| 1 | Per-tie best-of setting, default 5, odd-only, admin-editable | ties.best_of column (default 5, DB check constraint enforces positive odd), domain parseBestOf validator, setTieBestOf service, and a Best-of editor with inline error in the Matches detail dialog. | — | Domain tests 5/5 green + service-role probe: default best_of 5, even update rejected by ties_best_of_check, odd accepted; commit e024696 |
| 2 | Umpire role: per-tournament accounts, provisioned by admin, results-only access | umpires table + rubber_results table with umpire read-scoped RLS (migration 0016), provision-umpire edge function mirroring provision-manager, umpire auth-account cascade in delete-tournament, umpire role in the auth store/router, /umpire console with gated tie list, and an Umpires section in the provisioning page. | migrations split per requirement (0015 best_of, 0016 umpires+results) instead of one combined 0015 — keeps each requirement's commit self-contained; umpire provisioning moved from the spec into e2e global-setup (parallel workers race per-spec provisioning); pre-existing format-guard date time-bomb fixed to unblock the regression gate | RLS probe: own-tournament tie read OK, cross-tournament denied, umpires own-row-only, direct rubber_results insert denied, must-change rpc clears umpire flag; full e2e 28/29 (only feature scenario 1 red at pending entry form); commit 64f7506 |
| 3 | Managers can read results of their own tournament's ties | One select policy on rubber_results scoping managers to manager_tournament_id() (migration 0017); no write policy, so manager inserts error and updates are inert no-ops. | — | REST probe: manager read returns the row, insert denied by RLS, update silently no-ops (stored games unchanged); unit suite 250/250; commit ea1d291 |
| 4 | Result entry is blocked until both sides' lineups are submitted | Security-definer RPC upsert_umpire_result (migration 0018): refuses ungated ties (LINEUP_GATE), out-of-format rubbers (BAD_RUBBER) and non-umpire callers; derives stored player_ids from the submitted lineups and preserves them across umpire updates. The admin save path (saveRubberResult) checks the same gate plus KO/TBD guards. | server-side enforcement via a security-definer RPC rather than column RLS — Postgres row-level policies cannot compare old/new rows, so the RPC is the only way to make player identity ride on the lineups | REST probe: ungated save → LINEUP_GATE, gated save → accepted with player_ids [[pa1],[pb1]] derived, update keeps stored players while updating games, rubber 3 → BAD_RUBBER; domain gate helper 3 tests; commit 2d0814b |
| 5 | Umpire enters rubber results (games, walkover) with players locked to the pre-filled lineup | Domain decidedness (rubberWinner/validateGames/tieWinner), migration 0019 (walkover_side + RPC side param), and the umpire entry dialog: read-only players pre-filled from lineups, best-of-validated game rows, walkover with side; the console derives not-entered/partial/decided states from stored results. | walkover needs its winning side stored — added walkover_side column + RPC parameter (migration 0019) after the design's walkover flag proved insufficient for deriving a winner | Domain 18+8 tests green; feature E2E scenario 1 umpire half green (enter 3-rubber result incl. walkover → 'Decided · Alpha'); unit 266/266; commit 45001fc |
| 6 | Admin can enter and freely override any result, including players, at any time | AdminResultsDialog on Matches rows for eligible group ties: per-rubber player selects (roster-scoped), game rows, walkover with side, best-of — saved through saveRubberResult (same server-side gate as umpires), everything editable at any time regardless of who entered it. | — | Feature E2E override steps green: dialog open, r1 games flipped to Charlie, side A player swapped to Adam, save → stored row shows player_ids [[p7],[p5]] with flipped games and untouched r2 walkover (verified via service-role read); type-check + unit 266/266; commit ceb2045 |
| 7 | Rubber winner and tie winner are derived from stored results and shown without being stored | buildMatchRows derives resultState/winnerName from stored rubber results (rubberWinner + tieWinner, best-of-aware) on every dashboard load; the Matches table shows Decided · X / Partly entered; no winner is ever written to the ties table. | — | Domain 3 new tests (decided/partial/flip-recompute) green; feature E2E fully green — override flips the winner to 'Decided · Charlie' live; commit aa54921 |

## Deviation records

- **Umpire read access is broader than R2's wording.** The design said umpires have "no access to lineups, rosters, formats"; the implementation grants read-only, own-tournament policies on ties/teams/players/lineups/tie_formats/categories (migration 0016). Why: the entry flow the same design specifies (players pre-filled from submitted lineups, per-rubber rubber counts from the format) is impossible without those reads. The write boundary is unchanged: the RPC is the umpires' only write path.
- **Walkovers record their winning side** (`walkover_side`, migration 0019) — the design's per-rubber walkover flag could not derive a winner. Review hardening went further: a side-less walkover is UNDECIDED in derivation, never a default side-A win, and both save paths (RPC + admin service) refuse a side-less walkover.
- **Server-side enforcement lives in a security-definer RPC, not column RLS** (recorded at R4; migration 0020 additionally made the authorization null-safe after the hazard review found `v_tournament_id <> NULL` slipped non-umpires through, added the knockout guard, and server-validated game scores against the tie's best-of).
- **Migrations split per requirement** (0015 best-of, 0016 umpires+results, 0017 manager read, 0018 RPC, 0019 walkover side, 0020 hardening) instead of the design's single "migration 0015" — each requirement's commit stays self-contained.
- **Review hardening commit 046112b**: shared `deriveTieResult` replaces duplicated winner logic in umpireView/matchesDashboard; umpires can edit decided ties (R2's "enter and edit"); the promised RLS e2e boundaries test landed (RPC umpire-only, manager read/write split, cross-tournament denial, player_ids immutability).

## Code digest

<!-- Written once, after the feature review passes; never back-filled per requirement. -->

### Summary
Team-match results can now be entered and corrected. A new per-tournament umpire role scores group ties through a dedicated console; admins override anything from the Matches dashboard; winners are always derived from the raw rubber results — no winner is ever stored. All entry rules (both lineups submitted, best-of decidedness, odd best-of, walkover sides, game shapes) are enforced server-side, not just in the forms.

### Flow
- **Spine** — `login (auth store umpire role) -> /umpire tie list [R2] -> entry gate (both lineups submitted) [R4] -> UmpireEntryDialog games/walkover [R5] -> upsert_umpire_result RPC (scope + gate + rubber + best-of + shape re-checked) -> rubber_results -> derived partial/decided states on every read [R7]`
- **Spine** — `Matches row -> AdminResultsDialog [R6] -> saveRubberResult (gate + validateGames) -> rubber_results -> dashboard deriveResultState [R7]`
- **Branches** — `lineup not submitted -> locked row + LINEUP_GATE` [R4]
- **Branches** — `caller without an umpires row -> FORBIDDEN (null-safe, 0020)` [R2]
- **Branches** — `knockout tie -> NOT_ENTERABLE (0020) / hidden from entry surfaces` (slice 3)
- **Branches** — `even best-of -> rejected client-side + DB check constraint` [R1]
- **Branches** — `games past the majority or malformed -> BAD_GAMES (0020)` [R5]
- **Branches** — `manager writes results -> inert (no write policy, 0017)` [R3]
- **Branches** — `walkover without a recorded side -> undecided rubber, never a default win` (0020)
- **Side effects** — reads: ties/lineups/tie_formats/players/teams/rubber_results (all tournament-scoped) · writes: rubber_results, ties.best_of, umpires + auth accounts (provision-umpire / delete-tournament cascade)
### Gotchas
- [ALERT] The umpire RPC is the integrity floor: a determined admin can still write raw rows via REST with no gate (admin RLS is global by design) — corrections are trusted to the admin role.
- An entered rubber cannot be un-entered through either dialog (no delete path in slice 1); only admin rewrites, not removals.
- A lineup withdrawn (submitted → draft) after entry leaves its results in place and still feeding the derivation; cleanup is an admin job.
- Admin dialogs save rubber-by-rubber; a mid-save server failure leaves earlier rubbers persisted (upserts are idempotent, so retry is safe).
### Key files
- `src/domain/results.ts` — the pure rules: best-of parsing, game validation, and the single shared winner derivation (`deriveTieResult`) both surfaces consume.
- `src/services/resultsService.ts` — both save paths (umpire RPC wrapper, admin upsert), the gate, and the per-tournament result contexts.
- `src/components/UmpireEntryDialog.vue` — the umpire's per-tie entry form; players read-only from the lineups.
- `src/components/AdminResultsDialog.vue` — the admin's everything-editable dialog (players, scores, walkovers, best-of).
- `supabase/migrations/0015–0020` — schema, RLS for three roles, and the hardened security-definer RPC.
