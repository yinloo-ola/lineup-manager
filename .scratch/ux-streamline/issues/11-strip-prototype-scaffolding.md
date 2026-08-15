# 11 — Strip the prototype scaffolding

**What to build:** The branch `feat/ux-streamline` carries dev-only prototype routes and views (throwaway, never for merge) that served the shell and dashboard decisions. Remove them so implementation starts from a clean tree; the decisions they encoded live in the spec (`.scratch/ux-streamline/spec.md`) and the code stays recoverable in the branch's history. The dev server and type-check stay green with the routes gone.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Dev-only prototype routes and all prototype-only view/component files are deleted; no dead imports remain
- [ ] `npm run type-check` and `npm run test:run` pass
- [ ] The tracker docs (map, tickets, spec) are untouched by the removal
