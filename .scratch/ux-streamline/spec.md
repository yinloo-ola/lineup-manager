# Admin Console UX Spec — lineup-manager

Status: decision-complete (wayfinder map `ux-streamline`, closed 2026-08-15)
Scope: the **administrator console** only — import → provision → author format → oversee. The manager experience is explicitly out of scope and unchanged by this spec.
Traceability: every section cites its deciding ticket in `.scratch/ux-streamline/issues/`. Visual reference: the prototype commits on `feat/ux-streamline` (dev-only routes `/prototype/shell?variant=A` and `/prototype/matches?variant=A` — throwaway, **not for merge**).

## 1. Principles

Decision: [Confirm the destination and scope](issues/01-confirm-destination-and-scope.md)

- **Oversight is the heartbeat.** Recurring admin work during a tournament is monitoring lineups and cutoffs; setup happens rarely, before play. The console optimizes for the Matches dashboard.
- **Structural change is sanctioned** — this is a re-shell, not a relabel.
- **On-screen language is the ubiquitous language** (`CONTEXT.md`): Team Match, Match, Team Match Format, Team Event, Team Manager. Code identifiers stay `Tie`/`Rubber`/`TieFormat` (sanctioned legacy mapping).
- The stale scaffold home and the per-page app bars die; "Home" and "Manage" as labels die.

## 2. On-screen vocabulary

Decisions: [Settle the user-facing status vocabulary](issues/05-user-facing-status-vocabulary.md), [Prototype the oversight dashboard and grouped lineups view](issues/07-oversight-dashboard-prototype.md) (Missed cutoff), [Prototype the admin shell and phase-based navigation](issues/06-admin-shell-navigation-prototype.md) (import wording)

| On screen | Meaning |
|---|---|
| **Submitted / Not submitted** | The binary lineup state everywhere outside the builder. Drafting nuance is builder-internal. |
| **Needs attention** | Rare marker: a confirmed pre-start format edit broke a submitted lineup; reads Not submitted + marker until corrected and re-submitted. |
| **Locked** | Match-level chip: this team match is past its cutoff. Not a lineup status. |
| **Missed cutoff** | The urgent case: a lineup still missing after the cutoff passed. Error-styled, alert icon, red row/card. The admin's cue to chase the manager or fill the lineup on behalf. |
| **Import tournament…** | The create action, always worded this way on screen. Never "import seed" — "seed" is the internal term for the organizer-tool JSON only. |

Reserved: **completed / complete / incomplete** belong to the future match-results feature and never describe lineup states. Filters are worded Submitted / Not submitted / Past cutoff. `CONTEXT.md` (Lineup Status) is the canonical entry.

## 3. The shell

Decision: [Prototype the admin shell and phase-based navigation](issues/06-admin-shell-navigation-prototype.md) — verdict: variant A, flat rail, nothing collapsed.

- **Left navigation rail (~230px), two groups:**
  - **Tournament** → **Matches** — the primary entry, colored when active, icon-labeled. The dashboard is the landing surface.
  - **Tournament setup** → three entries **directly in the rail, one click each** (explicitly *not* collapsed behind a Setup page or tabs): **Tournament settings**, **Team match formats**, **Provision managers**. Styled subordinate (smaller text, subdued color) so they don't compete with Matches.
- **Format freeze affordance:** the Team match formats rail entry carries a lock icon once the tournament has started.
- **App bar:** location title (Matches / the current setup section) beside the active tournament's name; the global tournament selector; sign out. The admin always knows where they are and which tournament they're in.
- **Setup-aware landing:** Matches when a tournament exists; the setup/empty state when none does.
- **Empty / first-run state:** "No tournament yet" — copy explains that importing creates the first tournament with its team events, teams, and team matches; primary CTA **Import tournament**.

## 4. Tournament selector and import

Decisions: [Prototype the admin shell and phase-based navigation](issues/06-admin-shell-navigation-prototype.md) (placement, wording, scaling refinement)

