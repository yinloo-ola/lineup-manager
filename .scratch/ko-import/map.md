# Wayfinder map · KO import before participants are known

`wayfinder:map`

## Destination

A decided spec — `.scratch/ko-import/spec.md` — that lets a tournament's knockout (KO) team matches be imported into lineup-manager **before their teams are known** (table number + time slot first), with participants filled in round by round as the group stage and prior KO rounds complete. It covers both repos: the organizer's tournament-manager (producer — exports the bracket skeleton only, no resolution there), the seed contract v2 (the only coupling between the two), and lineup-manager (schema, domain, admin/manager UX, and the bracket module — the admin enters the first knockout round's Teams, then selects winners, so each later round fills by propagation; a lone team advances directly). Done = nothing left to decide before slicing build tickets; the map itself implements nothing.

## Notes

- **Charting assumptions — all confirmed 2026-08-18** in [Producer-side participant resolution workflow](issues/02-producer-resolution-workflow.md): participants are **Teams** ("players not known" = teams TBD; players are still named in lineups as today — term **Bracket Slot** now in `CONTEXT.md`); the fill-in mechanism is **in scope**, realized as lineup-manager's participant-input module; destination is a **spec** (planning only, no execution during the map).
- Domain language: lineup-manager `CONTEXT.md` governs (Team Match, Match, Team, Lineup…); tournament-manager defers to it. Sharpen fuzzy terms in tickets; if a term crystallises (e.g. what to call a TBD side), add it to `CONTEXT.md` at resolution time.
- Skills: HITL tickets always run `/grilling` + `/domain-modeling`. Cross-reference code before accepting claims.
- ADR bar: nullable tie sides and the first update-in-place import path both look ADR-worthy (hard to reverse, surprising, real trade-offs — and lineup-manager ADR 0001 currently says import always creates a new tournament). lineup-manager decisions → its `docs/adr/`; tournament-manager decisions → its `docs/adr/`.
- Key artifacts: contract doc `docs/seed-contract.md` + `seed-contract.schema.json` and parser `src/domain/seed.ts` (lineup-manager); producer `web/src/features/lineup-seed/domain/buildLineupSeed.ts` (tournament-manager); schema `supabase/migrations/0001_init.sql` (`ties.team_a/team_b NOT NULL`), RLS `0004_lineups_manager_read.sql`, scoping `0011_contract_tournament_dimension.sql`.
- tournament-manager has no `.scratch/`; this map (in lineup-manager) is the single source for the whole effort, including tickets whose work lands in the other repo.

## Decisions so far

- [KO resolution does not exist in tournament-manager](issues/01-ko-resolution-absent.md) — research: brackets stay empty-slot forever (no standings, no assignment UI, no result import); the seed has no bracket-slot identity and drops unresolved ties outright; the one accidental assignment backdoor (protected workbook EntryID columns) is unvalidated and wiped by re-generating rounds.
- [Producer-side participant resolution workflow](issues/02-producer-resolution-workflow.md) — none: resolution lives in lineup-manager (admin enters the first KO round's Teams; later rounds fill by winner-selection propagation — refined in the ticket's comments; tournament-manager ADR 0004 records the split). The seed is one-shot, exported after the final schedule; no slot-source convention exists producer-side, so "Winner QF2" hints must come from feed structure (03's call, now required for propagation).
- [Seed contract v2: TBD sides + bracket-slot identity](issues/03-seed-contract-v2.md) — KO ties drop `teamIds` for per-side `fedBy`; ids `categoryId|ko|LABEL|n` (R256…F); **full bracket, no shrinkage** (R256 = 128 matches), byes placed structurally at generation and imported as **no-time ties** where the lone team auto-advances; every later-round side is fed; v2 only (the parser drops v1). *Amended 2026-08-19: the first round exports as an unplaced scheduled-match pool (no position; byes never exported); bracket structure (slots + feeds) conveyed separately — see comments.*
- [lineup-manager data model for TBD sides](issues/04-tbd-sides-data-model.md) — widen `ties`: nullable teams, `fed_by_a/b` self-FKs, `winner_side`, `is_knockout`, `scheduled_start` nullable for byes; uniform per-side cutoff (byes never lock, TBD sides can't miss); manager RLS unchanged. ADR 0002. Forks taken on recommendation (round unanswered) — flippable by comment. *Amended 2026-08-19: first-round scheduled matches vs positional slots are distinct entities bound at admin placement; no bye ties at all — see comments.*
- [Fill-in mechanism: the bracket module](issues/05-fill-in-mechanism.md) — byes advance instantly on entry (one team only); corrections **cascade-clear** the downstream bracket behind a confirmation enumerating the blast radius (lineups stand if their team stays, else are removed with the side); tight guardrails — same-category pickers, one KO slot per team, admin-only winner selection once both sides set. *Amended 2026-08-19: instant bye advance superseded — byes emerge from admin placement and advance on round balance; new action: place an imported match onto a two-team slot — see comments.*
- [Manager and admin UX for TBD team matches](issues/06-tbd-ux.md) — bare **"TBD"** labels everywhere (no feed hints — user pick); the bracket module lives in a new round-grouped per-category **bracket view** (entry, winner selection, cascade confirmation, byes); managers see a KO tie the moment their team lands on it (submission ungated); byes stay off the time-sorted Matches dashboard. *Amended 2026-08-19: imported-match pool banner, placement affordance, bye-pending state, advance-byes action — see comments. The view's concrete form is the **grouped-table layout** (prototype verdict, [07](issues/07-tbd-ui-prototype.md)).*
- [Prototype: bracket view, dashboard rows, and lineup builder](issues/07-tbd-ui-prototype.md) — **variant C (grouped table) wins**. The reaction iterated the design into: winner-toggle un-pick (no pencils), ✕ un-enter with placement release, assign-in-winner-cell, imported-pool banner, advance-byes on round balance (judgment calls carried unchallenged into the spec). Full history in the ticket's comments; asset = the untracked prototype HTML.
- [Assemble the KO-import spec](issues/08-spec-assembly.md) — **destination reached**: [`spec.md`](spec.md) written in house style (11 sections, full traceability), build tickets [09](issues/09-generator-full-rounds.md)–[15](issues/15-e2e.md) sliced across both repos, ADR 0002 amended. Execution of 09–15 is outside the map.

## Not yet specified

- Nothing — the destination is reached: the spec is written and the build tickets ([09](issues/09-generator-full-rounds.md)–[15](issues/15-e2e.md)) are sliced. Remaining work is execution, outside this map.
- Possible follow-ons if decisions reshape the Matches dashboard beyond TBD rendering (filters, sort, drill-in) or the lineup builder flow.

## Out of scope

- **Match scores and standings** — full results entry and any standings computation stay future (winner selection IS in scope as the progression mechanism); tournament-manager stays results-free by decision (its ADR 0004).
- **Individual-event KO draws** (singles/doubles) entering lineup-manager — individual events don't exist there; charting assumption is team-event brackets only.
- **Notifications** (e.g. telling a manager their KO opponent is now known) — beyond import/fill-in/display; revisit only if the destination is redrawn.
