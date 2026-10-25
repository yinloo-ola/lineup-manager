# Design: results-entry (slice 1 of results-and-standings)

## At a glance

Team events cannot run today: once lineups are submitted, nobody can record what actually happened at the table. This slice adds score entry for **group** ties — a new per-tournament umpire role provisioned by admins, a per-tie best-of setting, and rubber results (actual players + game scores + walkovers) stored raw while winners stay derived. Admins keep full override power at all times. KO-tie entry deliberately lands in slice 3 with the winner cascade; this slice is complete for group-stage play.

**Key decisions**
- Raw results stored, everything derived on read (rubber winner, tie winner) — matches the bracket module's derived-snapshot pattern and makes free correction trivially safe. `(rejected: materialized standings snapshot — drifts under unrestricted admin corrections)`
- Umpire is a dedicated per-tournament role provisioned like managers. `(rejected: umpires share admin accounts — hands cascade-destructive powers (tournament delete destroys auth accounts) to venue staff)`
- `best_of` lives on the `ties` row, default 5, odd-only, admin-editable per tie. `(rejected: per-rubber field in TieFormat — the human decided best-of is per team match; this also avoids any seed-contract change)`
- The both-lineups-submitted gate is enforced server-side in the service, not just UI. `(rejected: UI-only gate — bypassable and the RLS layer would still accept writes)`
- Player identity per rubber is pre-filled from submitted lineups; umpires cannot change players, admins can. `(rejected: umpire-adjustable players — the human ruled player changes admin-only)`

| R# | Requirement in one line | Risk |
|----|------------------------|------|
| R1 | Per-tie best-of setting, default 5, odd-only, admin-editable | ⚠ production-risk |
| R2 | Umpire role: per-tournament accounts, provisioned by admin, results-only access | ⚠ production-risk |
| R3 | Managers can read results of their own tournament's ties | ⚠ production-risk |
| R4 | Result entry is blocked until both sides' lineups are submitted | |
| R5 | Umpire enters rubber results (games, walkover) with players locked to the pre-filled lineup | |
| R6 | Admin can enter and freely override any result, including players, at any time | |
| R7 | Rubber winner and tie winner are derived from stored results and shown without being stored | |

## Requirements

### R1: Per-tie best-of setting

Every tie has a best-of-games setting. Imported ties default to 5. An admin can change a tie's best-of to any odd number in the tie detail; even values and non-positive values are rejected with a visible error.

**Acceptance criteria**
- Given an imported tournament, When its ties are inspected, Then every tie's best-of is 5 without any import change.
- Given an admin editing a tie detail, When they set best-of to 7, Then the value is saved and the tie detail shows it.
- Given an admin editing a tie detail, When they set best-of to 4, Then the change is rejected with an odd-number error and the stored value is unchanged.

### Checkpoints: none
### Review: skip

### R2: Umpire role and provisioning

A new umpire role exists: per-tournament accounts (email + auth user), created by an admin, able to enter and edit results only for ties in their own tournament, with no access to lineups, rosters, formats, or tournament management. Umpire accounts require a password change on first login like manager accounts. Deleting a tournament deletes its umpires' auth accounts.

