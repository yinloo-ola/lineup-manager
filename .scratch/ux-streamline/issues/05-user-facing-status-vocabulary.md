# Settle the user-facing status vocabulary

Type: grilling
Status: resolved
Blocked by: 01

## Question

The app shows users up to eight overlapping state terms: `not-started`, `draft`, `submitted`, `invalidated` as raw enum strings (`src/views/ManagerView.vue:13-21`, `src/views/AdminLineupsView.vue:15-20`), plus `locked` / `open` (cutoff-dependent, `src/views/ManagerView.vue:106-108`), plus `complete` / `incomplete` and an `action needed` chip (`src/views/LineupBuilderView.vue:324-333`, `src/views/AdminLineupsView.vue:85-88`). Design the single coherent user-facing state model:

- Which states exist, what each is called on screen, and which merge or disappear.
- Which are properties rather than states — e.g. is "locked" a state, or just a consequence of the deadline the UI already shows?
- How the model reads across the **admin surfaces** — the all-lineups table, the admin dashboard-to-be, and the admin's copy of the builder. The manager views are out of scope for this map (per [Confirm the destination and scope](01-confirm-destination-and-scope.md)); the decision shouldn't *preclude* a later manager-side pass, but it serves the administrator first.

The `/domain-modeling` skill applies: resolved terms likely belong in `CONTEXT.md`, and the on-screen-language answer from [Confirm the destination and scope](01-confirm-destination-and-scope.md) sets their wording register.

## Answer

Resolved 2026-08-15 via two grilling rounds. The vocabulary — and two domain rules that reshaped it.

### The vocabulary (admin surfaces)

- **Submitted / Not submitted** — binary everywhere outside the lineup builder: the dashboard indicator, the grouped detail's state chips, the filters. Drafting nuance (`not-started`, `draft`) is builder-internal.
- **Needs attention** — the one exceptional marker. A pre-start format edit confirmed against its impact can break a submitted lineup; such lineups read **Not submitted** with this marker until corrected and re-submitted. Replaces today's raw `invalidated` enum plus the redundant `action needed` chip.
- **Locked** — stays an explicit chip on past-cutoff team matches (the user's explicit choice over property-only), alongside the cutoff time already shown.
- **Completed / complete / incomplete** — reserved for the future results feature (the admin fills match results and marks a team match completed); never used for lineup states. Filters are worded **Submitted / Not submitted / Past cutoff**.

### The two domain rules surfaced

1. **Format freeze** — team-match formats cannot be amended once the tournament has started. Anchor: `tournaments.start_date` (exists, nullable — becomes required for a running tournament).
2. **Guarded pre-start edit** — before the freeze, a format save that would break submitted lineups shows an impact preview (affected team matches and lineups) and requires explicit confirmation. No silent invalidation.

Both are spec requirements; enacting them (enforcement, authoring-UI frozen state) is implementation work outside this map. The frozen-editor state is recorded as a constraint in [Prototype the admin shell and phase-based navigation](06-admin-shell-navigation-prototype.md).

### Glossary

`CONTEXT.md` updated: new **Lineup Status** entry; **Team Match Format** gains the freeze rule.

### Consequences

- Match results and team-match completion are a future feature, recorded in the map's Out of scope.
- [Prototype the oversight dashboard and grouped lineups view](07-oversight-dashboard-prototype.md) uses the settled chips: Submitted / Not submitted (rare **Needs attention** marker), Locked; filters worded Submitted / Not submitted / Past cutoff.
