# AGENTS.md

Team-lineup submission product (table tennis): Team Managers submit lineups per team match; a single Administrator runs tournaments, imports seeds, and oversees everything. Vue 3 + Vuetify 3 + Vite + TypeScript + Supabase (Postgres, Auth, edge functions). The organizer's tool is a separate `tournament-manager` repo.

**Read before touching sensitive areas:** `CONTEXT.md` (ubiquitous language — use its terms, avoid its avoid-terms; legacy identifiers `Tie`/`Rubber`/`TieFormat`/`categories` are sanctioned mappings), `docs/adr/0001-tournament-scoping.md` (tournament scoping decisions).

## Agent skills

### Issue tracker

Issues are tracked as local markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage labels are used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (127.0.0.1:5173) |
| `npm run type-check` | `vue-tsc` — run after most edits |
| `npm run test:run` | Vitest unit suite (pure Node, no DOM; `src/**/*.test.ts`) |
| `npx playwright test` | E2E (needs local Supabase stack + Docker) |
| `npx -y supabase db reset` | Re-apply migrations + seed to the local stack |
| `npx -y supabase functions serve` | Serve ALL edge functions locally (keep running while doing E2E) |
| `npx -y supabase db advisors --local` | Security/perf linter — run after schema changes |

The Supabase CLI is not installed globally — always `npx -y supabase …`.

## Architecture (layer rules)

- `src/domain/` — pure logic, the primary test seam. **No UI, no Supabase imports.** camelCase domain types.
- `src/services/` — DB access via `supabase-js`; maps snake_case rows ↔ camelCase domain; scopes every query.
- `src/stores/` — Pinia (`auth`, `tournament`). Active-tournament scope persists to localStorage.
- `src/views/` + `src/components/` — Vuetify 3; admin pages render inside the shared shell (`AdminShellView` — rail + app bar with `TournamentSelector`; spec: `.scratch/ux-streamline/spec.md`).
- `supabase/migrations/` — imperative SQL migrations, comment header per ticket, follow existing policy/grant style. `supabase/functions/` — Deno edge functions (service-role; mirror `provision-manager`'s caller-JWT authorization pattern).
- `e2e/` — Playwright; `global-setup.ts` provisions all fixtures.

## Tournament dimension invariants (migration 0011, the contract step)

- `tournament_id` is NOT NULL on all six scoped tables; **every write must stamp it** (lineup upsert, format save, imports, e2e REST payloads).
- Primary keys: `lineups (tournament_id, tie_id, team_id)`, `tie_formats (tournament_id, category_id)`. Upsert `onConflict` targets must match these.
- **Teams/categories/ties keep global-id PKs deliberately** — a bare team id is what `team_managers` and manager RLS key on; per-tournament id recurrence would make a manager's team ambiguous (recorded in ADR 0001). Don't "fix" this.
- Manager lineup writes must stamp the tie's actual tournament (RLS `tie_tournament()` check) — the phantom-row hole was found in review; `e2e/rls.spec.ts` locks it in.
- No unscoped reads: manager RLS confines everything to their own tournament; admin queries filter by the active tournament in the app layer (admin RLS stays global by design).

## E2E conventions

- The suite is **re-runnable without `db reset`**: `global-setup.ts` converges state (idempotent upserts, manager first-login states reset/completed). Keep it that way.
- Destructive specs use **isolated fixtures** (own category/tie/team) so parallel specs never share rows; `fullyParallel` is on.
- REST-level tests assert **specific error codes** (e.g. RLS 42501), never bare `ok()` failures.
- Manager auth accounts can't be torn down without the service role — never put the service-role key in test code; exercise account creation through the real edge functions instead.
- Local-stack edge functions 404 unless `npx supabase functions serve` is running (the container registers functions at creation only).
- `prototype/` is untracked throwaway — do not commit it.

## Workflow conventions

- Conventional commits (`feat(scope): … (#ticket)`); branch `feat/N-slug`; PRs carry `Closes #N` so merges close tickets; squash-merge via `gh pr merge --squash --delete-branch`, then `git checkout main && git reset --hard origin/main` (squash diverges local history).
- GitHub is the issue tracker: every unit of work is a numbered ticket; close finished tickets with an evidence comment.
