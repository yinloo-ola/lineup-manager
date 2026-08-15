# Specify the seed contract with the organizer tool

Type: grilling
Status: resolved

## Question

What exactly must the seed JSON (exported by the separate `tournament-manager` organizer tool, imported here via "Import tournament…") contain? Surfaced during the shell prototype and the admin walkthrough:

- **A team-manager email per team** — provisioning then confirms/activates seeded emails rather than the admin typing them (user decision, ticket 06 session).
- **Group and round per team match** — the Matches dashboard sorts by scheduled time → table, and shows group/round where available (walkthrough decision, ticket 03); the data model lacks them today, so the seed contract is where they enter.
- Shape/naming alignment with what `AdminImportView` consumes today; anything else the import-is-create flow needs (tournament name, start date, team events, teams, players, team matches).
- Where this contract is documented so both repos honor it (this repo's spec vs a shared contract note the organizer tool's repo points at).

Consult `docs/adr/0001-tournament-scoping.md` (global-id PKs on teams/categories/ties are deliberate — the contract must not "fix" them) and the import path in `src/services/` / `AdminImportView.vue`. Resolution feeds the spec section on import.

## Answer

**The seed contract v1** (producer: `tournament-manager` at `/home/user/code/personal/tournament-manager`, exporter `web/src/features/lineup-seed/domain/buildLineupSeed.ts` — golden-fixture tested; consumer: this repo, parser `src/domain/seed.ts`). Changes to the current shape, all decided with the user:

| Field | Shape | Required | Notes |
|---|---|---|---|
| `seedVersion` | integer, starts at `1` | yes | Parser rejects unknown versions with a clear message; future evolution bumps it. |
| `startDate` | ISO date | **optional** | Exported from the organizer's `startTime` when set. When absent, **auto-fill at import from the earliest `scheduledStart`**; admin can change it later in Tournament settings. Keys format freeze and the selector's Upcoming/Active split. "When is a tournament past?" stays lineup-manager's business (no end date exists in the organizer model). |
| `teams[].managerEmail` | string (email) | **yes** | Import fails naming the team when missing — forces clean data up front; provisioning is then always pre-filled. Enforce basic email shape and **uniqueness across teams** at parse time (a Team Manager is in charge of exactly one team). Organizer must add email capture to its entry flow (no email exists anywhere in its model today). |
| `ties[].group`, `ties[].round` | human-label strings | optional | The organizer model has `groupIdx`/`roundIdx`/`round` per match but never exported them; export labels, not indices. Knockout ties have no group. Dashboard shows "Group A · Round 2" where present ("where available" per the dashboard decision). |

Unchanged: `tournamentName`, `categories[] {id,name,shortName}`, `teams[] {id,name,club?}`, `players[] {id,teamId,name,gender,dateOfBirth}`, `ties[] {id,categoryId,scheduledStart,table?,teamIds:[a,b]}`; teams/categories/ties keep global-id PKs per ADR 0001 — the contract must not "fix" them.

**Ownership: consumer-owned.** The canonical contract is `docs/seed-contract.md` + a JSON Schema in this repo, versioned with `seedVersion`; the producer repo's `buildLineupSeed` tests link to it as their contract reference. No shared package. ("Seed" remains the internal term; on screen it is "Import tournament".)

Enacting (parser fields, organizer email capture, contract doc) is implementation work outside this map — it enters the implementation tickets sliced from the spec.
