# Design: venue-ux

## At a glance

At a real event with hundreds of team matches, the umpire console and the Matches dashboard render one endless table: no visual hierarchy, no sense of what is live now, and finished or blocked matches never leave the screen. This topic re-themes the whole app (light + dark, a proper token set) and rebuilds the two venue surfaces as timeslot-organized match cards with a working window — current timeslot plus the next two — everything else shelving into a collapsible panel that search and filters still reach. A 20-second poll keeps both surfaces fresh without manual reloads. Presentation only: no schema, no new dependencies, every existing flow preserved.

**Key decisions**
- Card grid grouped by timeslot, sorted time-then-table — validated by the approved interactive mockup. `(rejected: keep the v-table model — infinite scrolling was the user's core complaint)`
- Timeslots derived from the data by clustering distinct `scheduled_start` values (new slot when the gap exceeds 30 minutes) — real slot grids are 1h, 2h, or 2.5h depending on the event, and referee edits shift individual matches by minutes. `(rejected: fixed hour buckets — wrong for variable slot durations)`
- 20s polling of the existing load functions. `(rejected: Supabase realtime — new infrastructure for freshness a venue does not need)`
- Vuetify named themes (`tt-light`/`tt-dark`) from one token file; a toggle in the app bar and umpire console header, persisted to localStorage. `(rejected: replacing Vuetify or hand-rolled CSS — churn with no product gain)`
- The shelf is a client-side classification of already-loaded rows. `(rejected: a server-side window parameter — the shelf must stay searchable/filterable, so the client needs every row anyway)`

| R# | Requirement in one line | Risk |
|----|------------------------|------|
| R1 | Dual theme (light/dark) with an app-wide toggle that persists | |
| R2 | Timeslots derived from scheduled starts by gap clustering | |
| R3 | Working window = current timeslot + next two, with a show-all escape | |
| R4 | Umpire console renders match cards grouped by timeslot | |
| R5 | Shelved panel: collapsible, counted, fully reachable by filter and search | |
| R6 | Matches dashboard renders the same card model with admin extras | |
| R7 | Both surfaces refresh on a 20-second poll without losing state | |

## Requirements

### R1: Dual theme with persistent toggle

The app defines two Vuetify themes — `tt-light` (default) and `tt-dark` — from one token file (primary, surfaces, state colors, borders). A toggle in the admin shell app bar and on the umpire console header switches themes; the choice persists across reloads on every surface, including login.

**Acceptance criteria**
- Given the app on `tt-light`, When the user activates the theme toggle, Then every surface re-renders dark without a reload.
- Given dark mode active, When the app is reloaded (or a fresh page opened at /login), Then dark mode is still active.
- Given either theme, When any view renders, Then no view hardcodes colors that become unreadable in the other theme (contrast holds on both).

### Checkpoints: none
### Review: skip

### R2: Timeslot derivation from the schedule

The pure domain derives timeslots from the loaded team matches: distinct `scheduled_start` values sorted ascending, clustered so that a gap of more than 30 minutes starts a new slot. Each slot carries its earliest start as the label and its member matches.

**Acceptance criteria**
- Given matches at 09:00 and 09:20 (a referee shift), When slots are derived, Then both fall in one slot labelled 09:00.
- Given matches at 10:00, 12:00 and 14:30 across events (1h and 2.5h grids), When slots are derived, Then there are exactly three slots labelled 10:00, 12:00 and 14:30.
- Given two events with offset grids (09:00 and 09:30), When slots are derived, Then both times cluster into one slot so parallel play renders together.

### Checkpoints: none
### Review: skip

### R3: Working window with a show-all escape

The pure domain computes the working window from the derived slots and a `now` instant: the current slot is the latest slot whose start is at or before now; the window is that slot plus the next two. Team matches outside the window (earlier slots, later slots, other days) classify as shelved; matches inside it classify as retained. A show-all escape disables the window so every match renders.

