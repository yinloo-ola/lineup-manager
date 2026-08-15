# 13 — Admin shell: rail, selector, import entry, setup-aware landing

**What to build:** The real shell decided in spec §3–§4. A persistent left rail groups **Matches** as the primary entry above a subordinate **Tournament setup** group whose three sections — Tournament settings, Team match formats, Provision managers — sit directly in the rail (nothing collapsed), styled quieter than Matches. The app bar names where the admin is and which tournament is active, carries the global tournament selector, and sign out. The selector is searchable: **Active & upcoming by default** (newest-first, start-date subtitles, muted "Type to search past tournaments" hint), past tournaments surfacing only under search, and a trailing **"Import tournament…"** entry that opens the import dialog — import is the create action (spec §4). Landing is setup-aware: Matches when a tournament exists; the "No tournament yet" empty state with the Import tournament CTA when none does. The stale scaffold home and every per-page app bar die; "Home" and "Manage" as labels die. On-screen language is the ubiquitous language throughout.

**Blocked by:** 11 (clean tree).

**Status:** done (2026-08-15)

- [x] Rail shows Matches (primary) + the three setup sections, subordinate but one click each; the lock icon hook for ticket 16 to light up
- [x] App bar: location title + active tournament, selector, sign out
- [x] Selector: default menu Active & upcoming only, start-date subtitles, search-hint entry, Past group under search, "Import tournament…" opens the import dialog
- [x] Import dialog keeps parse-error framing and rename-on-clash
- [x] Landing: Matches with a tournament; empty state with import CTA without one
- [x] Old admin home and per-page app bars are gone; all admin routes live in the shell; type-check and unit tests pass

## Evidence

Commits `505fa0e` (implementation) + `872b5a7` (review fixes). Type-check clean; 148/148 unit tests (8 new `tournamentGrouping` domain tests, TDD). All new modules compile through Vite.

- **Shell:** `AdminShellView` — 230px rail (Matches primary w/ icon + color; Tournament settings / Team match formats / Provision managers subordinate, no collapsing, lock-icon hook on formats once started), app bar with route-`meta.title` location + active tournament name, selector, sign out (navigates to login). All six admin routes nested under the layout; old paths (`/admin/lineups`, `/manage`, `/format`, `/provision`, `/import`) survive as aliases/redirect so existing links and e2e navigation keep working.
- **Past-tournament rule** (spec §8's open question): a tournament is past when its **last scheduled team match** is before today — a start-date-only rule would misfile a running tournament (caught by TDD). Pure `groupTournaments` in the domain; the store fetches only each tournament's last tie (`.limit(1, { referencedTable: 'ties' })` — bounded as history grows).
- **Selector:** searchable autocomplete, Active & upcoming by default + muted "Type to search past tournaments" hint, Past group under search, start-date subtitles, trailing "Import tournament…" → `ImportTournamentDialog` (paste or file, parse-error framing, rename-on-clash — all retained from the old page). Hidden in the app bar when no tournament exists (empty state owns the CTA).
- **Landing:** setup-aware via the router guard (`landingName()` after `auth.init()`): Matches with a tournament, `/setup` ("No tournament yet" + Import CTA) without. `AdminHomeView` + `AdminImportView` deleted; per-page app bars stripped from all four re-homed views; no user-facing "Home"/"Manage" remains.
- **Two-axis review** found and fixed: a **crash on the empty state** (lock-icon `started` computed dereferenced null when no tournament — the exact state this ticket adds; now a loose null check), "N categories" → "N team events" on screen, "Tournament file" aria-label added, duplicated item mapper extracted, the ties payload bounded (was every tie of every tournament per load), stale AGENTS.md architecture line updated.
- **Not run here:** Playwright e2e (Chromium OS libs missing in this environment). Five specs updated for the new shell (login/import/admin/tournament/manage — landing URL `/matches`, dialog-driven import, selector subtitle-aware option matching). Run `npx playwright test` in the proper environment before merging.
- **E2E update (2026-08-15):** the full Playwright suite now runs in this environment (WSL2 Chromium libs extracted user-locally — see AGENTS.md) — 23/23 green twice, alongside 193/193 units. The first run surfaced and fixed real bugs from the untested stretch of tickets 12–17: the store's ambiguous `ties` embed (PGRST201 → silent empty store on every boot), the selector's invalid `{header}` items + Vuetify's search mirror collapsing the menu, and the delete dialog never opening (`openDelete` missed `deleting = true`).