**Acceptance criteria**
- Given an admin in tournament settings, When they provision an umpire with an email, Then an auth account and umpire row scoped to that tournament exist and the umpire appears in the tournament's umpire list.
- Given an umpire logged in, When they request a tie in another tournament, Then the request is denied by RLS.
- Given an umpire logged in, When they attempt a manager or admin action (e.g. reading another team's roster via API, writing a lineup), Then it is denied by RLS.
- Given a first-login umpire, When they sign in, Then they are forced through the change-password flow before reaching the umpire screen.
- Given a tournament with an umpire, When an admin deletes the tournament, Then the umpire's auth account no longer exists.

### Checkpoints: none
### Review: skip

### Production-risk notes
- New migration (schema + RLS) and a new auth-provisioning edge function mirroring provision-manager; delete cascade touches real auth accounts.

### R3: Manager read access to results

Team managers can read the stored results of ties in their own tournament, including results of ties involving their own and other teams. They cannot write results.

**Acceptance criteria**
- Given a manager of a team in a tournament, When they request results for any tie in that tournament, Then the data is returned.
- Given a manager, When they attempt to insert or update any result row, Then the write is denied by RLS.

### Checkpoints: none
### Review: skip

### Production-risk notes
- RLS policy widening on the new results table; read-only by construction.

### R4: Lineup-submitted gate

A tie's results can be entered (by umpire or admin) only once both sides have a submitted lineup. Until then the tie is locked for entry with the reason shown. Group ties with a null or unsubmitted side are locked.

**Acceptance criteria**
- Given a group tie where either side's lineup status is not `submitted`, When an umpire opens it for entry, Then entry is locked with the reason "lineup not submitted" and no save is possible.
- Given the same attempt issued directly against the service/RLS, When a result row is written, Then the write is rejected server-side.
- Given a group tie with both lineups submitted, When an umpire opens it, Then entry is available.

### Checkpoints: none
### Review: skip

### R5: Umpire score entry

An umpire sees their tournament's group ties with entry state (not entered / partial / decided) and can enter one tie at a time. For each rubber in the tie's format they see the pre-filled players (read-only), enter game scores as free-form pairs, or mark a walkover. Validation follows the tie's best-of: a rubber is decided when one side wins the majority of games; entering additional games after a majority winner is rejected; scores must be non-negative numbers; a walkover carries no games. Partial entry (some rubbers, tie undecided) saves successfully and shows as partial.

**Acceptance criteria**
- Given a both-submitted group tie, When the umpire enters valid games for each rubber and saves, Then all rubber rows persist and the tie shows as decided with the derived winner.
- Given a rubber whose best-of majority is already reached, When the umpire adds a further game, Then the entry is rejected with an overflow error before save.
- Given a rubber the umpire marks as walkover, When saved, Then the row stores the walkover with no games.
- Given an umpire viewing the entry form, When they inspect the players, Then they are displayed read-only, exactly as pre-filled from the submitted lineups.
- Given only some rubbers entered, When the umpire saves, Then the partial state persists and reopens with entries intact.

### Checkpoints: none
### Review: skip

### R6: Admin override

On the Matches dashboard, an admin can open a results dialog for any group tie and edit everything: players per rubber per side, game scores, walkovers, and best-of — regardless of who entered the data — at any time, including after a tie is decided.

**Acceptance criteria**
- Given a decided tie entered by an umpire, When the admin changes a player and a game score, Then the changes persist and the derived winner recomputes.
- Given a tie with no results, When the admin opens the dialog, Then players pre-fill from submitted lineups and the admin can edit them freely.
- Given an admin editing best-of in the dialog, When they set an even number, Then it is rejected per R1.

### Checkpoints: none
### Review: skip

### R7: Derived winners on read

Rubber winner (majority of games under the tie's best-of) and tie winner (majority of rubbers; walkover wins its rubber; unplayed rubbers count for neither side) are computed from stored results whenever results are displayed. Nothing about winners is written to the database in this slice, and re-derivation after any edit is immediate.

**Acceptance criteria**
- Given stored rubber results forming a majority, When any consumer reads the tie's results, Then the tie winner equals the side with more rubbers won without any stored winner field.
- Given a tie leading 3-0 in a best-of-5-rubbers format, When results are read, Then the tie is decided with the remaining rubbers unplayed.
- Given an admin edit that flips a rubber, When results are read afterward, Then the tie winner reflects the new state with no refresh action beyond re-reading.

### Checkpoints: none
### Review: skip

## Production-risk areas

- **Schema migration 0015**: new `umpires` and `rubber_results` tables, `ties.best_of` column, RLS policies for three roles (admin/umpire/manager). Umpire policy on `rubber_results` must restrict updates to score columns only (`player_ids` immutable for umpires) — enforced in the policy, verified by tests.
- **Auth**: new edge function `provision-umpire` creating real auth accounts (service-role, caller-JWT-admin authorization, `must_change_password`), and tournament delete now cascades umpire auth accounts — destructive, same class as the existing manager cascade.

## Setup

- Migration 0015 applies via `supabase db reset` (local). Verify: `\d rubber_results` shows the unique `(tie_id, rubber_index)` constraint and RLS enabled on both new tables; existing ties read `best_of = 5`.
- The `provision-umpire` function runs under `supabase functions serve` locally (edge functions 404 without it — known local quirk). Verify: provisioning an umpire from the admin UI creates a login that can complete the change-password flow.

## Approaches considered

- **Raw results + derived winners (chosen)** — store only entered data; winners computed on read. Loser alternatives: write-through materialization of winners/standings (drifts under unrestricted corrections, a failure mode the codebase avoids); single jsonb aggregate per tie (whole-blob rewrites contend between umpires and re-validates everything on each save).
- **Umpire as admin account (rejected)** — admins can delete tournaments and cascade auth accounts; unacceptable for venue staff. Dedicated per-tournament role with narrow RLS follows the existing `team_managers` pattern at modest cost.
- **Best-of per rubber in TieFormat (rejected)** — the human decided best-of is per team match, not per rubber; putting it on `ties` also avoids touching the seed contract or the Formats authoring UI.

## Architecture

New pure domain module `src/domain/results.ts` (derivation + validation, no Supabase imports), new service `src/services/resultsService.ts` (guard-checked single-row writes in the bracketService style), migration `supabase/migrations/0015_results_umpires.sql`, edge function `supabase/functions/provision-umpire/`, umpire shell route `/umpire` outside the admin shell with its own minimal layout, and an admin results dialog on the Matches dashboard. Layering and conventions per AGENTS.md: domain pure camelCase, services snake_case↔camelCase mapping, every query tournament-scoped.

## Data flow

Seed import (unchanged) → ties default `best_of = 5` → managers submit lineups (existing flow) → admin provisions umpires → umpire logs in (change-password on first login) → umpire picks a group tie whose both lineups are submitted → enters games/walkovers per rubber with players pre-filled and locked → service checks gate + domain validation → rows upsert into `rubber_results` → consumers read results and winners are derived on display. Admin overrides flow through the same service with the player-edit and any-time powers; RLS, not UI, enforces the role difference.

## Error handling

Domain violations render inline per rubber (the established `Violation` reporting style); service guard rejections (gate not met, KO tie in this slice, TBD side) surface as typed errors mapped to toasts; locked ties show the reason rather than failing at save time; even best-of is rejected at the input with a stated rule. Partial results are a first-class visible state, never an error.

## Testing

Red-first at the domain seam: best-of winner math, overflow rejection, walkover short-circuit, tie majority with unplayed rubbers, prefill merge, odd-best-of validation. Service tests against local Supabase following the `importSeed.test.ts` pattern (gate enforcement, umpire column restriction). E2E: provision umpire → first-login password change → enter a full result → decided tie; admin player override after umpire entry; lineup gate locked row; RLS spec for umpire cross-tournament denial, umpire `player_ids` immutability, manager read/write split.

## Feature acceptance

- Given an imported tournament with both lineups submitted for a group tie, When an umpire logs in, enters best-of-valid games (one rubber as a walkover), and saves, Then the tie shows as decided with the derived winner, and the admin can afterwards override a player and a game score and the derived winner recomputes.
- Given a group tie where one side's lineup is not submitted, When an umpire attempts entry through the UI or the service directly, Then entry is refused with the reason visible and no result rows exist for the tie.

### Feature review: auto