**Acceptance criteria**
- Given slots at 09:00, 10:30, 13:30 and 16:00 and now = 11:20, When the window is computed, Then 10:30 is current and 13:30 and 16:00 are in-window; 09:00 is shelved.
- Given now before the first slot of the day, When the window is computed, Then the first slot is current (nothing is live yet) and later slots fill the window.
- Given now after the last slot, When the window is computed, Then the last slot is current and everything earlier is shelved.
- Given matches scheduled on another day, When the window is computed, Then they are shelved regardless of their time.
- Given the show-all escape active, When the console renders, Then every slot section appears in time order with no shelving.

### Checkpoints: none
### Review: skip

### R4: Umpire console match cards

The umpire console renders matches as cards in a responsive grid (3-up on tablet, 1-up on phone), grouped under their timeslot heading, sorted by time then table. Each card shows table, time, team event, both teams, and a state: ready (primary "Enter results" button), decided-in-window (dimmed, green state chip with the match tally, e.g. 3–1, and an edit affordance), or lineups-pending (amber chip). The event filter chips and search from the current console are preserved and apply to the card list.

**Acceptance criteria**
- Given the fixture tournament on the umpire console, When it renders, Then matches appear grouped by timeslot heading in time-then-table order with no duplicate rows.
- Given a ready team match, When its card renders, Then the Enter results button opens the existing entry dialog unchanged.
- Given a decided team match inside the current slot, When its card renders, Then it stays visible dimmed with its match tally and can be edited.
- Given the console on a 400px viewport, When it renders, Then cards stack to one column with nothing clipped and touch targets at least 44px tall.

### Checkpoints: none
### Review: skip

### R5: Shelved panel

Below the window, a collapsible panel shows the shelved match count; expanding it reveals the shelved matches grouped by their timeslots in time order. The panel is a labelled disclosure (aria-expanded), and the event filter and search apply to shelved matches exactly as to windowed ones.

**Acceptance criteria**
- Given shelved matches exist, When the console renders, Then the collapsed panel shows the count and no shelved match cards are visible.
- Given the panel expanded, When it renders, Then shelved matches appear grouped by timeslot in time order.
- Given a search term matching only a shelved match, When typed, Then the count and panel contents reflect the filter, and the match is reachable without clearing the window.

### Checkpoints: none
### Review: skip

### R6: Matches dashboard cards

The Matches dashboard adopts the same timeslot card model. Admin cards add per-side lineup state chips (submitted / not submitted / missed cutoff, with the Needs attention marker) and a Results button opening the existing admin results dialog; knockout rows keep their bracket link. The existing status filter (All / Not submitted / Submitted / Past cutoff) and the team event selector are preserved and apply across window and shelf.

**Acceptance criteria**
- Given the dashboard with the fixture tournament, When it renders, Then every admin card shows both sides' lineup state and the Results button, and knockout rows show the bracket link.
- Given a status filter active, When applied, Then it filters cards in the window and the shelf identically to the current table.
- Given a decided team match, When the admin opens Results from a shelved card, Then the existing dialog opens and an override recomputes the derived winner.

### Checkpoints: none
### Review: skip

### R7: Live polling

Both surfaces re-run their existing load functions every 20 seconds while the tab is visible, keeping scroll position and the shelf's expanded state; polling pauses when the tab is hidden. A failed poll keeps the last good data on screen; only a first-load failure surfaces the error alert.

**Acceptance criteria**
- Given a lineups-pending card in the window, When the second side submits a lineup, Then within one 20-second poll the card flips to ready without a reload.
- Given polling active, When the tab is hidden and resurfaced, Then no poll fires while hidden and the data refreshes on return.
- Given the backend unreachable mid-session, When a poll fails, Then the console keeps rendering the last good data and recovers on a later successful poll.

### Checkpoints: none
### Review: skip

## Approaches considered

