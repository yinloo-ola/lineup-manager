# Progress: venue-ux

Design: docs/plans/2026-10-30-venue-ux/venue-ux-design.md

Branch: 2026-10-30-venue-ux

Setup: n/a

Started: 2026-10-30T14:20:00Z

Last updated: 2026-10-30T17:24:28.316Z

Feature phase: ship-paused

## Requirements
| # | Done | Requirement | Per-req ceremony | Commit |
|---|------|-------------|-----------------|--------|
| 1 | ✅ | Dual theme (light/dark) with an app-wide toggle that persists | — | 26a9b1d |
| 2 | ✅ | Timeslots derived from scheduled starts by gap clustering | — | 87b02cd |
| 3 | ✅ | Working window = current timeslot + next two, with a show-all escape | — | 1a5525d |
| 4 | ✅ | Umpire console renders match cards grouped by timeslot | — | d3a276d |
| 5 | ✅ | Shelved panel: collapsible, counted, fully reachable by filter and search | — | 93ef726 |
| 6 | ✅ | Matches dashboard renders the same card model with admin extras | — | 7ed8774 |
| 7 | ✅ | Both surfaces refresh on a 20-second poll without losing state | — | 87036a1 |

## Execution summary
| R# | Requirement | How it was built | Deviated? | Evidence |
|----|-------------|------------------|-----------|----------|
| 1 | Dual theme (light/dark) with an app-wide toggle that persists | One token file drives two named Vuetify themes (ttLight/ttDark); ThemeToggle lives in the admin shell app bar and umpire console header; the choice persists in localStorage and main.ts applies it before first paint; html[data-theme] mirrors the theme for CSS tokens. | themePreference's injectable-storage params initially made default calls no-ops — caught by the persistence E2E (reload reverted to light); defaults now resolve to real localStorage | E2E scenario 3 green: toggle → html[data-theme=dark], reload keeps dark; 6 unit tests on the preference logic; unit suite 278/278; commit 26a9b1d |
| 2 | Timeslots derived from scheduled starts by gap clustering | Pure deriveSlots in src/domain/scheduleWindow.ts: distinct scheduled starts sorted, clustered with a 30-minute gap threshold; null-start (knockout) ties excluded; slots carry label/start/tieIds. | — | 6 domain tests green (referee shift clusters, 1h+2.5h grids separate, offset parallel clusters, other-day separation, unsorted/null input, exact-30 vs 31-minute boundary); unit 284/284; commit 87b02cd |
| 3 | Working window = current timeslot + next two, with a show-all escape | computeWindow (current slot by now, lookahead 2, never crossing a UTC day boundary — day-two matches always shelve on day one) and classifySlots (windowed/shelved index split); the show-all escape is the view skipping classification. | red-green found three edge bugs before commit: before-first-slot chose the last slot, empty-window classification showed all, and the window jumped into day two | 16 domain tests green incl. all five acceptance edges (11:20 window, before-first, after-last, other-day, boundary 10:29/10:30); unit 290/290; commit 1a5525d |
| 4 | Umpire console renders match cards grouped by timeslot | MatchCard/SlotSection components + UmpireView rebuilt: cards grouped by derived timeslot (Now-tagged current), ready/decided/pending states, decided cards dimmed with tally 3–1 and an Edit affordance; deriveTieResult now carries the tally; time-then-table order per slot. | tally added to deriveTieResult (design said 'e.g. 3–1' display; the derivation had no tally) | E2E scenario 1 green: window shows 10:30/13:30/16:00 sections, decided card has is-decided + 3–1, one-column stacking untested visually but grid is CSS-auto; unit 295/295; commit d3a276d |
| 5 | Shelved panel: collapsible, counted, fully reachable by filter and search | ShelvedPanel disclosure (aria-expanded, count chip) below the window; expanding reveals shelved slot sections; event filter and search apply across window and shelf because both render the same filtered rows. | — | E2E scenario 1: collapsed shelf shows count and zero cards, expand reveals the two shelved EVU ties, search Kilo leaves only the day-two card anywhere; commit d3a276d |
| 6 | Matches dashboard renders the same card model with admin extras | MatchesView rebuilt on MatchCard/SlotSection/ShelvedPanel: same window/shelf model as the console; admin cards carry per-side lineup chips (in / no lineup / missed cutoff / Needs attention), Results button opening the existing dialog, bracket link on knockout cards; event selector + status filters apply across window and shelf; the row detail dialog (best-of editor, edit-on-behalf) stays reachable by clicking a card. Existing specs updated to the card model with an expandShelf helper. | template bound :tie=c.card while the cards carried {tie,row} — undefined-prop crash caught by the existing admin/format-guard specs during regression; also plumb tally into MatchRow via deriveResultState | results/admin/manage/tournament/format-guard specs 10/10 green after the rebuild; unit 295/295; commit 93ef726 |
| 7 | Both surfaces refresh on a 20-second poll without losing state | startPolling composable with injected deps (unit-tested: interval ticks, hidden-tab pause, immediate return-refresh, stop) + usePolling lifecycle wrapper; wired into UmpireView and MatchesView; first-load failures surface the error alert, mid-session poll failures log and keep the last good data. | — | E2E scenario 2 green: submitting the second lineup then clock.fastForward(20s) flips the pending card to Enter results with no reload; 3 polling unit tests |

