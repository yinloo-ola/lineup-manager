# 12 — Seed v1 ingestion

**What to build:** The app accepts the decided seed contract v1 (spec §8) end to end. An organizer exports a seed carrying `seedVersion: 1`, a team-manager email per team, an optional `startDate`, and optional group/round labels per team match; importing it creates a fully-populated tournament with every new field stored. Old-format seeds (no version, no emails) are rejected at parse time with errors that name the offender — never a mystery failure. When the seed omits `startDate`, the tournament's start date is auto-filled from the earliest scheduled team match. The canonical contract — `docs/seed-contract.md` plus a JSON Schema, consumer-owned and versioned with `seedVersion` — is written beside the code that enforces it. The database learns the new shape: manager email on teams, group/round on team matches, and a tournament's start date required once a tournament is running (spec §6). Follow existing migration policy/grant style; teams/categories/ties keep their global-id PKs (ADR 0001 — don't "fix" them).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `seedVersion` gate: unknown/missing version rejects with a clear message
- [ ] `managerEmail` per team: required, email-shaped, unique across teams — violations name the team
- [ ] Optional `startDate` importable; when absent, auto-filled from the earliest `scheduledStart`; editable later (Tournament settings, ticket 15)
- [ ] Optional `group`/`round` labels per team match stored and re-served
- [ ] Migration adds the new columns; `start_date` is required for a running tournament; advisors pass
- [ ] `docs/seed-contract.md` + JSON Schema exist and match the parser exactly
- [ ] Domain parser unit tests cover every gate; existing import behaviors retained (framed parse errors, rename-on-clash)