- **Card grid per timeslot (chosen)** — validated in the approved mockup against the table model the user called out ("scroll and scroll").
- **Hour-bucketed timeslots (rejected)** — the human corrected: slot duration varies by event (1h, 2h, 2.5h); gap-clustering of distinct start times follows the data instead.
- **Supabase realtime (rejected)** — channels, auth integration and reconnection logic for freshness a venue does not need at 20s granularity; polling reuses existing loaders.
- **Server-side window/shelving (rejected)** — the shelf must remain searchable, so the client holds every row regardless; classifying client-side keeps the backend untouched.
- **Virtualization/pagination (rejected)** — with the window plus a collapsed shelf, the rendered set stays small at realistic scale (~100 team matches); revisit only if an event proves otherwise.

## Architecture

- `src/themes/tokens.ts` — the single token source (colors for light and dark); `src/plugins/vuetify.ts` builds the two named themes from it; `localStorage` key for the persisted choice; toggle via Vuetify's `useTheme` in the admin shell and umpire console.
- `src/domain/scheduleWindow.ts` — pure: `deriveSlots(ties)` (gap clustering, 30-minute threshold), `computeWindow(slots, now)` (current + next two, multi-day aware), `classify(rows)` returning windowed and shelved groups in time-then-table order (reusing `compareMatchRows`).
- `src/components/MatchCard.vue`, `SlotSection.vue`, `ShelvedPanel.vue` — presentational, props-driven, no data access; MatchCard carries an `admin` variant.
- `UmpireView.vue` / `MatchesView.vue` — swap `v-table` for the card composition; keep their existing loads, filters, and dialogs; add the poll loop and the window computation between load and render.
- Polling lives in a tiny composable (`usePolling.ts`) wrapping `setInterval` with visibility pause; no store changes.

## Data flow

Load (unchanged) → `deriveSlots` → `computeWindow(now)` → `classify` → sections render (window) and the ShelvedPanel (count always, cards when expanded) → every 20s the same load re-runs and the pipeline recomputes; nothing is cached between polls beyond the last good response.

## Error handling

- A device clock far from the schedule empties the window: the empty state offers "Show all matches" (the R3 escape) so a bad clock never locks an umpire out.
- Poll failures are silent (keep last good data); first-load failures keep today's error alert.
- The shelf disclosure is keyboard-operable with `aria-expanded`; state chips pair color with icon and text; cards keep visible focus rings in both themes.

## Testing

Red-first at the domain seam: slot clustering (referee jitter, mixed grids, offset parallel events), window edges (before first slot, mid-slot, between slots, after last slot, other-day matches), classification and sort stability, show-all escape. Component tests: MatchCard states (ready/decided/pending, admin extras), ShelvedPanel disclosure and count. E2E: console renders window sections and the shelf count from the existing fixtures; expand shows earlier slots; a search reaching only shelved matches surfaces them; theme toggle persists across reload; a lineup submission flips a card within one poll (Playwright's clock API fast-forwards the timer); 400px viewport stacks cards. **Feature acceptance** below is the primary enforced spec.

## Feature acceptance

- Given a tournament whose events author five-match team matches across four timeslots (09:00, 10:30, 13:30, 16:00 — 1h and 2.5h grids) and the device clock reads 11:20 on day one, When the umpire opens the console, Then the window shows exactly the 10:30, 13:30 and 16:00 slots as card sections in time-then-table order; decided team matches of the 10:30 slot stay visible dimmed with their match tally (e.g. 3–1); the 09:00 slot and all day-two matches appear only under Shelved with the count; and expanding the panel lists them, still filtered by the active event and search.
- Given a lineups-pending team match inside the window, When the second side's manager submits a lineup, Then within one 20-second poll the card flips to ready with its Enter results button, without a reload.
- Given the theme toggled to dark, When the app is reloaded, Then every surface including login renders dark.

### Feature review: auto
