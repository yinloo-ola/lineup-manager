# 14 · Bracket view + dashboard/builder UX

Type: task
Status: resolved
Repo: lineup-manager
Blocked by: 13
Branch: `feat/14-bracket-view-ux` (commit 60cd8bd, stacked on feat/13-bracket-module)

## Scope

Spec §7: the **grouped-table bracket view** (per category, in the admin shell alongside Matches) — round headers, slot rows, side cells with entry + ✕, winner/assignment cell with toggle, meta cell, imported-pool banner with bind/release chips, advance-byes action. Matches dashboard: scheduled KO rows incl. both-TBD pool entries and placed slots with bound schedule, links to the bracket view, "TBD" sides, byes never shown. Builder + manager views: "vs TBD", ungated submission, per-side cutoff chips. Visual reference: `prototype/ko-import-bracket.html` variant C (untracked throwaway).

## Answer

Done 2026-08-19. **Bracket view** (`/bracket/:categoryId?`, rail entry alongside Matches): a pure view-model (`domain/bracketView.ts` — rounds, side cells with canEnter/canClear, pick state, placement options, meta, pool chips, balance/byes status, enterable-teams list; tested) drives the Vuetify grouped table; the component only renders and calls ticket 13's service, reloading after every action. The cascade confirmation enumerates cleared winners and removed lineups with human-readable slot labels ("QF · Alpha vs TBD"). **Matches dashboard**: `mergeKnockoutForDashboard` (pure, tested) renders KO rows per §7 — placed slots adopt their pool match's schedule, unplaced pool entries stay as generic TBD rows, byes never appear — and KO rows link into the bracket view (`MatchRow` gained `categoryId`/`isKnockout`). **Manager side**: "vs TBD" and per-side cutoff chips landed with ticket 12's null-safety — verified unchanged. Review applied: on-screen vocabulary (no "seed"/"tie" on screen), an inverted awaiting-teams branch, accurate balance copy, flattened category selection. Suite 235 tests green, vue-tsc clean. Deferred as cosmetic (review judgement calls): the A/B side-cell template duplication and the O(n²) enterability pass (tiny n).