- The selector owns **switching and creation both**. Setup items act *on the selected tournament*; import *creates a new one* — that separation is why import is not a setup page.
- **Default menu: Active & upcoming only**, newest-first, start-date subtitle per entry, plus a muted non-clickable hint *"Type to search past tournaments"*. **Past tournaments surface only while searching**, under a "Past" header. (The list only grows — past tournaments are never deleted; their lineups stay viewable.)
- Trailing entry **"Import tournament…"** opens a dialog: file input ("Tournament file"), copy explaining import-is-create (each import creates one more tournament, with team events, teams, players, team matches, and each team's manager email) and what follows (author formats → provision managers, emails pre-filled from the import).
- Existing import behavior retained: parse errors are framed ("Invalid seed: …"); a name clash blocks and offers rename before creating.

## 5. The Matches dashboard

Decision: [Prototype the oversight dashboard and grouped lineups view](issues/07-oversight-dashboard-prototype.md) — verdict: variant A, the fixture table.

- **One row per team match**, sorted ascending by scheduled time, then table number. Columns: Scheduled (calm **Locked** outlined chip on cutoff-passed matches) · Table · Group · Round (shown **where available** — seed-sourced metadata; omitted when absent) · each team with its lineup status chip inline.
- **Missed cutoff** (lineup missing past cutoff): error chip with alert icon **and a red-tinted row** — immediately identifiable; the admin acts (chase or fill on behalf), never scrolls past it.
- **Filters:** All / Not submitted / Submitted / Past cutoff (toggle above the table).
- **Drill-in** (row click → dialog): both teams' lineups side by side — team name, status chip (+ Needs attention), player list; metadata line (group · round · table · scheduled). Per team an on-behalf action: **"Edit on behalf"** normally; **"Fill lineup on behalf"** (error-toned, with an alert stating the two actions) for a missed-cutoff team. Opens the lineup builder as that team (`?team=`) — the admin's escape hatch.
- **Chasing is visibility-only.** The indicator is the whole story; no in-app nudges, reminders, or automated chasers anywhere in this spec.

## 6. Team match format: freeze and guarded edits

Decision: [Settle the user-facing status vocabulary](issues/05-user-facing-status-vocabulary.md)

- **Freeze:** formats cannot be amended once the tournament has started. Anchor: `tournaments.start_date` (exists, nullable — becomes required for a running tournament). The authoring page shows a frozen/disabled state with its reason; the rail entry carries the lock icon.
- **Guarded pre-start edit:** a format save that would break submitted lineups first shows an **impact preview** (affected team matches and lineups) and requires explicit confirmation. No silent invalidation. Confirmed breaks surface downstream as **Needs attention**.

## 7. Setup sections

Decisions: [Admin console walkthrough](issues/03-admin-console-walkthrough.md), [Prototype the admin shell and phase-based navigation](issues/06-admin-shell-navigation-prototype.md)

- **Tournament settings** — for the *selected* tournament: rename, start date, delete. The selector owns switching; this page owns managing the selected one. (No tournament list here — that was the "weird" the user rejected.)
- **Team match formats** — authoring flow is fine as-is (walkthrough verdict); gains only the freeze/guard behavior of §6.
- **Provision managers** — manager accounts per team. With seed v1, **emails arrive pre-filled from the import** (one per team); provisioning confirms/activates them rather than the admin typing. Per-manager state visible (e.g. active · must change password · not provisioned yet).

## 8. Seed contract v1

Decision: [Specify the seed contract with the organizer tool](issues/08-seed-contract-with-organizer-tool.md). Producer: `tournament-manager` (`buildLineupSeed.ts`); consumer: this repo (`src/domain/seed.ts`). Canonical doc to be written at `docs/seed-contract.md` + JSON Schema in this repo (consumer-owned); the producer repo's tests link to it.

| Field | Shape | Required | Notes |
|---|---|---|---|
| `seedVersion` | integer, `1` | yes | Parser rejects unknown versions with a clear message. |
| `tournamentName` | string | yes | Unchanged. |
| `startDate` | ISO date | optional | From the organizer's `startTime` when set. **Auto-filled at import from the earliest `scheduledStart`**; editable in Tournament settings. Keys the format freeze and the selector's Upcoming/Active split. "When past?" stays this app's business (no end date in the organizer model). |
| `categories[]` | `{id,name,shortName}` | yes | Unchanged. |
| `teams[]` | `{id,name,club?,managerEmail}` | `managerEmail` **required** | Import fails naming the team when missing; basic email shape + **uniqueness across teams** enforced at parse (a Team Manager has exactly one team). Organizer must add email capture to its entry flow. |
| `players[]` | `{id,teamId,name,gender,dateOfBirth}` | yes | Unchanged (Excel-serial dates still normalized). |
| `ties[]` | `{id,categoryId,scheduledStart,table?,teamIds[2],group?,round?}` | `group`/`round` optional | Human-label strings (not indices); knockout ties have no group. Dashboard shows them where present. |

Global-id PKs on teams/categories/ties are deliberate (ADR 0001) — the contract never "fixes" them.

## 9. Cross-app terminology

Decision: [Must the console's patterns stay consistent with tournament-manager?](issues/09-cross-app-consistency-with-organizer.md)

- **Terminology-only consistency** with the organizer's `tournament-manager` app: one on-screen vocabulary and consistent meanings for shared entities; visual patterns, navigation, and components stay per-app (the UI systems already fully diverge — organizer is custom widget/CSS, this app is Vuetify 3 — and that is accepted).
- **Team Match** is the agreed word for the fixture in both apps. Follow-up in the organizer repo (not enacted here): its glossary and UI adopt Team Match on screen (today they say the opposite: "Tie, avoid: team match").
- The seed contract (§8) is the only other coupling.

## 10. Out of scope / future

From the map's Out of scope: match results and team-match completion ("completed" vocabulary waits for it); the manager experience; building the redesign (implementation tickets are sliced next); the organizer repo's own UX; visual branding/theme work; backend/data-model/RLS changes for their own sake (this spec *requires* some — below — but enacting them is implementation).

## 11. Implementation-enabling notes

Facts the slicing step must carry (decided here; enacted there):

- **Data model:** `tournaments.start_date` becomes required for a running tournament (§6). Group and round do not exist today — new seed-sourced team-match metadata (§5, §8).
- **Parser:** `seedVersion` gate; `managerEmail` shape + cross-team uniqueness; optional `startDate`; optional `ties[].group`/`round` (§8).
- **Import:** auto-fill start date from earliest `scheduledStart` when the seed omits `startDate` (§8).
- **Docs:** `docs/seed-contract.md` + JSON Schema, consumer-owned, versioned with `seedVersion` (§8).
- **Organizer repo follow-up:** email capture in the entry flow; Team Match on screen (§8, §9).
- External research base: `.scratch/ux-streamline/research/04-external-patterns.md` — the admin-relevant patterns that survived into decisions are the guarded format change and deadline visibility; the manager-side patterns (fixture-anchored home, one-thumb builder) are context only, superseded by scope.
