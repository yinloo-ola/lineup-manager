# Specify the seed contract with the organizer tool

Type: grilling
Status: open

## Question

What exactly must the seed JSON (exported by the separate `tournament-manager` organizer tool, imported here via "Import tournament…") contain? Surfaced during the shell prototype and the admin walkthrough:

- **A team-manager email per team** — provisioning then confirms/activates seeded emails rather than the admin typing them (user decision, ticket 06 session).
- **Group and round per team match** — the Matches dashboard sorts by scheduled time → table, and shows group/round where available (walkthrough decision, ticket 03); the data model lacks them today, so the seed contract is where they enter.
- Shape/naming alignment with what `AdminImportView` consumes today; anything else the import-is-create flow needs (tournament name, start date, team events, teams, players, team matches).
- Where this contract is documented so both repos honor it (this repo's spec vs a shared contract note the organizer tool's repo points at).

Consult `docs/adr/0001-tournament-scoping.md` (global-id PKs on teams/categories/ties are deliberate — the contract must not "fix" them) and the import path in `src/services/` / `AdminImportView.vue`. Resolution feeds the spec section on import.
