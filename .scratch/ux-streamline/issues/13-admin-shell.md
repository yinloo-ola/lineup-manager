# 13 — Admin shell: rail, selector, import entry, setup-aware landing

**What to build:** The real shell decided in spec §3–§4. A persistent left rail groups **Matches** as the primary entry above a subordinate **Tournament setup** group whose three sections — Tournament settings, Team match formats, Provision managers — sit directly in the rail (nothing collapsed), styled quieter than Matches. The app bar names where the admin is and which tournament is active, carries the global tournament selector, and sign out. The selector is searchable: **Active & upcoming by default** (newest-first, start-date subtitles, muted "Type to search past tournaments" hint), past tournaments surfacing only under search, and a trailing **"Import tournament…"** entry that opens the import dialog — import is the create action (spec §4). Landing is setup-aware: Matches when a tournament exists; the "No tournament yet" empty state with the Import tournament CTA when none does. The stale scaffold home and every per-page app bar die; "Home" and "Manage" as labels die. On-screen language is the ubiquitous language throughout.

**Blocked by:** 11 (clean tree).

**Status:** ready-for-agent

- [ ] Rail shows Matches (primary) + the three setup sections, subordinate but one click each; the lock icon hook for frozen formats exists for ticket 16 to light up
- [ ] App bar: location title + active tournament, selector, sign out
- [ ] Selector: default menu Active & upcoming only, start-date subtitles, search-hint entry, Past group under search, "Import tournament…" opens the import dialog
- [ ] Import dialog keeps parse-error framing and rename-on-clash
- [ ] Landing: Matches with a tournament; empty state with import CTA without one
- [ ] Old admin home and per-page app bars are gone; all admin routes live in the shell; type-check and unit tests pass
