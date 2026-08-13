# Lineup Manager

Standalone team-lineup submission product — team managers submit player lineups
per fixture (Tie), with gender/age eligibility constraints and per-tie cutoffs.
Built with **Vue 3 + Vuetify 3 + Vite + Supabase**.

> Spec: see issue #1. This repo is the lineup-submission product; the organizer's
> tool is the separate `tournament-manager` repo.

## Status

Ticket 1 (scaffold) is complete: the app builds and type-checks, Supabase Auth is
wired, an administrator can sign in / sign out, the shared domain-types module is
committed, and the Playwright login E2E + CI are in place. Later tickets add the
seed import, Tie Format authoring, lineup builder, validation, and cutoffs.

## Prerequisites

- **Node.js 20+**
- **Docker** — required only for the local Supabase stack (dev/E2E).

## Local setup

```bash
npm install
cp .env.example .env        # local Supabase defaults

# Start the local Supabase stack (Docker):
npx supabase --version      # install the CLI if prompted
supabase start

npm run dev                 # http://127.0.0.1:5173
```

### Creating an administrator (manual)

Email confirmation is disabled locally. Create the first admin via Supabase Studio
(http://127.0.0.1:54323 → Authentication → Users → "Add user"), or sign up from a
throwaway script. Role distinction (Administrator vs Team Manager) lands in later
tickets; for now any authenticated user reaches the admin home page.

The E2E suite auto-creates a test admin (`admin@lineup.local` / `admin-password-123`)
in its global setup.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run type-check` | `vue-tsc --build --force` |
| `npm run test:run` | Unit tests (vitest) |
| `npm run test:e2e` | Playwright E2E (needs local Supabase running) |

## Testing seams

- **Unit (primary):** pure domain logic — `src/domain/` (e.g. `age.ts`). The
  validation engine arrives in Ticket 2 and is tested here.
- **E2E:** Playwright auth flows in `e2e/`, backed by local Supabase.

## Production

Point the build at a cloud Supabase project by setting `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` (build-time env). Deploy the static `dist/` to any host
(GitHub Pages, Netlify, Vercel, nginx).
