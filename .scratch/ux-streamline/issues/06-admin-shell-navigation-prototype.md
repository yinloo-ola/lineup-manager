# Prototype the admin shell and phase-based navigation

Type: prototype
Status: claimed

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
