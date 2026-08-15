# Prototype the admin shell and phase-based navigation

Type: prototype
Status: resolved

HITL — raise fidelity with a cheap artifact the user reacts to; use the `/prototype` skill.

## Question

What does the console's persistent shell concretely look like? Prototype it. Constraints and decisions already made ([Admin console walkthrough](03-admin-console-walkthrough.md)):

- **Location awareness everywhere** — the admin always knows where they are.
- **Phase-based grouping**: one area for pre-tournament setup — import seed, manage tournaments (rename/start-date/delete), author team-match format, provision managers — and a separate area for lineup oversight. The meaningless "Home" and "Manage" labels die.
- **Setup-aware landing**: oversight dashboard when an active tournament exists; setup (import/create) when none does — design the empty/first-run state too.
- The global tournament selector moves into the shell (every admin page is tournament-scoped today).
- The setup area reflects the **format freeze** decided in [Settle the user-facing status vocabulary](05-user-facing-status-vocabulary.md): the format authoring page shows a frozen/disabled state with its reason once the tournament has started, and pre-start breaking edits carry an impact preview with explicit confirmation.
- On-screen language is the ubiquitous language (`CONTEXT.md`); code identifiers stay as-is.
- Stack: Vue 3 + Vuetify 3 (navigation drawer/rail are the natural components). Consult the [ux-designer skill](https://github.com/szilu/ux-designer-skill) navigation/IA references for the design lens.

The prototype should be rough and cheap — enough to react to grouping, labels, landing behavior, and empty states. What's being decided is the structure, not pixels.

## Comments

- **2026-08-15, the user, while reviewing:** "The top tabs prototype is not working properly. Can't see any top tabs." — fixed: the tab strip was a bare `v-layout` child rendering behind the fixed app bar; it now lives in the app-bar's extension slot (verified rendering + clicking in the browser).
- **2026-08-15, the user, flow feedback (design-shaping):** "Import seed is actually creating another tournament. It's equivalent to a Create button. After you import a tournament from a JSON file, you should be able to then set up the tournament by defining the team match format and provisioning the accounts for team managers. Perhaps the seed should contain a team manager email for each team."
  - Import seed **is** the create action — one import = one more tournament.
  - The setup phase reads as a sequence after import: define team match formats → provision manager accounts.
  - **The seed JSON should carry a team-manager email per team** — provisioning then confirms/activates seeded emails rather than typing them. (A seed-contract requirement; folded into the map's fog on the seed contract.) The mock content now reflects all of this.
- **2026-08-15, the user, more review feedback:** "Since the top right dropdown is already showing the selected tournament, showing a list of tournaments in the setup tab is weird." — the setup section is now **Tournament settings for the selected tournament** (rename, start date, delete), with a pointer to the top-right selector for switching. The selector owns switching; the settings page owns managing the selected one. Renamed across all three variants.
- **2026-08-15, the user:** "Import seed under a selected tournament is weird too. Where should we place it?" — same category error: the setup items act *on* the selected tournament; import *creates a new one*. **Agent recommendation, implemented for reaction:** import lives in the tournament selector as a trailing "Import seed…" entry opening a dialog (switcher-with-create pattern); the setup group becomes purely per-tournament (settings, formats, provision); the no-tournament empty state keeps its import CTA. Alternatives considered and rejected: a global "+" app-bar button (vaguer, duplicates the selector's create role) and a button inside Tournament settings (buries creation of the second tournament onward).
- **2026-08-15, the user, verdict direction:** "C feels better. But can we put Oversight on the left? Rename it to **Matches**. Setup should be more subtle and should not be at the same level. Inside the setup tab, the 3 types of setups can be also tabbed." — Variant C reshaped accordingly, implemented for final reaction: a slim left nav with **Matches** as the primary entry (icon, full-height emphasis) and **Setup** demoted below a divider (smaller text, subdued color); Setup's three sections (Tournament settings / Team match formats / Provision managers) are inner **tabs**; Matches disabled in the no-tournament state. The old top-of-content Setup|Oversight toggle is gone.
- **2026-08-15, the user, microcopy:** "Import seed" reads as jargon on screen — relabeled to **"Import tournament"** everywhere in the prototype (selector entry "Import tournament…", dialog, empty-state CTA, "from import" phrasing). **"Seed" stays as the internal spec term** for the JSON contract with the organizer tool (see the map's seed-contract fog); on screen the admin's mental model is "adding a tournament."
- **2026-08-15, the user, scaling concern:** "When the list of tournaments gets bigger over time the dropdown will be very long — hard to find the recent tournament for oversight and past tournaments to view previous lineups." Valid: past tournaments are never deleted (lineups stay viewable), so the list only grows. **Implemented for reaction:** the selector is now a searchable autocomplete with grouped **Active & upcoming / Past** sections, newest-first, each entry carrying its start date; headers drop out under filtering and the "Import tournament…" entry always stays. Mock list extended to nine tournaments to make the problem visible. Alternative considered and deferred: a dedicated "all tournaments" archive/search page — only worth it if search-in-selector proves insufficient in practice.
- **2026-08-15, the user, post-resolution refinement:** "Display active and future; past are searchable." — the default dropdown now lists **Active & upcoming only** (plus a muted "Type to search past tournaments" hint); typing surfaces matching past tournaments under a "Past" header. Answer amended in place.

## Answer

**The shell is variant A — a flat left rail, nothing collapsed.** Verbatim from the user: "I choose the current A." Final shape (visible at `/prototype/shell?variant=A` at the time of resolution):

- **Left rail (230px), flat, two groups:**
  - **Tournament** → **Matches** — the primary entry (renamed from "Oversight" per the user; colored when active, icon `mdi-table-tennis`). The dashboard is the heartbeat area.
  - **Tournament setup** → the three sections **directly in the rail, one click each — NOT collapsed** behind a Setup page or inner tabs (user: "don't collapse!"): Tournament settings, Team match formats, Provision managers. They are styled subordinate (smaller text, subdued color) so they don't compete with Matches. Format freeze shows as a lock icon on the rail entry when the tournament has started.
- **App bar:** location title (Matches / current setup section) beside the active tournament; global **tournament selector**; sign out.
- **Tournament selector:** searchable autocomplete (the list of tournaments only grows — past tournaments are never deleted since their lineups stay viewable). **The default menu shows Active & upcoming only**, newest-first, with a start-date subtitle per entry and a muted "Type to search past tournaments" hint; **past tournaments surface only when searching**, under a "Past" header. The trailing **"Import tournament…"** entry is the create action (switcher-with-create pattern), opening an upload dialog; the no-tournament empty state keeps its import CTA. On-screen label is **"Import tournament"**, never "Import seed" — "seed" remains the internal spec term for the organizer-tool JSON contract only.
- **Setup-aware landing:** Matches when a tournament exists; the setup/empty state when none does.
- Journey to this answer: C's phase-mode launcher felt best structurally, but successive modifications (Matches on the left, Setup subordinate, rename) converged it onto A's rail; the user then preferred A's dressing with C's naming, rejected collapsing setup sections behind tabs, and settled on flat A.

Prototype captured in commit 4fbab98 + the resolution commit on `feat/ux-streamline` (dev-only route, throwaway — not for merge).
