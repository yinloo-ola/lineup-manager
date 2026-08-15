# Prototype the oversight dashboard and grouped lineups view

Type: prototype
Status: open
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
