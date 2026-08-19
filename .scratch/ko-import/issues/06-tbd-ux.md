# 06 · Manager and admin UX for TBD team matches

Type: grilling
Status: resolved
Blocked by: 04

## Question

Every read path today assumes two named teams: Matches dashboard side columns (`src/domain/matchesDashboard.ts:17-39`), "vs {opponent}" in the builder and manager home (`src/views/LineupBuilderView.vue:247`, `src/views/ManagerView.vue:98`, `src/domain/managerView.ts:41-58`), and the drill-in dialog. What do users see for a KO tie with zero or one known team?

Decisions:

- **Can a manager submit a lineup when their team is known but the opponent is TBD?** (Lineup writes are already opponent-agnostic — `upsertLineup` never touches the opponent; only load-time membership and display assume it. Both-unknown ties have no manager to ask.)
- The admin bracket-module interaction (per [05](05-fill-in-mechanism.md)): first-round team pickers, winner selection on completed KO matches, feed hints ("Winner of QF2"), and the **cascade-clear confirmation** (enumerating what will be wiped) in the dashboard/drill-in — plus what a lone-team (no-contest) match shows, for the admin and for that team's manager.
- No-time bye ties (from [03](03-seed-contract-v2.md)): how they render on the Matches dashboard (bracket position, auto-advanced team, no cutoff/locked chips) and in the manager's list.
- Language for a TBD side ("TBD", "To be confirmed", …): does it earn a CONTEXT.md term shared with tournament-manager's display?
- Dashboard: TBD rendering; whether unresolved KO ties appear in filters (e.g. past-cutoff); their sort/place in the table; locked/cutoff chips for them.
- e2e coverage shape: fixtures with TBD ties; RLS specs for one-side-known visibility.

## Answer

Resolved 2026-08-18, grilling with the user.

- **Unknown sides display bare "TBD"** — uniform everywhere (dashboard side columns, "vs TBD" in the builder and manager home). No "Winner QF2" feed hints (user pick over the recommended hybrid) — the feed references keep driving propagation, they are just never surfaced as display text.
- **The bracket module lives in a round-grouped bracket view** (one per category): rounds R256…F as groups; first-round entry pickers, winner selection on completed matches, the cascade-clear confirmation, and bye auto-advance state all happen there. It is a new admin surface in the shell alongside Matches. The Matches dashboard still lists every scheduled KO tie with TBD labels and links into the bracket view.
- **Managers see a KO tie the moment their team lands on it** — exactly what RLS already gives (04): opponent TBD renders "vs TBD"; submission is ungated (05); cutoff/locked chips follow the uniform per-side rule.
- **Byes live in the bracket view only**: the dashboard shows every *scheduled* KO tie (both-TBD included — they have times to sort by); bye ties carry no time and stay off the dashboard entirely, preserving its time-sort invariant.

e2e shape (for 08): fixtures with TBD and bye ties; one-side-known visibility (manager sees a tie only after placement); bracket-view flows (entry, instant bye advance, winner pick, cascade confirmation); dashboard TBD rendering and "vs TBD" strings; RLS specs for null-side visibility.

## Comments

- 2026-08-19 (user, via the prototype ticket) — **first-round placement model** adds bracket-view surfaces: an imported-matches pool banner (placed/unplaced chips), an assign-imported-match affordance on two-team slots, bye-pending state on lone-team slots, and the advance-byes action once the round balances. See the prototype and [05](05-fill-in-mechanism.md)'s amendment.
- 2026-08-19 — prototype verdict ([07](07-tbd-ui-prototype.md)): the bracket view's concrete form is the **grouped-table layout** (variant C) — round headers, per-slot rows, side cells with entry + ✕ removal, winner/assignment cell with toggle un-pick, pool banner, advance-on-balance.
