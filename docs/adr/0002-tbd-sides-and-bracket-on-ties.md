---
status: accepted
---
# TBD sides & bracket awareness on ties

Knockout team matches are imported before their teams are known (seed contract v2):
`ties.team_a`/`team_b` become nullable, and ties gain bracket columns — `fed_by_a`/
`fed_by_b` (self-FK to the tie whose winner fills that side), `winner_side` (`'a'`/`'b'`),
and `is_knockout`. `scheduled_start` becomes nullable too: bye ties carry no time or
table. First-round sides are filled manually by the admin; later-round sides are fed
by the previous round's winner — winner selection and bye auto-advance both write
`winner_side`.

## Considered options

- **Widen `ties` (chosen)** vs. a `tie_sides` child table. The domain speaks in
  positional pairs everywhere (`Tie.teamIds`, `MatchRow.sides`, lineup-builder
  membership); a child table would reassemble that pair in every read, add a join to
  manager RLS, and churn the lineup upsert paths, for normalisation nothing needs.
- **`winner_side` (chosen)** vs. `winner_team_id`. The side cannot diverge from the
  sides when a correction changes them; a future scores module hangs games off the
  tie anyway. A denormalised team id could be silently orphaned by a side correction.
- **Feed columns stored verbatim (chosen)** vs. derived from bracket ordering. The
  seed carries explicit `fedBy`; deriving positionally would reintroduce the slot
  convention tournament-manager never had (ko-import ticket 01).

## Consequences

- Manager-read RLS is unchanged in text: null sides never match `manager_team_id()`,
  so unresolved KO ties are invisible to managers until their team lands on a side.
- `tie_locked` never locks a bye tie (null `scheduled_start` makes the cutoff
  comparison null). A team can only miss a cutoff once it sits on the tie.
- Bye ties expect no lineup; the cutoff/locked and missed-cutoff machinery skips
  them via the null time.
- The seed stays one-shot (ADR 0001 stands): no update path arrives with these
  columns.

Amendment (2026-08-19, ko-import map ticket 04): with the first-round
placement model, there are **no bye ties** — a bye is a slot that ends up with
one team, decided by admin placement, never a no-time tie from the seed.
First-round rows split into positional **slots** (no schedule until placed) and
an imported **pool** of scheduled matches bound at placement via
`placed_match_id`; the nullability decisions above stand unchanged.
