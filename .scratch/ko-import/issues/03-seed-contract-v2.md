# 03 · Seed contract v2: TBD sides + bracket-slot identity

Type: grilling
Status: resolved

## Question

Seed v1 (`docs/seed-contract.md`; `SeedTie.teamIds: [string, string]`; parser `src/domain/seed.ts:251-263` requires exactly two known teams) cannot represent a KO team match before its teams are known, and tie ids key on teams+time with no bracket position (see [01](01-ko-resolution-absent.md)). What is the v2 shape?

Decisions:

- TBD representation: nullable team ids (`[string, string | null]`), omitted sides, or placeholder ids — covering both one-side-known and both-unknown.
- **Bracket-slot identity**: encode category + round + match position in the tie id (stable across resolution and time moves) vs keep teams+time (unstable). This identity is what later fills target, so it must survive re-exports.
- **Feed structure is required** (user, 2026-08-18): v2 must express which match's winner fills which next-round slot — propagation in lineup-manager depends on it, and display hints ("Winner of QF2") derive from feeds, since the organizer tool carries no slot-source convention. Round labels follow the organizer's naming: R256/R128/R64/R32/R16/QF/SF/F.
- Confirmed scope (user): export **every** KO round's matches, team-less included, each with its scheduled table + time; group ties unchanged (complete at import).
- Version policy: bump to 2 with clean rejection by old consumers; can lineup-manager keep importing v1 files unchanged (both directions of compatibility)?
- Still omit unscheduled matches? ("Import all KO matches with their table number and time slot" implies scheduled-only remains the rule.)

## Answer

Resolved 2026-08-18, grilling with the user (three rounds). The v2 contract:

- **KO ties omit `teamIds`** and carry `fedBy: [tieId | null, tieId | null]` — each side either names the tie whose winner fills it, or `null` = a manual-entry slot. Group ties are byte-identical to v1 (`teamIds[2]`, `group` + `round` labels). Validation: `teamIds` XOR `fedBy` (never both, never neither); KO ties carry `round`, never `group`.
- **Bracket-slot identity, label form**: `${categoryId}|ko|${roundLabel}|${matchNumber}` — e.g. `MS|ko|QF|1`. Labels from the fixed set R256/R128/R64/R32/R16/QF/SF/F (the producer's existing convention, extended with R256 = 128 matches). Group tie ids stay teams+time (v1 form).
- **Full bracket, no shrinkage**: every round is complete — R256 = 128 matches, R128 = 64, … QF = 4, SF = 2, F = 1; bracket size = next power of two ≥ qualifiers. Byes are placed **structurally at generation, evenly distributed in the first round** (what `FUNCTIONALITY.md` already describes — today's shrinking code deviates, so this is a producer-side generator change). The scheduler skips bye matches. With full rounds, matches-in-round labeling is collision-free again.
- **Bye matches import as no-time ties**: no `scheduledStart`, no `table`, but they export and import — lineup-manager holds them as bracket positions where the one-team rule fires (enter the lone team → it auto-advances). Semantics: a KO tie without `scheduledStart` = bye; real-but-unscheduled matches stay omitted (v1 rule, the producer knows structurally which are byes). All first-round sides are manual (`fedBy: [null, null]`); **every later-round side is fed**.
- **Feed structure is explicit per side** (`fedBy`), computed by the producer from the standard positional bracket mapping; the consumer never derives it. Invariant: every `fedBy` resolves within the seed to a KO tie of the same category in a strictly earlier round.
- **Version policy: v2 only** — `seedVersion: 2`; the new parser drops v1 (clean rejection with a re-export hint; the organizer can always re-export). No dual-version parsing.

Worked example (6 qualifiers → full 8-draw): QF = 4 matches with `fedBy: [null, null]` (two of them byes, no time/table); SF = 2 matches fed `["MS|ko|QF|1","MS|ko|QF|2"]` and `["MS|ko|QF|3","MS|ko|QF|4"]`; F fed by both SF ties.

Spec notes for [08](08-spec-assembly.md): move the four lockstep artifacts together (`docs/seed-contract.md`, `seed-contract.schema.json`, `src/domain/seed.ts`, `buildLineupSeed.ts`); new parse invariants (XOR shape, `fedBy` resolution + strictly-earlier round, bye ties lack time/table, KO round labels from the fixed set); producer changes (full-round generation with structural byes, scheduler skips byes, +R256 label, drop the both-teams skip for KO matches, emit `fedBy`).

## Comments

- 2026-08-18 (user, after resolution) — confirmation of the time/table source: for matches that (will) have two teams, the **final schedule** already defines their time slot and table number — including later KO rounds whose teams are still TBD at scheduling time. Bye matches carry neither. The seed mirrors the final schedule exactly (export happens after its import, per the one-shot discipline in 02).
- 2026-08-19 (user, via the prototype ticket) — **first-round amendment**: first-round KO ties export as an **unplaced pool** — table + time + round label, **no bracket position** (the admin decides placement later; the count is already bye-adjusted, e.g. 6 qualifiers → 2 QF matches, "only 2 matches in this QF"). The seed must separately convey the bracket **structure** (slot count per round — first-round slots exist even where no scheduled match will land — plus feeds), which lineup-manager cannot derive. Supersedes parts of the answer above: the "full bracket" decision now applies to the conveyed *structure* (R256 = 128 slots) while the exported scheduled matches are the bye-adjusted real set; **"bye ties as no-time ties" is dropped entirely** — byes never appear in the export; they emerge in lineup-manager when a slot ends up with one team (see 05's amendment). Later rounds (SF/F) are unchanged: positional, scheduled, both sides fed.
