# 11 · Contract doc + parser v2

Type: task
Status: open
Repo: lineup-manager
Blocked by: —

## Scope

Spec §3: update `docs/seed-contract.md` + `seed-contract.schema.json` + `src/domain/seed.ts` together. Parser accepts **v2 only** (clean rejection with re-export hint); KO tie kinds (pool / later-round with `fedBy`), `brackets[]` structure; invariants: `teamIds` xor `fedBy`, KO ties carry `round` never `group`, labels from the fixed set, `fedBy` resolves same-category strictly-earlier, wiring matches `brackets[]`. Unit tests for every invariant incl. worked example (6 qualifiers → 2 pool matches, 4 QF slots).
