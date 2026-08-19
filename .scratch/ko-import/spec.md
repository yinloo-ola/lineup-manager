# KO Import & Bracket Module Spec — lineup-manager + tournament-manager

Status: decision-complete (wayfinder map `ko-import`, closed 2026-08-19)
Scope: **knockout-stage team matches, both repos** — export from the organizer tool, import into lineup-manager before participants are known, and the bracket module that fills them round by round. Group-stage behavior is unchanged and explicitly out of scope. Match scores/results are future work; this spec carries winner selection only.
Traceability: every section cites its deciding ticket in `.scratch/ko-import/issues/` (wayfinder tickets 01–08; build tickets 09–15 are sliced from §11). Visual reference: `prototype/ko-import-bracket.html` (untracked throwaway, vendored deps — variant C is the validated layout).

## 1. Principles

Decisions: [Producer-side participant resolution workflow](issues/02-producer-resolution-workflow.md), tournament-manager ADR 0004

- **No resolution in the organizer tool.** tournament-manager stays structure + scheduling + print: no assignment UI, no standings, no results. Its only new duty is exporting the knockout skeleton faithfully.
- **Resolution lives in lineup-manager's bracket module** — the declared future home of results management, of which winner selection is the first step.
- **The seed is one-shot**: exported after the final schedule import (times/tables final); corrections before any lineups exist = delete tournament + re-import; time/table moves after import are out of scope. No update path — ADR 0001 stands.
- Byes and walkovers are plain input: a bye is a slot that ends up with one team; a walkover is selecting the present winner.

## 2. Model of the knockout stage

Decisions: [Seed contract v2](issues/03-seed-contract-v2.md) (+ comments), [Prototype](issues/07-tbd-ui-prototype.md) (+ comments), [Fill-in mechanism](issues/05-fill-in-mechanism.md) (+ comments)

A knockout category imports as three kinds of thing:

