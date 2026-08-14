# Handoff — lineup-manager: UX streamline wayfinder map (ticket 06 in flight)

Date: 2026-08-15. Repo: `/Volumes/Ext/code/personal/lineup-manager` (branch `feat/ux-streamline`, created from `main`).

## What this is

A `/wayfinder` effort charting **Streamline the lineup-manager UX and usage flow**, scoped by the user to the **administrator console only**, destination = **decision-complete UX spec**. The canonical artifacts live in the repo and hold all decisions — do not restate them here:

- **Map (start here):** `.scratch/ux-streamline/map.md` — Destination, Notes, Decisions so far (tickets 01, 03, 04, 05 resolved), Not yet specified, Out of scope.
- **Tickets:** `.scratch/ux-streamline/issues/` — tracker conventions in `docs/agents/issue-tracker.md` ("Wayfinding operations": claim → resolve → `## Answer` → map's Decisions-so-far line).
- **Glossary:** root `CONTEXT.md` was updated this session (new **Lineup Status** entry; **Team Match Format** gained the freeze rule) — a tracked-file modification, **uncommitted**.

## Where things stand

**Ticket 06 — "Prototype the admin shell and phase-based navigation" — is CLAIMED and mid-flight.** A UI prototype (three structurally different shells: A left rail, B top tabs, C phase-mode launcher) is live in the real app at route `/prototype/shell`, switchable via `?variant=A|B|C`, floating bottom bar, and ← → keys. The dev server was started in the background (was on port **5176**; if dead, `npm run dev` and read the printed port). The user has it open in their in-app browser.

Files (all **untracked throwaway — never commit**): `src/views/PrototypeShellView.vue`, `src/views/prototype/*` (mock.ts, MockContent.vue, TournamentSelectStub.vue, VariantARail.vue, VariantBTabs.vue, VariantCPhaseModes.vue), plus a dev-only route block in `src/router/index.ts` (gated on `import.meta.env.DEV`).

Three rounds of user feedback are already folded into the prototype and recorded in ticket 06's `## Comments`:
1. Import seed **is** the create action; setup continues with formats → provisioning; the seed JSON should carry a **team-manager email per team**.
2. The setup tab lists tournaments → weird; now **Tournament settings for the selected tournament** (rename/start date/delete).
3. Import under a selected tournament → weird; moved to a trailing **"Import seed…" entry inside the tournament selector** (opens a dialog) — agent recommendation, awaiting the user's reaction.

## What to do next session

1. Invoke `/wayfinder` with `.scratch/ux-streamline/map.md` and ticket 06 — get the user's **verdict on A/B/C (or a mix)**, including whether the selector-creates-import placement feels right.
2. On verdict: resolve ticket 06 (Answer + `Status: resolved` + map Decisions line), then follow the prototype skill's capture rule — commit the full variant set to a **throwaway branch** (out of main), leave a context pointer on the ticket, and strip the route/prototype code from main (it is untracked today; keep it that way unless capturing).
3. Ticket 07 ("Prototype the oversight dashboard and grouped lineups view", blocked only by 06) unblocks next — same prototype pattern, constraints already written in its body.
4. After 07, remaining fog: **seed contract with the organizer tool** (manager email per team + group/round per team match) and **cross-app consistency** with the separate `tournament-manager` repo. Then the map closes: slice the spec into implementation tickets.

## Gotchas

- One ticket per wayfinder session (research subagents are the exception).
- Manager-side UX is deliberately out of scope; don't drift there.
- Vuetify app bars are `position: fixed` — don't place bare components as `v-layout` siblings (that was the variant-B invisible-tabs bug); use the app-bar `#extension` slot.
- Playwright role-locator clicks can time out on Vuetify bar transforms (actionability strictness); the node-path (`dom_cua`) click works — it's a test artifact, not a UI bug.
- `npm run type-check` after edits; AGENTS.md is authoritative for repo conventions (Supabase CLI via `npx -y`, `prototype/` untracked, etc.).

## Suggested skills

- `/wayfinder` — work through the map (ticket 06, then 07).
- `/prototype` — UI branch rules; capture-to-throwaway-branch on decision.
- `/grilling` + `/domain-modeling` — for any grilling ticket and glossary updates (CONTEXT.md is the glossary; update inline when terms resolve).
- `browser-use:control-browser` — verify prototype rendering; claim the user's open tab rather than duplicating.
- UX design lens the user asked this effort to learn from: https://github.com/szilu/ux-designer-skill (referenced in the map's Notes).
