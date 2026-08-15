# Admin console walkthrough — where does the flow actually confuse?

Type: grilling
Status: resolved
Blocked by: 01

## Question

Walk the administrator journey live with the user and record every point of friction across a tournament's life: importing a seed, managing tournaments, provisioning a manager, authoring a team-match format, and overseeing all lineups. Which parts genuinely confuse, which merely annoy, and what is missing entirely — an at-a-glance tournament dashboard, deadline monitoring, chase-up of missing lineups?

Candidates observed in code — to confirm or dismiss with the user, never assumed:

- The admin home is still scaffold copy: "The scaffold is live. Roster views, Tie Format authoring, and lineup submission arrive in later tickets" — stale, those features exist — with five flat buttons and no overview value (`src/views/AdminHomeView.vue:52-78`).
- Five pages each with their own app bar and Home button; no shared navigation shell, so the admin bounces home between tasks (`src/router/index.ts`).
- All-lineups is one flat table of every (team match, team) row with no grouping, filtering, or search (`src/views/AdminLineupsView.vue:66-108`).
- Format authoring is a dense form (lead time, usage policy, per-match constraint rows with up/down reordering) and a format change silently invalidates already-submitted lineups — the consequences reach managers as a red "action needed" state the admin may not have anticipated (`src/views/AuthorTieFormatView.vue`).

If [Confirm the destination and scope](01-confirm-destination-and-scope.md) scopes the manager flow out entirely, this ticket becomes the whole effort's user research. — It did; this ticket is now the whole effort's user research.

## Comments

- **2026-08-14, the user (unsolicited, before this ticket was worked):** "The admin home page is confusing. Navigation can be simplified." — firsthand confirmation of the first two code-observed candidates above (stale scaffold home; five pages with no shared navigation). Weigh as the user's own top-of-mind pains when running the walkthrough; don't re-litigate, build on them.

## Answer

Resolved 2026-08-15 via two grilling rounds with the user.

### Pains confirmed

1. **The admin home page is confusing** (the user's own words) — stale scaffold copy, five flat buttons, no overview value.
2. **Navigation is meaningless** — "Home" and "Manage" carry no information; five pages each with their own app bar; you never know where you are.
3. **The flat all-lineups table** — the only other real pain. Notably, the user did **not** pick format authoring or import/manage/provision as bothers — those are fine as-is.

### Decisions

1. **Oversight is the heartbeat.** Recurring admin work during a tournament is monitoring lineups and cutoffs; setup (import, provision, format) happens rarely, before play. The console optimizes for oversight.
2. **Admin home = a lean oversight dashboard.** Just a submitted/not-submitted indicator per lineup, organized by team match, sorted ascending by scheduled time then table number, with filters for completed / not-completed and past-cutoff. The research's richer menu (urgency ladder, invalidated-first, activity, progress) was explicitly declined — minimalism chosen.
3. **Phase-based information architecture with location awareness.** Pre-tournament setup tasks — importing, tournament management (rename/start-date/delete), authoring the team-match format, provisioning managers — group together; lineup oversight is a separate area. You always know where you are.
4. **Landing is setup-aware.** Oversight dashboard when an active tournament exists; setup (import/create) when none does.
5. **The all-lineups view is grouped by team match** — ascending by scheduled time, then table number — with group and round shown as metadata where available.
6. **Chasing is visibility-only.** The action-needed signal tells the admin who to chase; no in-app nudges or automated reminders in this spec.

### Facts established (from code, not asked of the user)

- `ties.table_label` already exists (nullable text, `supabase/migrations/0001_init.sql:31`) — "table number" is available today.
- **Group and round do not exist** in the data model. Showing them requires new team-match metadata sourced from the organizer tool's seed — the spec may require it; enacting it is implementation work outside this map.
- "Completed" filter is read as *both teams' lineups submitted* (not "match played") — confirm this reading when the design is reviewed.

### Consequences on the map

Fog graduates into [Prototype the admin shell and phase-based navigation](06-admin-shell-navigation-prototype.md) (unblocked) and [Prototype the oversight dashboard and grouped lineups view](07-oversight-dashboard-prototype.md) (blocked by [Settle the user-facing status vocabulary](05-user-facing-status-vocabulary.md) and the shell). The format-authoring fog item is deleted — the user says the form is fine, and invalidation visibility is handled by the vocabulary and dashboard decisions. Onboarding/empty states fold into the shell prototype (setup-aware landing is already decided).
