# Seed contract (v2)

The **seed** is the one-time JSON export from the organizer tool (`tournament-manager`, `buildLineupSeed`) that the administrator imports here via **Import tournament…** to create a tournament. This document is the canonical contract, **owned by the consumer** (this repo); the organizer tool's export tests treat it as their reference. The JSON Schema beside this file ([`seed-contract.schema.json`](seed-contract.schema.json)) is machine-checkable truth — keep it, this doc, and the parser (`src/domain/seed.ts`) in lockstep.

- **Versioning:** every seed carries `seedVersion`. This app supports **version 2 only**; anything else (including v1) is rejected at parse time with a re-export hint. Evolution of the contract bumps the version — never edits a version silently.
- **On screen:** the word "seed" never appears to users — the action is "Import tournament". "Seed" is this internal contract's term.
- **Producer:** `/Volumes/Ext/code/personal/tournament-manager` (sibling repo). The knockout model (v2) is specified in `.scratch/ko-import/spec.md` §3 — this doc is its contract expression.
- **Schema ↔ parser, two deliberate gaps:** the schema sets `additionalProperties: false` (the producer's stricter guarantee — the parser ignores unknown fields rather than rejecting), and the schema's `startDate` pattern can only check the shape — the parser additionally rejects impossible calendar dates (e.g. `2026-02-30`). The parser also cross-checks the bracket wiring (below), which the schema cannot express. Everything else is exact lockstep; when changing one of the three artifacts, change all three.

## Shape (v2)

| Field | Shape | Required | Notes |
|---|---|---|---|
| `seedVersion` | integer, `2` | yes | Gate — anything else rejects with a re-export hint. |
| `tournamentName` | string | yes | Names the created tournament; import offers rename on clash. |
| `startDate` | `yyyy-mm-dd` | optional | The organizer's `startTime` when set. When absent the import derives the tournament's start date from the **earliest `scheduledStart`**; the admin can change it later in Tournament settings. Keys the format freeze and the selector's Active & upcoming grouping. |
| `categories[]` | `{id, name, shortName}` | yes | One per team event; ids unique within the seed. |
| `teams[]` | `{id, name, club?, managerEmail}` | yes; `managerEmail` required | One manager per team: email-shaped, **unique across teams** (case-insensitive) — a Team Manager is in charge of exactly one team. Violations name the team(s). |
| `players[]` | `{id, teamId, name, gender, dateOfBirth}` | yes | `dateOfBirth` is `yyyy-mm-dd` or an Excel serial number (normalized on import). |
| `ties[]` — group | `{id, categoryId, scheduledStart, table?, group, round, teamIds[2]}` | yes | Both teams known at export; `group` + `round` are human labels; `teamIds` resolve within the seed. Id: teams + time (producer form). |
| `ties[]` — KO pool | `{id, categoryId, scheduledStart, table, round}` | when KO exists | The **entry round's unplaced pool**: table + time only — **no bracket position, no teams** (the admin places them and enters teams in the bracket view). `round` is the entry-round label. Id: `category\|ko\|LABEL\|table\|time`. |
| `ties[]` — KO later rounds | `{id, categoryId, scheduledStart, table, round, fedBy[2]}` | when KO exists | Positional (id `category\|ko\|LABEL\|n`), both sides fed by earlier slots. |
| `brackets[]` | `{categoryId, rounds: [{label, slots, fedBy?}]}` | when KO exists | One per KO category: every round's slot count (bye slots included) +, from the second round on, which earlier slots feed each side. Omitted when no category has a knockout stage. |

## Invariants (enforced at parse, before anything is written)

1. Every id unique within its collection; every reference (`players[].teamId`, `ties[].categoryId`, `ties[].teamIds`, `brackets[].categoryId`) resolves within the seed.
2. A tie carries `teamIds` **xor** `fedBy` (pool ties carry neither); group ties require `group` + `round`; knockout ties never carry a group, carry a `round` from the fixed set **R256/R128/R64/R32/R16/QF/SF/F**, and require a `table`.
3. Every category with knockout ties declares a bracket; bracket rounds halve (`rounds[i].slots === rounds[i-1].slots / 2`), the entry round declares no feeds, and every feed target is a real slot of the previous round (`category|ko|LABEL|n`).
4. Pool ties belong to the bracket's entry round; every fed tie sits at its positional slot id and its `fedBy` matches the bracket's declared wiring for that slot.
5. `managerEmail` present, email-shaped, unique across teams.
6. Dates are real calendar dates (`startDate`, ISO `dateOfBirth`).
7. Import **always creates a new tournament** — re-importing the same seed makes a second tournament, never an overwrite. Every row is stamped with the new tournament's id; ids are freshly minted per import.

Global-id primary keys on teams/categories/ties are deliberate (ADR 0001 — a bare team id is what manager binding and RLS key on). The contract never "fixes" them.
