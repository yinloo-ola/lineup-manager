# Confirm the destination and scope of this effort

Type: grilling
Status: resolved

HITL — only the user can answer; the agent never stands in for them.

## Question

Wayfinder charting opened with four destination-shaping questions that the user has not yet answered. Each recommendation below is the agent's; each answer is the user's.

1. **Primary user.** Whose confusion does this effort fix first — the manager flow (login → team matches → build/submit a lineup), the admin console (import → provision → author format → oversight), or both in some order?
   ➡️ Recommended: both, managers first — managers are the many; the admin is one person.
2. **Destination artifact.** What exists when this map closes — a decision-complete UX spec (the planning default), a user-validated clickable prototype, or the streamlined UX actually shipped?
   ➡️ Recommended: a decision-complete spec, sliced into implementation tickets afterwards.
3. **Depth.** Are structural changes allowed (restructuring navigation, merging or adding screens, reworking the lineup-building interaction itself), or polish within the current page structure only?
   ➡️ Recommended: structural allowed — the complaint is about the *flow*, not just labels.
4. **On-screen language.** The UI shows managers "Ties", "Rubber 1", "Tie Format", while `CONTEXT.md` defines Team Match / Match / Team Match Format and lists tie/rubber among its avoid-terms. Which language do users see on screen? (Code identifiers stay `Tie`/`Rubber` either way — the sanctioned mapping.)
   ➡️ Recommended: the ubiquitous language on screen; amend `CONTEXT.md` only if the user insists tie/rubber is what their table-tennis people actually say.

Code-level observations motivating each question (verified by reading, not speculation):

- Manager side: `ManagerView.vue:13-21` shows raw status enum strings, and `ManagerView.vue:103-108` pairs a status chip with a second `locked`/`open` chip; `LineupBuilderView.vue:324-333` adds `complete`/`incomplete` — up to eight overlapping state terms reach the user.
- Admin side: `AdminHomeView.vue:58` still says "The scaffold is live. Roster views, Tie Format authoring, and lineup submission arrive in later tickets" — stale copy, those features shipped; five admin pages each carry their own app bar with no shared navigation (`src/router/index.ts`).

The answers redraw this map: audience priority orders or deletes the walkthrough tickets, the artifact choice may add prototype/execution tickets, and depth sets the ceiling for every downstream design decision.

## Answer

Resolved 2026-08-14, live grilling with the user:

1. **Primary user: admin flow only.** This effort redesigns the administrator console (import → provision → author format → oversee). The manager experience stays as-is — beyond this map's destination; [Manager journey walkthrough](02-manager-journey-walkthrough.md) closed as out of scope.
2. **Destination artifact: decision-complete UX spec.** Every admin-console decision resolved and ready to slice into implementation tickets — the planning default, confirmed.
3. **Depth: structural changes allowed.** A real navigation shell, merging or adding screens, and reworking admin interactions are all in play; not just relabeling and tidying.
4. **On-screen language: the ubiquitous language.** Screen copy says Team Match / Match / Team Match Format per `CONTEXT.md`; code identifiers stay `Tie`/`Rubber` (the sanctioned mapping). `CONTEXT.md` needs no amendment — it already prescribes this.

Consequences recorded on the map: destination redrawn to admin-only; manager-side fog moved to Out of scope; [Admin console walkthrough](03-admin-console-walkthrough.md) is now the whole effort's user research and unblocked; [Settle the user-facing status vocabulary](05-user-facing-status-vocabulary.md) rescoped to the admin surfaces.
