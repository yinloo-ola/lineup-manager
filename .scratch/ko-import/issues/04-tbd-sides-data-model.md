# 04 · lineup-manager data model for TBD sides

Type: grilling
Status: resolved
Blocked by: 03

## Question

`ties.team_a/team_b` are NOT NULL (`supabase/migrations/0001_init.sql:30-31`), manager RLS visibility keys on occupying a side (`0004_lineups_manager_read.sql:27-30`), and the domain carries `Tie.teamIds: [string, string]` throughout. How does the model admit a KO team match with zero or one known team?

Decisions:

- Column shape: make `team_a/team_b` nullable vs a sides restructure (bigger). Migration path for existing data; re-run advisors and RLS review after schema change.
- RLS: an unresolved KO tie is invisible to every manager (no side to own) — intended? When one side resolves, does that team's manager see the tie immediately?
- Cutoff/locked semantics for unresolved ties (`tie_locked`, missed-cutoff flag) — does an unresolved tie have a meaningful lineup deadline at all?
- Domain types: `teamIds` tuple → nullable sides; what `MatchRow.sides` and the builder membership check (`src/services/lineupService.ts:114-118`) become.
- Bracket awareness (user, 2026-08-18): where feed structure lives in the DB (stored explicitly vs derived from imported order); the winner of a KO team match (stored so full scores can extend it later); distinguishing a side that is null-awaiting-feed from one that is null-forever (structural bye → auto-advance); what a lone-team tie means for the lineup/cutoff machinery.
- No-time bye ties (from [03](03-seed-contract-v2.md)): bye ties carry no `scheduledStart`/`table` — `scheduled_start` likely needs to become nullable, and the cutoff/locked + missed-cutoff logic must skip ties without a time.
- ADR-worthiness: nullable sides look hard-to-reverse and surprising — likely ADR material per the map's Notes.

## Answer

Resolved 2026-08-18. The grilling round went unanswered, so all three forks were taken on recommendation — flip any with a comment.

- **Widen `ties`** (over a `tie_sides` child table): `team_a`/`team_b` become nullable; add `fed_by_a`/`fed_by_b` (nullable self-FK to the feeder tie — imported verbatim from the seed's `fedBy`, stored explicitly, never derived), `winner_side` (check `'a'`/`'b'`, nullable), and an explicit `is_knockout` boolean (no inferring from label absence); `scheduled_start` becomes nullable (bye ties carry no time; `table_label` already is). One row per team match stays the whole truth — the domain's positional pair maps 1:1, every query and policy keeps its shape, the migration is additive. Chosen because the whole domain already speaks in positional pairs (`Tie.teamIds`, `MatchRow.sides`, builder membership).
- **Winner = `winner_side`**, not `winner_team_id`: normalized — it cannot diverge from the sides when a correction changes them (05's cascade), and a future scores module hangs games off the tie. Byes record their auto-advance the same way.
- **Cutoff: uniform, per-side.** `tie_locked` stays `scheduled_start − lead_time` — with a null time the comparison is null, so a bye tie never locks (falls out of the existing function; verified `0007_lineup_cutoff_server_side.sql:21`). A team can only *miss* a cutoff once it sits on the tie — a TBD side has nothing to miss — so late bracket entry never creates phantom Missed-cutoff flags. Bye ties expect no lineup at all.

Verified facts (no decision needed):

- Manager-read RLS needs no text change: `team_a = manager_team_id() or team_b = …` (`0004:27-30`) with nulls means unresolved KO ties are invisible to every manager, and a tie becomes visible the moment the manager's team lands on a side — exactly the 02/03 flow.
- `0012`'s start-date derivation (`min(scheduled_start)`) ignores nulls — byes cannot corrupt it.

Spec notes for [08](08-spec-assembly.md): one additive migration (imperative style, comment header per ticket; re-run advisors) — relax the two NOT NULLs, add the four columns + check constraint; nothing to backfill (existing tournaments have no KO ties). While touching lineup write policies (`0011:100-110`), verify a lineup target actually occupies a side of the tie — membership is enforced app-layer only today, worth tightening here. Domain types: `Tie.sides: [string|null, string|null]` + `fedBy`/`winnerSide`/`isKnockout`, `MatchRow.sides` nullable, builder membership handles a null opponent.

ADR written: `docs/adr/0002-tbd-sides-and-bracket-on-ties.md`.

## Comments

- 2026-08-19 (user, via the prototype ticket) — **first-round amendment** (see [03](03-seed-contract-v2.md)'s comment): first-round scheduled matches (time + table, no position, no teams) and positional bracket slots (structure + feeds, no schedule) are now **distinct entities the admin binds at placement**. The widen-`ties` answer stands for its columns, but the schema must express: unplaced first-round match rows, slot rows, the binding (`placed_on`?), and per-category bracket metadata (slot count per round). The ADR 0002 consequence "bye ties carry no time" is superseded — **there are no bye ties at all**; a bye is a slot that ends up with one team.
