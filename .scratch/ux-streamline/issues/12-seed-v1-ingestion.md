# 12 — Seed v1 ingestion

**What to build:** The app accepts the decided seed contract v1 (spec §8) end to end. An organizer exports a seed carrying `seedVersion: 1`, a team-manager email per team, an optional `startDate`, and optional group/round labels per team match; importing it creates a fully-populated tournament with every new field stored. Old-format seeds (no version, no emails) are rejected at parse time with errors that name the offender — never a mystery failure. When the seed omits `startDate`, the tournament's start date is auto-filled from the earliest scheduled team match. The canonical contract — `docs/seed-contract.md` plus a JSON Schema, consumer-owned and versioned with `seedVersion` — is written beside the code that enforces it. The database learns the new shape: manager email on teams, group/round on team matches, and a tournament's start date required once a tournament is running (spec §6). Follow existing migration policy/grant style; teams/categories/ties keep their global-id PKs (ADR 0001 — don't "fix" them).

**Blocked by:** None — can start immediately.

**Status:** done (2026-08-15)

- [x] `seedVersion` gate: unknown/missing version rejects with a clear message
- [x] `managerEmail` per team: required, email-shaped, unique across teams — violations name the team
- [x] Optional `startDate` importable; when absent, auto-filled from the earliest `scheduledStart`; editable later (Tournament settings, ticket 15)
- [x] Optional `group`/`round` labels per team match stored and re-served
- [x] Migration adds the new columns; `start_date` is required for a running tournament; advisors pass
- [x] `docs/seed-contract.md` + JSON Schema exist and match the parser exactly
- [x] Domain parser unit tests cover every gate; existing import behaviors retained (framed parse errors, rename-on-clash)

## Evidence

Commits `74981c3` (implementation) + `2b6d17e` (review fixes). TDD at the domain seam: parser tests written red first, 31 seed tests + 9 service tests green; full suite 140/140, type-check clean, schema JSON valid.

- Version gate: missing `seedVersion` → "pre-v1 seed" re-export hint; unknown version names both versions.
- `managerEmail`: presence/shape/uniqueness (case-insensitive) all name the offending team(s).
- `startDate`: optional, calendar-validated; `resolveStartDate(seed)` in the domain derives the earliest tie day — unit-tested; the import stamps `start_date` on the tournament row.
- Migration `0012_seed_v1_metadata.sql`: `teams.manager_email`, `ties.group_label`/`round_label`; backfills `start_date` from the earliest tie for tournaments that have one (the "required-when-running" rule — the import always stamps it, so the invariant holds by construction; noted in the migration header). Applied to the local stack via `db reset`; columns verified live. Advisors: 10 pre-existing WARNs (permissive-policy pairs, initplan) — none introduced (no new policies).
- Re-served: `Tie` domain type gains `group?`/`round?`; `lineupService` selects and maps them. (managerService deliberately untouched — the manager view shows no tie metadata today; ticket 14 consumes the admin path.)
- Two-axis review found and fixed: e2e `getByLabel('Seed JSON')` locators (label renamed to "Tournament JSON"), residual on-screen "seed" (app-bar title, error prefix, docs pointer in user copy), masking test regex, schema↔parser lockstep (`minLength` dropped; two deliberate gaps documented in the contract doc), duplicated `base()` helper, two-phase team construction.
- **Not run here:** the Playwright e2e suite (Chromium missing OS libraries in this environment) — fixture updated to v1; run `npx playwright test` in the proper environment before merging.
