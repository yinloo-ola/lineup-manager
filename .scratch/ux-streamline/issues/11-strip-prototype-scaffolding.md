# 11 — Strip the prototype scaffolding

**What to build:** The branch `feat/ux-streamline` carries dev-only prototype routes and views (throwaway, never for merge) that served the shell and dashboard decisions. Remove them so implementation starts from a clean tree; the decisions they encoded live in the spec (`.scratch/ux-streamline/spec.md`) and the code stays recoverable in the branch's history. The dev server and type-check stay green with the routes gone.

**Blocked by:** None — can start immediately.

**Status:** done (2026-08-15)

- [x] Dev-only prototype routes and all prototype-only view/component files are deleted; no dead imports remain
- [x] `npm run type-check` and `npm run test:run` pass
- [x] The tracker docs (map, tickets, spec) are untouched by the removal

## Evidence

Commit `5aabdd6` — 14 prototype files deleted, dev-only route block removed from the router (1099 deletions, 0 insertions). Grep across `src/`, `e2e/`, config: zero remaining references. Type-check clean; 127/127 unit tests pass. Two-axis review (standards + spec) approved with no violations; its follow-up — a dangling "prototype's renError rule" comment in `src/domain/__tests__/tournamentManage.test.ts` — fixed in `5f3201f` (tests re-run, 127/127). Prototype code remains recoverable from branch history (`4fbab98`..`b0e7175`) as the spec's visual reference.