1. **Bracket structure** — full-power-of-two rounds of slots (R256 = 128 slots … QF = 4, SF = 2, F = 1), each slot with a stable positional identity and feed wiring (which earlier match's winner fills which side).
2. **First-round imported pool** — the *scheduled* first-round matches (table + time), **bye-adjusted in count** (6 qualifiers → 2 pool matches: 2×2 + 2×1 = 6). They carry **no bracket position** — the admin decides placement.
3. **Later-round ties** — positional (SF1, SF2, F…), already scheduled by the final schedule, both sides fed.

The admin enters teams onto first-round slots and **places each pool match onto a two-team slot**; a slot that ends with one team is a **bye** and forwards its team when the round balances; later rounds fill by **winner propagation** (select the winner; byes/selected winners flow through feeds). On-screen, unknown sides are bare **"TBD"** — no feed hints.

## 3. Seed contract v2

Decision: [Seed contract v2](issues/03-seed-contract-v2.md) (+ its comments — the first-round pool amendment supersedes parts of the original answer)

Four lockstep artifacts move together: `docs/seed-contract.md`, `seed-contract.schema.json`, `src/domain/seed.ts` (consumer), `buildLineupSeed.ts` (producer). **Version policy: v2 only** — the parser drops v1 with the existing re-export message.

| Field | Shape | Required | Notes |
|---|---|---|---|
| `seedVersion` | integer, `2` | yes | Parser rejects everything else. |
| `tournamentName`, `startDate`, `categories[]`, `teams[]`, `players[]` | as v1 | yes (startDate optional) | Byte-identical to v1. |
| `ties[]` — group | `{id, categoryId, scheduledStart, table?, group, round, teamIds[2]}` | yes | Exactly v1: teams+time id, human labels. |
| `ties[]` — KO pool (entry round) | `{id, categoryId, round, scheduledStart, table}` | yes (when the KO stage exists) | **No position, no teamIds, no fedBy.** `round` is the entry-round label. Id (assembly choice, deterministic): `categoryId\|ko\|LABEL\|table\|scheduledStart`. |
| `ties[]` — KO later rounds | `{id, categoryId, scheduledStart, table, round, fedBy[2]}` | yes | Positional id `categoryId\|ko\|LABEL\|n`; **both sides fed** (`fedBy` names feeder tie ids). |
| `brackets[]` | `{categoryId, rounds: [{label, slots, fedBy?}]}` | yes (when KO exists) | One per KO category: slot count per round + feed wiring per side. Assembly-level encoding; slot identity = the positional id scheme. |

Invariants (parse-time): every tie carries `teamIds` **xor** `fedBy` (pool ties carry neither); KO ties carry `round`, never `group`; round labels from the fixed set **R256/R128/R64/R32/R16/QF/SF/F** keyed by **slot size** (fixes the old matches-in-round labeling collision; the producer's label table gains R256); every `fedBy` resolves within the seed to a KO tie of the same category in a strictly earlier round; `brackets[].rounds` wiring matches the later-round ties' `fedBy`; real-but-unscheduled matches stay omitted (v1 rule); group ties unchanged.

## 4. Producer changes (tournament-manager)

Decisions: [KO resolution does not exist](issues/01-ko-resolution-absent.md), [02](issues/02-producer-resolution-workflow.md), [03](issues/03-seed-contract-v2.md)

- **Generator:** knockout rounds are emitted **full** (power-of-two slots per round) with **structural byes placed at generation, evenly distributed across the first KO round** — what `docs/FUNCTIONALITY.md` already claims; today's shrinking code is the deviation being fixed. The **scheduler skips bye matches** (they get no table/time). Real matches across all rounds keep the final schedule's table + time.
- **Export (v2):** first round emits the **pool** (scheduled matches only, bye-adjusted count); `brackets[]` carries structure + feeds; later rounds emit positional scheduled ties with `fedBy`; version bumps to 2; the both-teams skip is dropped for KO ties. No assignment UI, no results (ADR 0004).
- The regeneration hazard (draw-modal close / draft re-export resets rounds) stays moot: nothing is ever assigned in this repo.

## 5. Data model (lineup-manager)

Decision: [lineup-manager data model for TBD sides](issues/04-tbd-sides-data-model.md) (+ comments), ADR 0002 (amended addendum)

One additive migration (imperative style, comment header, advisors re-run; nothing to backfill):

- `ties.team_a` / `ties.team_b` → **nullable**; `ties.scheduled_start` → **nullable** (slot rows carry no schedule until placed; `table_label` already nullable).
- New: `fed_by_a` / `fed_by_b` (nullable self-FK `ties(id)` — slot/later-round rows), `winner_side` (check `'a'`/`'b'`, nullable), `is_knockout` (boolean), `placed_match_id` (nullable self-FK to the bound pool tie; unique when set).
- Three KO row kinds: **slot** (positional id, no time until placed, feeds), **pool** (seed id, time + table, no position), **later-round** (positional id + time + feeds). Group rows untouched.
- **RLS:** manager-read policy text unchanged — null sides never match `manager_team_id()`, so unresolved slots/pool ties are invisible to managers until their team lands on one. While touching lineup-write policies (0011), **tighten so a lineup's team actually occupies a side of the tie** (membership is app-layer only today).
- **Cutoff:** `tie_locked` formula unchanged; per-side missed-cutoff semantics (only a team on the tie can miss it); rows without a scheduled time never lock and expect no lineup.

## 6. Bracket module (lineup-manager)

Decision: [Fill-in mechanism](issues/05-fill-in-mechanism.md) (+ comments — the placement amendments), reactions recorded in [07](issues/07-tbd-ui-prototype.md)

- **Entry:** first-round slot pickers offer same-category teams only; a team holds at most one KO slot per category; **✕ removes an entry** — instantly when the slot has no winner; a decided slot un-picks its winner first (cascade path); clearing a side of a placed slot **releases the placement** (pool match returns to the pool; slot may degrade to bye-pending).
- **Placement:** assign an unplaced pool match to a two-team slot (`placed_match_id`), binding its table + time.
- **Balance & byes:** balanced = every pool match placed ∧ two-team slots = pool count ∧ every slot ≥ one team. Then **advance-byes** forwards each lone team into its fed next-round side. (Judgment call carried unchallenged: byes advance on balance, not on entry.)
- **Winner selection:** admin-only, enabled when both sides are set **and the match is placed** (first round); a toggle — clicking the selected winner again **un-picks**: instantly when nothing downstream moved, else through the **cascade confirmation**. The non-winning control is disabled while decided.
- **Cascade-clear:** correcting rewinds downstream winners and fed sides; lineups of teams still on a tie **stand**, a lineup whose side was cleared is **removed with the side**; the confirmation enumerates the blast radius before anything is destroyed. No new lineup status.
- **Atomicity:** one transaction per action (a winner pick writes `winner_side` and the fed side together).

## 7. UX

Decisions: [Manager and admin UX](issues/06-tbd-ux.md) (+ comments), [Prototype verdict](issues/07-tbd-ui-prototype.md) — variant C

- **Bracket view** (new admin surface, per category, in the shell alongside Matches): the **grouped-table layout** — round headers, one row per slot; side cells (entered team / entry picker + ✕), winner/assignment cell (assign-select on unplaced two-team slots; both-team buttons with selected-toggle once placed), meta cell (placed table·time / BYE / —); the **imported-pool banner** above (chips bind to slots on placement, unbind on release); the **advance-byes** action on balance.
- **Matches dashboard:** every *scheduled* KO tie renders — unplaced pool entries as generic TBD rows, placed slots with their bound schedule; TBD sides read "TBD"; rows link into the bracket view. Byes (unscheduled slots) never appear. Cutoff/locked chips follow the uniform per-side rule.
- **Manager side:** a KO tie enters the manager's world the moment their team lands on it (RLS gives exactly this); "vs TBD" renders bare TBD; **submission is never gated on the opponent**.
- Managers never select winners or enter teams.

## 8. e2e plan

From [04](issues/04-tbd-sides-data-model.md), [05](issues/05-fill-in-mechanism.md), [06](issues/06-tbd-ux.md), [07](issues/07-tbd-ui-prototype.md)

- Isolated fixtures (own category/teams) with a full bracket: pool matches, empty slots, later-round ties; re-runnable without `db reset` per house convention; REST-level assertions use specific error codes.
- Flows: v2 import (fixtures); team entry; wrong-event team blocked; duplicate-slot blocked; ✕ removal incl. **placement release**; placement; balance + advance-byes; winner pick + propagation through to the Final; un-pick instant (Final) and cascade (mid-bracket, incl. a submitted lineup standing vs removed); re-import of a v1 seed rejected cleanly.
- RLS: null-side ties invisible to managers; one-side-known visibility the moment a team lands.

## 9. Out of scope / future

From the map: match scores and full results entry (winner selection is in); standings/group-position computation anywhere; individual-event KO draws; notifications; the manager experience beyond §7's additions; seed updates/re-import paths.

## 10. Implementation-enabling notes

Facts the build tickets carry (sites current as of 2026-08-19):

- **Producer:** `web/src/features/matches/domain/generateRounds.ts` (full rounds + byes), `scheduleMatches.ts` (skip byes), `web/src/features/lineup-seed/domain/buildLineupSeed.ts` (v2 emission; label table +R256, keyed by slot size), export tests treat this spec as reference.
- **Consumer:** `src/domain/seed.ts` (v2 parser), `src/services/importSeed.ts` (three KO row kinds), migration after `0012_*`, `src/domain/matchesDashboard.ts` + `src/views/MatchesView.vue` (TBD rows, links), `src/services/lineupService.ts` (null-opponent membership/display), `src/views/LineupBuilderView.vue` ("vs TBD"), new bracket-view route + service.
- **Domain glossary:** `CONTEXT.md` already carries **Bracket Slot**; on-screen language per §7.
- Both repos: conventional commits, branch per ticket, `npm run type-check` + unit suite after edits; producer repo has no `.scratch/` — its tickets are enacted from this spec.

## 11. Build tickets

Sliced in `.scratch/ko-import/issues/` (numbering continues from the wayfinder tickets):

| # | Repo | Scope |
|---|---|---|
| [09](issues/09-generator-full-rounds.md) | tournament-manager | Full-round generation + structural byes + scheduler skip |
| [10](issues/10-seed-v2-export.md) | tournament-manager | Seed v2 export (pool + brackets + later rounds) + tests |
| [11](issues/11-contract-parser-v2.md) | lineup-manager | Contract doc + schema.json + parser v2 (v2 only) + unit tests |
| [12](issues/12-migration-import.md) | lineup-manager | Migration + domain types + import service + advisors/policy review |
| [13](issues/13-bracket-module.md) | lineup-manager | Bracket module logic (entry/placement/balance/advance/toggle/cascade) + unit tests |
| [14](issues/14-bracket-view-ux.md) | lineup-manager | Bracket view + dashboard/builder UX |
| [15](issues/15-e2e.md) | lineup-manager | e2e suite (§8) |
