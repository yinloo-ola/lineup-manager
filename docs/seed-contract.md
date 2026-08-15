# Seed contract (v1)

The **seed** is the one-time JSON export from the organizer tool (`tournament-manager`, `buildLineupSeed`) that the administrator imports here via **Import tournament…** to create a tournament. This document is the canonical contract, **owned by the consumer** (this repo); the organizer tool's export tests treat it as their reference. The JSON Schema beside this file ([`seed-contract.schema.json`](seed-contract.schema.json)) is machine-checkable truth — keep it, this doc, and the parser (`src/domain/seed.ts`) in lockstep.

- **Versioning:** every seed carries `seedVersion`. This app supports **version 1**; an unknown or missing version is rejected at parse time with a clear message. Evolution of the contract bumps the version — never edits v1 silently.
- **On screen:** the word "seed" never appears to users — the action is "Import tournament". "Seed" is this internal contract's term.
- **Producer:** `/home/user/code/personal/tournament-manager` (local sibling repo). Follow-ups decided alongside this contract, enacted over there: manager-email capture in the entry flow, and `startDate`/`group`/`round` export.

## Shape (v1)

| Field | Shape | Required | Notes |
|---|---|---|---|
| `seedVersion` | integer, `1` | yes | Gate — anything else rejects with a re-export hint. |
| `tournamentName` | string | yes | Names the created tournament; import offers rename on clash. |
| `startDate` | `yyyy-mm-dd` | optional | The organizer's `startTime` when set. When absent the import derives the tournament's start date from the **earliest `scheduledStart`**; the admin can change it later in Tournament settings. Keys the format freeze and the selector's Active & upcoming grouping. |
| `categories[]` | `{id, name, shortName}` | yes | One per team event; ids unique within the seed. |
| `teams[]` | `{id, name, club?, managerEmail}` | yes; `managerEmail` required | One manager per team: email-shaped, **unique across teams** (case-insensitive) — a Team Manager is in charge of exactly one team. Violations name the team(s). |
| `players[]` | `{id, teamId, name, gender, dateOfBirth}` | yes | `dateOfBirth` is `yyyy-mm-dd` or an Excel serial number (normalized on import). |
| `ties[]` | `{id, categoryId, scheduledStart, table?, group?, round?, teamIds[2]}` | yes | `scheduledStart` ISO date-time, tournament-local. `group`/`round` are **human labels** ("A", "2"), not indices; knockout ties omit `group`. Shown on the Matches dashboard where present. Ties without a `scheduledStart` are not exportable (the organizer omits byes and unscheduled matches). |

## Invariants (enforced at parse, before anything is written)

1. Every id unique within its collection; every reference (`players[].teamId`, `ties[].categoryId`, `ties[].teamIds`) resolves within the seed.
2. `ties[].teamIds` is exactly two team ids.
3. `managerEmail` present, email-shaped, unique across teams.
4. Dates are real calendar dates (`startDate`, ISO `dateOfBirth`).
5. Import **always creates a new tournament** — re-importing the same seed makes a second tournament, never an overwrite. Every row is stamped with the new tournament's id; ids are freshly minted per import.

Global-id primary keys on teams/categories/ties are deliberate (ADR 0001 — a bare team id is what manager binding and RLS key on). The contract never "fixes" them.
