# External UX patterns for deadline-driven lineup submission

Type: research
Status: resolved

## Question

How do comparable products structure the experience of "a team manager submitting a lineup / team sheet under a deadline"? Survey team-management and tournament platforms — e.g. TeamSnap, Spond, Heja, fantasy-sport lineup builders, TournamentSoftware, and any table-tennis-specific platforms — and extract the patterns that recur:

- Information architecture: dashboard-first? calendar-first? list of fixtures?
- How deadline and urgency are communicated as cutoff approaches.
- The submission flow itself and the confirmation after submit.
- Status communication after submission (locked, editable, invalidated).
- Validation and friction handling during selection.
- Mobile-first patterns, if the products clearly prioritize mobile.

Conclude with the 3–5 patterns most worth stealing for this app and why, given this app's two roles (team manager submitting; single administrator overseeing).

## Answer

Full findings with sources: [../research/04-external-patterns.md](../research/04-external-patterns.md)

Surveyed TeamSnap, Spond, Heja, the fantasy lineup builders (FPL, NFL, Yahoo, ESPN, CBS), TournamentSoftware, and table-tennis platforms (click-TT/myTischtennis + nuScore, TT Leagues). The patterns that recur everywhere: **(1) the fixture is the anchor, not a dashboard** — every product embeds the lineup action in the scheduled event row (TeamSnap Schedule tab → game → "Lineup"; Spond event → line-up; TT Leagues fixture → "Enter Score"), with the deadline traveling on that row; **(2) a two-stage draft → explicit publish/submit → notification** — TeamSnap saves an admin-only draft and then requires an explicit Publish that pushes a notification; nuScore confirms with dual one-time captain codes; **(3) deadlines are hard locks with an escalating urgency ladder** — Heja shows the cutoff at the point of reply, Spond auto-reminds 48h before the event, TournamentSoftware's Final Entry Date simply disables the entry form once passed, fantasy apps lock per-player at gametime and show locked players as immovable; **(4) submitted state is first-class and visible** (locked-but-readable, or editable-but-reannounced — a deliberate product decision); **(5) validation runs inline during selection, and hard blocks name the broken rule** (FPL's budget/formation/3-per-club errors; nuScore's built-in hints preventing invalid lineups); **(6) the system chases, not the organizer** — automated reminders to non-responders free the admin to just watch an action-needed list.

Most worth stealing for this app:

1. **Fixture-anchored manager home with status chips** — "my upcoming ties," each with deadline countdown + status (Not started / Draft / Submitted / Needs attention), one tap into the builder. The universal IA of every surveyed product, and it matches this app's one-tie-one-deadline reality better than any dashboard.
2. **Draft autosave + one deliberate Submit + a locked "Submitted" state** — TeamSnap's publish model adapted: drafts save freely, submit is explicit with a confirmation summary, and afterward the tie shows a readonly lineup with timestamp; any post-cutoff change is its own visible act, never silent. Gives both manager and admin an unambiguous tie state.
3. **Deadline urgency ladder + admin nudge view** — cutoff visible everywhere the tie appears, escalating in the final 48h/24h (Spond's proven cadence), plus the admin-side mirror: an action-needed list of unsubmitted ties near cutoff with one-click nudge. This is the single-administrator role's single most valuable screen.
4. **Inline validation that names the broken rule, blocking only at submit** — live per-rubber completion/constraint status while drafting; Submit disabled with a specific reason ("Rubber 4 unfilled"); errors name the violated constraint, never a generic failure.
5. **Guard the format→lineup dependency** — NFL Fantasy restricts roster positions to add-only after drafts because removal "could invalidate rosters"; this app should likewise block or warn on tie-format edits that would invalidate submitted lineups, with an impact preview before saving. Direct treatment for the known format-invalidation footgun.

Cross-cutting: TeamSnap's lineup tool is mobile-app-only and nuScore is built for phones in reception-poor halls — assume managers submit from a phone at the venue and keep the builder one-thumb and connectivity-tolerant.


## Comments

- **2026-08-14, scope note:** this research ran before [Confirm the destination and scope](01-confirm-destination-and-scope.md) settled, so the Answer's manager-side recommendations (fixture-anchored manager home, one-thumb builder) are context only — out of scope for this map. The admin-relevant patterns stand: the deadline urgency ladder on oversight surfaces, the admin nudge view of unsubmitted lineups, and the guarded format change with impact preview.
