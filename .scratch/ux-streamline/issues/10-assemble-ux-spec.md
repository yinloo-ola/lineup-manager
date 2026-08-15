# Assemble the decision-complete UX spec

Type: task
Status: resolved
Blocked by: 09

## Question

Assemble the spec artifact this map exists to produce — `.scratch/ux-streamline/spec.md` per the tracker's conventions — from the resolved decisions (tickets 01, 03–08, plus 09 once resolved): destination/scope, the shell and navigation, the Matches dashboard and drill-in, status vocabulary, format freeze, the tournament selector and import-is-create flow, and the seed contract. Every screen, state (including empty/first-run), filter, label, and on-screen word traceable to its deciding ticket; implementation-enabling notes (e.g. parse-level email uniqueness, startDate auto-fill) called out as such. The prototype commits on `feat/ux-streamline` are the visual reference (dev-only, not for merge). Done = the spec reads standalone; the map then closes, ready to slice into implementation tickets.

## Answer

**The spec is written: [../spec.md](../spec.md)** — the map's destination artifact. Eleven sections, every one citing its deciding ticket: principles, on-screen vocabulary (incl. Missed cutoff and the Import-tournament wording), the shell (flat rail, Matches primary, no collapsing), the tournament selector and import-is-create, the Matches fixture-table dashboard with drill-in and on-behalf actions, format freeze and guarded edits, the three setup sections, seed contract v1, cross-app terminology, out-of-scope/future, and implementation-enabling notes (start_date required-when-running, group/round metadata, parser gates, seed-contract doc, organizer-repo follow-ups). Reads standalone.

**The map is now closed**: all tickets resolved (01, 03–10; 02 closed out of scope), fog empty, destination reached. Next step beyond the map: slice the spec into implementation tickets (a fresh effort — `/to-tickets`), which will also decide what happens to the prototype code on `feat/ux-streamline` (reference-only, not for merge).
