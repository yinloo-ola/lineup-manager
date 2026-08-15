# Wayfinder map: Streamline the lineup-manager UX and usage flow

Label: `wayfinder:map`

## Destination

A decision-complete UX spec for the **administrator console**: every open experience decision — on-screen language, information architecture, screens, states, and the admin flow end-to-end (import → provision → author format → oversee) — resolved and ready to slice into implementation tickets. The manager experience is out of scope (decided in [Confirm the destination and scope](issues/01-confirm-destination-and-scope.md)); planning only, nothing is built on this map.

## Notes

- Domain: table-tennis team-lineup submission. Root `CONTEXT.md` holds the ubiquitous language; `Tie`/`Rubber`/`TieFormat` are sanctioned legacy **code** identifiers per `AGENTS.md`. The on-screen language is settled: the ubiquitous language everywhere (decision in [Confirm the destination and scope](issues/01-confirm-destination-and-scope.md)).
- Consult `docs/adr/0001-tournament-scoping.md` before any decision that touches tournament scoping.
- Skills every session should consult: grilling tickets → `/grilling` + `/domain-modeling`; any "how should it look" question → `/prototype`; research tickets → `/research`. For UX-design judgments (navigation, IA, forms, data tables, accessibility, microcopy), consult the [ux-designer skill](https://github.com/szilu/ux-designer-skill) — its `SKILL.md` checklists/anti-patterns plus on-demand `references/` (Nielsen heuristics, Laws of UX, IA, forms, data tables, onboarding) are the design lens the user asked this effort to learn from.
- Current surfaces (fact base): `src/views/AdminHomeView.vue`, `AdminImportView.vue`, `AdminLineupsView.vue`, `AdminManageView.vue`, `AdminProvisionView.vue`, `AuthorTieFormatView.vue` (manager surfaces remain listed in tickets for context); routes in `src/router/index.ts`. Code-level confusion candidates are recorded in the ticket bodies, not here.
- Standing preference: plan, don't do — decisions, not deliverables.

## Decisions so far

- [Confirm the destination and scope](issues/01-confirm-destination-and-scope.md) — admin console only; decision-complete UX spec as the artifact; structural changes allowed; the ubiquitous language on screen (code identifiers stay Tie/Rubber).
- [External UX patterns for deadline-driven lineup submission](issues/04-external-lineup-ux-patterns.md) — fixture-anchored IA with status chips, draft→explicit-submit→locked state, escalating deadline ladder + admin nudge view, submit-time validation that names the broken rule, and guarded format changes (NFL add-not-remove precedent); assume phone-at-venue submission.
- [Admin console walkthrough](issues/03-admin-console-walkthrough.md) — oversight is the heartbeat; lean submitted/not-submitted dashboard by team match (sorted scheduled time → table number, completed/cutoff filters); phase-based nav grouping setup vs oversight with location awareness; setup-aware landing; visibility-only chasing; format authoring and import/manage/provision are fine as-is.
- [Settle the user-facing status vocabulary](issues/05-user-facing-status-vocabulary.md) — binary Submitted/Not submitted outside the builder, rare Needs-attention marker, Locked chip stays, "completed" reserved for a future results feature; formats freeze at tournament start with guarded (impact-preview + confirm) pre-start edits. Glossary updated in `CONTEXT.md`.
- [Prototype the admin shell and phase-based navigation](issues/06-admin-shell-navigation-prototype.md) — the shell is variant A: flat left rail, **Matches** primary, the three setup sections (Tournament settings / Team match formats / Provision managers) directly in the rail but visually subordinate, no collapsing; setup-aware landing; searchable tournament selector owning switching **and** creation ("Import tournament…" — never "Import seed" on screen), defaulting to Active & upcoming with past tournaments surfaced only by search; format freeze shown as a rail lock icon.
- [Prototype the oversight dashboard and grouped lineups view](issues/07-oversight-dashboard-prototype.md) — the Matches dashboard is a dense fixture table: one row per team match (scheduled → table sort), status chips inline, calm Locked chip for cutoff-passed matches, and the urgent **Missed cutoff** state (missing past cutoff) tinted red; filters All / Not submitted / Submitted / Past cutoff; drill-in dialog with both lineups and Edit/Fill-on-behalf (`?team=`); chasing stays visibility-only. Glossary gained Missed cutoff.
- [Specify the seed contract with the organizer tool](issues/08-seed-contract-with-organizer-tool.md) — seed v1 adds `seedVersion: 1` (required), `startDate` (optional; auto-filled at import from earliest `scheduledStart`, editable in Tournament settings), `teams[].managerEmail` (required, unique, parse-enforced — organizer must add email capture), and optional `ties[].group`/`ties[].round` labels. Consumer-owned contract: `docs/seed-contract.md` + JSON Schema here, producer repo links to it.
- [Must the console's patterns stay consistent with tournament-manager?](issues/09-cross-app-consistency-with-organizer.md) — terminology-only consistency (one on-screen vocabulary + consistent meanings for shared entities); visual/navigation/component patterns stay per-app. **Team Match** wins as the word for the fixture in both apps — tournament-manager adopts it on screen as a follow-up in that repo (its glossary said the opposite today).
- [Assemble the decision-complete UX spec](issues/10-assemble-ux-spec.md) — the spec exists at [spec.md](spec.md): all decisions assembled, traceable to tickets, with implementation-enabling notes. **Map closed — destination reached.**

## Not yet specified

_(empty — the last fog patch, cross-app consistency, graduated into [Must the console's patterns stay consistent with tournament-manager?](issues/09-cross-app-consistency-with-organizer.md))_

## Out of scope

- Match results and team-match completion — the future feature where the admin fills in match results and marks a team match completed (surfaced in [Settle the user-facing status vocabulary](issues/05-user-facing-status-vocabulary.md); the word "completed" is reserved for it). New-feature work, beyond this map's streamlining destination.
- The manager experience — manager home, lineup-builder interaction, manager-facing statuses and onboarding, mobile/venue expectations. Beyond this map's admin-only destination; [Manager journey walkthrough](issues/02-manager-journey-walkthrough.md) was closed for this reason. Returns only as a fresh effort, not a resumption.
- Building the redesign — implementation tickets are sliced after this map closes; the destination is the spec, not shipped code.
- The separate `tournament-manager` repo's own UX — this map covers this app only (consistency with that repo may still shape decisions here).
- Visual branding or theme work beyond what a UX decision directly requires.
- Backend, data-model, or RLS changes for their own sake — a spec decision may *require* one, but enacting it is implementation work outside this map.
