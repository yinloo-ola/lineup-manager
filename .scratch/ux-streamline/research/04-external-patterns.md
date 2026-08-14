# External UX patterns for deadline-driven lineup submission — findings

Research ticket: [issues/04-external-lineup-ux-patterns.md](../issues/04-external-lineup-ux-patterns.md)
Date: 2026-08-14. Method: web survey against first-party sources (help centers, product pages, official federation docs) for TeamSnap, Spond, Heja, fantasy lineup builders (FPL, NFL, Yahoo, ESPN, CBS, Sleeper), TournamentSoftware, and table-tennis-specific platforms (click-TT/myTischtennis + nuScore, TT Leagues).

## 1. Team-management apps

### TeamSnap — schedule-first IA, two-stage draft→publish

**Information architecture.** Mobile home is a team switcher; inside a team, bottom-tab navigation (Schedule, Roster, Messages/Feed, Availability…). The Schedule tab is the primary surface; the lineup action is embedded in a scheduled game, not on a dashboard: team → Schedule tab → tap the game → "+ Add" → "Lineup" ([create a game-day roster lineup](https://helpme.teamsnap.com/article/231-create-a-game-day-roster-lineup), [TeamSnap ONE roster navigation](https://help.teamsnap.com/article/2006-viewing-your-teams-roster-on-teamsnap-one), [coach setup](https://www.teamsnap.com/teams/coach-setup)). Organizations can customize which tabs appear ([Manage Tabs](https://helpme.teamsnap.com/article/917-manage-tabs-in-organization-settings)).

**Submission flow + confirmation.** Two-stage: select players (filterable by availability status: All Players / All Going / All Maybe / All Not Going / All Unknown) → Next → **Save** → then an explicit **Publish** or **Not Now** decision. Until published, the lineup is visible only to admins; publishing sends members a push notification. A deferred lineup can be published later via a "Publish Lineup" button at the top of the list. (Same help article.)

**Deadline/urgency.** No lineup deadline exists; the closest mechanism is **availability locking**: team owners/managers set "the number of hours prior to your games or events" after which members can no longer change their submitted availability, so lineups can be finalized without last-minute flips ([availability lock how-to](https://www.teamsnap.com/blog/how-to/availability-tips-how-to-lock-changes-and-track-attendance), [availability features](https://www.teamsnap.com/blog/new-features/new-availability-features-and-more)).

**Validation.** Minimal and advisory: availability status is a filter, not a constraint — "roster members do not have to indicate availability to be included in a lineup."

**Mobile-first.** Strongly: the lineup feature is mobile-app-only — "Not available on the web app."

### Spond — event-centric, RSVP deadlines with automated chasing

**Information architecture.** Everything hangs off events: "single events, repeating events, season planner, and time poll events" ([spond.com](https://www.spond.com/en-us/)); match events carry the lineup ([line-up feature announcement](https://www.spond.com/news-and-blog/introducing-the-new-spond-line-up-feature/), [App Store](https://apps.apple.com/us/app/spond/id755596884)).

**Deadline/urgency.** Events have response deadlines, and the system — not the organizer — does the chasing: an automatic reminder goes to everyone who hasn't responded, either **48 hours after the invitation is sent or 48 hours before the event starts** ([Features in events — Spond help](https://help.spond.com/app/en/articles/129730-features-in-events), [invites & reminders product page](https://www.spond.com/en-us/invites-reminders/), [blog](https://www.spond.com/news-and-blog/invites-and-reminders-spond-app/)).

**Submission flow + status after.** Coaches "select players for each position with just a few taps"; the lineup is shared in-app with players, and "last-minute changes to the line-up instantly notify the team." There is **no lock or cutoff on the lineup itself** — the lineup is coach-owned and continuously editable, with every change re-announced. Availability is the input (coaches "can see which players are available … and plan their line-ups accordingly"), the lineup is the output.

### Heja — RSVP-centric, cutoff shown at the point of reply

**Information architecture.** Team schedule + team wall feed; availability RSVPs with automatic reminders ([App Store](https://apps.apple.com/us/app/heja/id1157335714), [heja.io](https://heja.io/)).

**Deadline/urgency.** Paid tiers let admins "set attendee and time limits for activities," and crucially: **"Members will see slots available and a cutoff time for replying"** — the deadline is rendered right where the member takes the action ([Heja Pro/Pro Max features](https://help.heja.io/en/articles/4358964-team-pro-pro-max-features)). Admins can also send instant reminders to players who haven't RSVP'd, and get RSVP update alerts.

## 2. Fantasy-sport lineup builders

### Deadline machinery (the richest source of cutoff UX)

- **Granular lock semantics as a setting.** CBS offers lock modes: 5 minutes before each player's gametime, at the first game of the week, etc. ([CBS lineup deadline options](https://help.football.cbssports.com/s/article/What-are-the-available-options-for-the-lineup-deadlines)). Yahoo default: players lock "at the start of the player's real-life game"; weekly-roster leagues lock at the first game of the designated day ([Yahoo transaction and lineup deadlines](https://help.yahoo.com/kb/transaction-lineup-deadlines-yahoo-fantasy-sln6775.html)). ESPN equivalent ([Lineup and Roster Lock Times](https://support.espn.com/hc/en-us/articles/360000088011-Lineup-and-Roster-Lock-Times)). The authority (commissioner) sets lock rules; individuals set their own notification preferences ([ESPN Fantasy App and Alerts](https://support.espn.com/hc/en-us/articles/47079238819092-ESPN-Fantasy-App-and-Alerts)).
- **Opt-in deadline reminders across channels.** FPL: push (More → myPL Settings → Notifications → "Deadline reminders"), email (pre-deadline Friday newsletter), and a calendar feed that "updates automatically" when a deadline changes ([official opt-in guide](https://www.premierleague.com/en/news/4490908/dont-miss-fpl-deadlines-how-to-opt-in-for-reminders)). The gameweek deadline is the app's central clock; community demand for countdown widgets (missing deadlines late-season is the recurring pain) shows the countdown itself is the feature users want ([r/FantasyPL deadline widget](https://www.reddit.com/r/FantasyPL/comments/wlqjlo/deadline_widget/)).
- **Locked-state UX.** Once locked, players become immovable (no move/add/drop/trade for that spot); Yahoo shows the per-player lock time next to the opponent in the lineup view. Lock granularity (per-player vs whole lineup) is a first-class league setting.

### Submission flow — two philosophies

- **Explicit submit (legacy desktop):** NFL Fantasy desktop requires the blue **SUBMIT** button to save all moves ([Setting Your Lineup](https://support.nfl.com/hc/en-us/articles/35869679382420-Setting-Your-Lineup)).
- **Continuous autosave (modern mobile):** the NFL app "now saves automatically"; FPL squad changes save as you make them. The industry has been migrating desktop → autosave, but the submit act survives where a *commitment* is being made (publishing to others, locking a competition entry).

### Validation and friction handling

- Constraints are enforced **at selection time and block the save**, with the message naming the violated rule: FPL blocks saving any squad that exceeds £100m, breaks the 2 GK / 5 DEF / 5 MID / 3 FWD formation, or takes more than 3 players from one club ([FPL basics](https://www.premierleague.com/en/news/2174419/fpl-basics-how-to-pick-a-squad), [FPL help](https://fantasy.premierleague.com/en/help)). NFL: "You can only start as many players as your league settings allow and only in the positions in which each player is designated."
- Empty roster spots are warned about before lock (Yahoo/NFL "fill those empty spots" flows); the incomplete-lineup state is surfaced, not silently accepted.
- **Invalidation precedent directly analogous to our format footgun:** NFL warns commissioners that roster positions may only be **added**, not removed, after the draft — "removing positions after rosters are filled could invalidate rosters" ([Setting Your Lineup](https://support.nfl.com/hc/en-us/articles/35869679382420-Setting-Your-Lineup)). Upstream format changes that would break submitted artifacts are restricted at the source.

## 3. Tournament platforms (racket sports)

### TournamentSoftware

- **Admin-set hard deadlines that disable the entry surface.** "If this date is on or before the current date online entry is disabled on the website" — the Final Entry Date doesn't nag, it switches the form off ([How to Publish](https://www.tournamentsoftware.com/product/article.aspx?s=2&id=2B955FEA-DCC1-4C5C-A2E3-52628A261AAB)). Admins also set which days players may enter availability online.
- **Lineup submission deadlines are usually tournament rules, not platform features.** Representative convention from a badminton team event: "Team Captains must submit their line up (5 players per game) 10 minutes prior to the ties — teams will not be allowed to view the other team's line up" ([Badminton BC event page](https://www.badmintonbc.com/calendarevent/79908/Wings-101-Badminton-Team-Tournament)) — i.e. **sealed lineups**: a hard pre-tie cutoff plus mutual secrecy until the exchange.

## 4. Table-tennis-specific platforms

### click-TT / myTischtennis + nuScore (DTTB, Germany)

- Captains (Mannschaftsführer) get per-fixture **game codes and PINs** in their personal click-TT area; nuScore is the DTTB web app replacing the paper match report ([DTTB portal](https://dttb.click-tt.de/), [WTTV nuScore page](https://nrw-tischtennis.de/archive/digitaler-spielbericht/), [nuScore Anleitung PDF](https://www.tischtennis.de/fileadmin/images_articles/01_SpielerTrainerSchiedsrichterFunktionaereMitarbeiter/02_Ligen/nuScore_Anleitung.pdf)).
- **Venue-mobile, offline-tolerant flow:** download the report before the match; internet is "needed only twice — when downloading the report and when uploading the final result"; poor hall connectivity doesn't block scoring ([WTTV](https://nrw-tischtennis.de/archive/digitaler-spielbericht/)).
- **Dual confirmation:** both team captains confirm the report with a one-time code valid only for that specific team match — the paper signature's digital equivalent.
- **Inline rule validation:** the app provides built-in hints "to avoid incorrect lineups, match valuations, or penalty fines."
- Deadlines come from association regulations (Wettspielordnung), not the software ([DTTB Wettspielordnung](https://www.tischtennis.de/fileadmin/documents/Satzungen_Ordnungen/2026/Stand_01.07.2026/03_WO__Gueltig_ab_01.07.26___30.3.2026__Reinfassung.pdf)).

### TT Leagues (Table Tennis England)

- Captains sign in to their league site, find the fixture, click **"Enter Score"**, then select home/away players in team-sheet order and submit ([Wilmslow how-to](https://wilmslow.ttleagues.com/page/howtoenterascorecard), [TT Leagues help centre](https://tabletennisengland.zendesk.com/hc/en-gb/categories/4409797351570-TT-Leagues), [TT Leagues overview](https://www.tabletennisengland.co.uk/leagues-and-counties/tt-leagues/), [mobile app](https://play.google.com/store/apps/details?id=com.ttleagues.tabletennisengland)). Pre-match selection is commonly still paper; the platform is result-entry-first rather than lineup-deadline-first.

## 5. Recurring patterns (synthesis across all surveyed products)

1. **Fixture/event-first IA with the action embedded in the fixture.** TeamSnap (Schedule tab → game → actions), Spond (event → lineup), TT Leagues (fixture → "Enter Score"), fantasy (matchup → lineup). No surveyed product front-pages the submission form; the fixture row is the anchor and the deadline travels with it.
2. **Two-stage draft → explicit publish/submit → notification.** TeamSnap's Save-then-Publish with an admin-only unpublished state; NFL desktop SUBMIT; nuScore's dual one-time-code confirmation. The explicit act marks the commitment; the notification closes the loop.
3. **Deadline = hard lock with escalating urgency.** Fantasy per-player/lineup locks at gametime; TeamSnap availability lock N hours before the event; TournamentSoftware Final Entry Date disabling entry; Heja cutoff shown at the point of reply; Spond auto-reminder 48h before; FPL countdown + opt-in push/email/calendar. The urgency ladder: ambient persistent clock → in-app escalation → opt-in push.
4. **Post-submission status is a first-class visible state.** Published lineup pinned to the game (TeamSnap, republishable), locked-but-visible lineups (fantasy), always-editable-with-reannounce (Spond). Editability after publish is a deliberate product decision tied to whether an authority enforces the cutoff.
5. **Validation is inline during selection; hard blocks name the broken rule.** FPL budget/formation/club limits with errors naming the constraint; NFL position limits; nuScore rule hints preventing invalid lineups; empty-spot warnings. Advisory signals (availability filters) are kept distinct from enforced constraints.
6. **Upstream format changes are guarded to protect submitted artifacts.** NFL's add-not-remove rule for roster positions post-draft exists precisely because removal "could invalidate rosters."
7. **The system chases, not the admin.** Spond/Heja automated reminders to non-responders shift the burden of nagging from the organizer to the product; admin surfaces focus on who-hasn't-acted.
8. **Mobile-first at the venue, offline-tolerant.** TeamSnap lineup is app-only; nuScore is designed around phone use in halls with bad reception; Spond/Heja are app-first products.

## 6. Most worth stealing for this app (manager submits under cutoff; single admin oversees)

1. **Fixture-anchored manager home with status chips.** A manager landing on "my team's upcoming ties," each row carrying deadline countdown + status (Not started / Draft / Submitted / Needs attention), single tap into the builder. This is the universal IA of every surveyed product and fits this app's one-tie-one-deadline reality.
2. **Draft autosave + one deliberate Submit with confirmation and a locked "Submitted" state.** TeamSnap's publish model and nuScore's dual confirmation, adapted: drafts save freely; submit is explicit with a summary; after submit the tie shows a readonly lineup + timestamp, and any post-submit change is its own visible act (amend/recall), never silent.
3. **Deadline urgency ladder + admin nudge.** Heja's "cutoff visible at the point of action" everywhere the tie appears, Spond's 48h-before reminder cadence, and the admin-side mirror: an action-needed view of ties without submissions as the cutoff nears, with one-click nudge. Directly serves the single-administrator role.
4. **Inline validation that names the broken rule, blocking only at submit.** FPL/nuScore pattern: live per-rubber completion and constraint status while drafting; Submit disabled with a specific reason ("Rubber 4 unfilled", "Player used twice"); errors always name the violated constraint.
5. **Guard the format→lineup dependency (the NFL add-not-remove precedent).** Tie-format edits that would invalidate already-submitted lineups should be blocked or warned with an impact preview ("this change invalidates 3 submitted lineups") before saving — the same protection NFL applies to roster positions after rosters fill. Addresses this app's known format-invalidation footgun.

Cross-cutting: assume **mobile-first, venue-context submission** (TeamSnap app-only lineups, nuScore offline tolerance) — the builder should be one-thumb usable on a phone at the hall, with tolerance for flaky connectivity.
