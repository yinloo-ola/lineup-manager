# Lineup Manager

Standalone team-lineup submission product (table tennis) — team managers submit
player lineups per fixture (Tie), with gender/age eligibility constraints and
per-tie cutoffs. A single administrator runs tournaments, imports seeds, and
oversees everything. Built with **Vue 3 + Vuetify 3 + Vite + TypeScript +
Supabase** (Postgres, Auth, edge functions). The organizer's tool is the
separate `tournament-manager` repo.

See `AGENTS.md` for architecture, conventions, and the full command reference,
and `CONTEXT.md` for ubiquitous language.

## Prerequisites

- **Node.js 20+**
- **Docker** — required by the local Supabase stack (dev/E2E).

The Supabase CLI is not installed globally — always invoke it through
`npx -y supabase …`.

## Local setup

```bash
npm install
cp .env.example .env        # local Supabase defaults

# Start the local Supabase stack (Docker):
npx -y supabase start

# Serve edge functions (delete-tournament, provision-manager) — the local
# stack only registers functions while this is running, so keep it up in a
# separate terminal for full functionality:
npx -y supabase functions serve

npm run dev                 # http://127.0.0.1:5173
```

Useful maintenance commands:

```bash
npx -y supabase db reset    # re-apply migrations + seed
npx -y supabase db advisors --local   # security/perf linter after schema changes
```

### Creating an administrator (manual)

Email confirmation is disabled locally. Create the first admin via Supabase
Studio (http://127.0.0.1:54323 → Authentication → Users → "Add user"), or sign
up from a throwaway script. Grant admin rights by inserting the account's
email into the `app_admins` table (`is_admin()` checks that table).

The E2E suite auto-creates a test admin (`admin@lineup.local` / `admin-password-123`)
in its global setup.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run type-check` | `vue-tsc --build --force` |
| `npm run test:run` | Unit tests (vitest, pure Node) |
| `npx playwright test` | E2E (needs local Supabase stack + `functions serve`) |

## Testing seams

- **Unit (primary):** pure domain logic in `src/domain/` — no UI, no Supabase
  imports.
- **E2E:** Playwright specs in `e2e/`, backed by the local Supabase stack. The
  suite is re-runnable without `db reset` (global-setup converges state).

## Production

Point the build at a cloud Supabase project by setting `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (build-time env). Deploy the static `dist/` to any host
(GitHub Pages, Netlify, Vercel, nginx). Deploy the edge functions in
`supabase/functions/` to the cloud project (`npx -y supabase functions deploy`).