## Deviation records

<!-- One short paragraph per design-decision reversal -->

- **Past/Future panels replace the single shelf (owner feedback at ship review)** — the design's single collapsible "Shelved panel" became two collapsibles, Past (earlier timeslots) and Future (beyond the window), and the word "shelf" left the UI entirely. classifySlots now returns {windowed, past, future}; the panel component is CollapsibleMatchGroup (singular count text folded in). The E2E fixtures moved to real-clock relative times after the fake 11:20 clock expired the auth session's JWT at UTC midnight (and a month-end date bug surfaced the same class of risk).

- **R4 and R5 shipped in one commit (d3a276d)** — the console's card grid and its shelf were built as one surface, so the shelf's birth commit is shared with R4. The review-packet helper requires monotonic per-requirement commit bounds, so the Commit cells carry the next commit that touched each requirement's surface; the true per-requirement content is what the Execution summary rows describe. Commit cells are packet bounds, not authorship claims.
- **Past/Future panels replace the single shelf (owner feedback at ship review, 0ec4add)** — the design's single collapsible "Shelved panel" became two collapsibles, Past (earlier timeslots) and Future (beyond the window), and the word "shelf" left the UI entirely. classifySlots now returns {windowed, past, future}; the panel component is CollapsibleMatchGroup (with singular count text — a review pluralization nit folded in).
- **The lineup is the single source of who played (owner decision, 2026-10-31, reversing part of results-slice Q6/Q11)** — the admin results dialog no longer edits players. The owner hit a real desync: results recorded one player while the submitted lineup still showed another. Now both save paths (umpire RPC, admin upsert) derive player identity from the submitted lineups; a substitution is corrected in the lineup builder ("edit on behalf"), and the results prefill follows. rubber_results.player_ids is a derived historical copy, never client-authored. Stored rows keep their recorded players as history; the dialog's column headers always show the current lineups.
- **Window computed on the whole schedule, filters applied within sections (review fix, 87036a1)** — the first implementation windowed the filtered set, letting a search reshape "now"; the reviewer flagged it and the fix matches the design's intent (the shelf stays reachable and "now" never moves because of a filter).

- **R4 and R5 shipped in one commit (d3a276d)** — the console's card grid and its shelf were built as one surface, so the shelf's birth commit is shared with R4. The review-packet helper requires monotonic per-requirement commit bounds, so R5's cell records 93ef726 (the next commit carrying shelf work — the dashboard integrating the same panel), R6's records 7ed8774 (MatchesView poll wiring + openResults await, both in R6's file), and R7's records d050754 (the poll scenario's self-reset re-runnability). The true per-requirement content is what the Execution summary rows describe; the Commit cells are packet bounds, not authorship claims (R7's poll core rides in 7ed8774, recorded under R6; R7's cell carries the review-hardening commit that touched the poll paths).

## Code digest

<!-- Written once, after the feature review passes; never back-filled per requirement. -->

### Summary
The venue screens were rebuilt around a timeslot working window: the umpire console and the Matches dashboard render match cards for the current timeslot plus the next two, everything else collapsing into a counted Shelved panel that search and filters still reach. The whole app gained a token-driven light/dark theme with a persistent toggle, and both surfaces refresh every 20 seconds while visible. Winners are still pure derivations — nothing new is stored.

### Flow
- **Spine** — `load (unchanged loaders) -> deriveSlots (gap-clustered starts, 30-min) -> computeWindow (now + 2, day-safe) -> classifySlots -> SlotSection cards [R4] -> ShelvedPanel (count, expand) [R5]`
- **Spine** — `ThemeToggle -> named Vuetify theme (ttLight/ttDark from tokens) -> html[data-theme] + localStorage -> adopted before first paint [R1]`
- **Spine** — `usePolling -> 20s tick (visible-only) -> existing load fns -> recompute window [R7]`
- **Branches** — `show-all escape -> classification skipped, every slot renders` [R3]
- **Branches** — `search/event filter -> narrows within window AND shelf, never moves Now` [R5]
- **Branches** — `admin card -> lineup chips + Results (only where resultsEligible) + bracket link on knockouts` [R6]
- **Branches** — `tab hidden -> poll skipped; return -> immediate refresh; mid-session poll failure -> keep last good data` [R7]
- **Side effects** — reads: the existing per-surface queries · writes: none (localStorage for the theme choice only)
### Gotchas
- Admin Results buttons are eligibility-gated again — knockout/TBD rows hide them (the review caught a dead-dialog regression).
- Card and heading times render in UTC (tournament-local convention); device-local rendering would disagree on non-UTC devices.
- Scenario 2's E2E self-resets its prior lineup submission — without it a re-run finds the card already ready.
### Key files
- `src/domain/scheduleWindow.ts` — the pure window: gap clustering, lookahead, day-safe classification, in-slot sort.
- `src/views/UmpireView.vue` — the umpire console: cards, window, Past/Future groups, poll.
- `src/views/MatchesView.vue` — the dashboard variant: admin chips, eligibility-gated Results, filters.
- `src/components/MatchCard.vue` — the shared card (states, tally, admin extras, 44px targets).
- `src/components/CollapsibleMatchGroup.vue` — the Past/Future disclosure group (count, aria-expanded).
- `src/themes/tokens.ts` — the single palette source for both named themes.
