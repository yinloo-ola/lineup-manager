# Must the console's patterns stay consistent with tournament-manager?

Type: grilling
Status: resolved

## Question

Now every view decision for the admin console is made, the last standing question from the map's fog: should the spec mandate keeping lineup-manager's console patterns consistent with the separate `tournament-manager` organizer app (navigation style, table/list idioms, status coloring, terminology on shared entities like teams/players/ties) — or is lineup-manager free to evolve its own patterns, with the seed contract ([Specify the seed contract with the organizer tool](08-seed-contract-with-organizer-tool.md)) the only coupling? The same person uses both apps on tournament day, which is the argument for consistency; the apps have different jobs (run a tournament vs. collect lineups), which is the argument against a blanket rule. Resolution lands as a section (or explicit non-section) of the final spec.

## Answer

**Terminology-only consistency — and Team Match is the word across both apps.** Verbatim: Q1 "a", Q2 "team match".

- **The rule:** one agreed on-screen vocabulary and consistent meanings for shared entities (the team-versus-team fixture, teams, players, statuses; how `seedVersion` travels) across lineup-manager and tournament-manager. Visual patterns, navigation, and components stay per-app — factually they already diverge completely (organizer: shell-less pages, hand-rolled Material-3-ish widgets; lineup-manager: Vuetify 3 rails/app bars), and forcing either system onto the other buys nothing for the single person using both.
- **The word:** **Team Match** (this repo's settled term; "Tie" stays a sanctioned legacy *code* identifier only). The organizer's glossary currently says the opposite ("Tie, avoid: team match") and its UI uses "Matches" for its finer-grained scheduler `Match` objects — so **tournament-manager adopts Team Match on screen** as a follow-up change in that repo (glossary + UI labels), noted in the spec, not enacted on this map. Discovered en route: the two repos' glossaries directly contradicted each other on this entity — the same row of data named oppositely in the two apps one person uses back-to-back on tournament day.
- **Spec section:** a short "Cross-app terminology" section listing the agreed words (Team Match, team, player, submitted/locked as applicable) and the seed contract as the only other coupling; no visual/pattern mandate.

`CONTEXT.md` (this repo) gains a one-line note on the Team Match entry recording the cross-app agreement.
