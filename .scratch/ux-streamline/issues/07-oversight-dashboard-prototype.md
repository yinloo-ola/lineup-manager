# Prototype the oversight dashboard and grouped lineups view

Type: prototype
Status: resolved
Blocked by: 05, 06

HITL — raise fidelity with a cheap artifact the user reacts to; use the `/prototype` skill.

## Question

What do the oversight dashboard and the grouped all-lineups view concretely look like? Prototype them together — the walkthrough ([Admin console walkthrough](03-admin-console-walkthrough.md)) treats them as one oversight continuum: a lean dashboard and a drill-in detail view. Constraints already decided:

- **Lean content model**: a submitted/not-submitted indicator per lineup — no urgency ladder, no activity feed, no progress bars. Organized by team match, sorted ascending by scheduled time, then table number.
- **Filters**: Submitted / Not submitted lineups, and team matches past their cutoff — worded per the settled vocabulary; "completed" is reserved for the future results feature and never appears here.
- **Grouped detail by team match**: both teams' lineups per team match, with edit-on-behalf (the builder with `?team=`) reachable from there.
- **Metadata**: show `table_label` (exists today); show group and round **where available** — the data model lacks them, so state the metadata requirement (seed-sourced group/round) as part of the design rather than designing around their absence.
- **Chasing is visibility-only** — the indicator is the whole story; no nudge controls.
- Status chips/labels use the vocabulary settled by [Settle the user-facing status vocabulary](05-user-facing-status-vocabulary.md), inside the shell framed by [Prototype the admin shell and phase-based navigation](06-admin-shell-navigation-prototype.md).
- On-screen naming per the shell decision: the nav area is **Matches** (the word "oversight" stays internal to the spec, not on screen).
- Consult the [ux-designer skill](https://github.com/szilu/ux-designer-skill) data-table references for the table/list design lens.

## Comments

- **2026-08-15, prototype live:** three structurally different Matches dashboards at `/prototype/matches`, switchable via `?variant=A|B|C`, ←/→ keys, or the floating bar — all framed in the settled variant-A shell (rail, searchable selector): **A — Fixture table** (dense, one row per team match, sorted scheduled-time → table, status chips inline, Locked chip on cutoff rows); **B — Status board** (chasing-first: Not submitted / Submitted columns, cutoff matches Locked-styled, counts in headers); **C — Timeslots** (sections per scheduled time, summary cards with "n/2 submitted"). All share the filters All / Not submitted / Submitted / Past cutoff (settled vocabulary, no "completed") and a drill-in dialog per team match showing both lineups with status chips, Needs-attention, and Edit-on-behalf (stub). Visibility-only — no nudge controls anywhere. Awaiting the user's verdict or mix.
- **2026-08-15, the user, urgency correction:** "If it passes cutoff and not submitted yet, we must visually be able to identify it! The referee should immediately take action to chase for the lineup or decide to help the team fill a random lineup." — my first cut muted cutoff-passed-missing as calm/"Locked"; inverted. New state **Missed cutoff** (error, alert icon) for a lineup missing past cutoff; **Locked** stays the calm match-level marker (cutoff passed, all lineups in). Implemented: error-tinted rows (A), pinned + full-opacity error border (B), error-bordered summary cards (C); drill-in shows an error alert ("chase the manager or fill the lineup on behalf now") and relabels the action **"Fill lineup on behalf"** (error-toned) for that team. `CONTEXT.md` Lineup Status entry extended with Missed cutoff. Glossary note: the actor here is the Administrator (the user said "referee" — no referee role exists in this domain).

## Answer

**The Matches dashboard is variant A — the dense fixture table.** Verbatim from the user: "I choose A." Final shape (visible at `/prototype/matches?variant=A` at the time of resolution):

- **One row per team match**, sorted ascending by scheduled time then table number. Columns: Scheduled (+ calm **Locked** outlined chip on cutoff-passed matches), Table, Group · Round, then each team with its lineup status chip inline — Submitted (success), Not submitted (error), **Missed cutoff** (error, alert icon — a lineup missing past the cutoff; the urgent, actionable case).
- **Missed-cutoff rows carry a red-tinted background** so the admin can immediately pick out the matches needing action (chase the manager or fill on behalf) — the urgency correction from the user mid-review.
- **Filters** above the table: All / Not submitted / Submitted / Past cutoff (settled vocabulary; "completed" never appears).
- **Drill-in** (row click → dialog): both teams' lineups side by side with status chips, Needs-attention marker, metadata line (group · round · table · scheduled); for a missed-cutoff team an error alert states the two actions and the button becomes **"Fill lineup on behalf"**; otherwise "Edit on behalf" — both open the lineup builder as that team (`?team=`).
- **Visibility-only chasing** stands — no in-app nudge controls; the dashboard's job is to make the state unmissable.
- Losing variants (recorded, captured on the branch): B status board (chasing-first columns — urgency now handled by Missed-cutoff row tinting instead) and C timeslots.

Prototype captured on `feat/ux-streamline` (dev-only route `/prototype/matches`, throwaway — not for merge). Glossary: `CONTEXT.md` Lineup Status entry extended with **Missed cutoff** during this ticket.
