# 11 · Contract doc + parser v2

Type: task
Status: resolved
Repo: lineup-manager
Blocked by: —
Branch: `feat/11-contract-parser-v2` (commit 89430c2; the tournament-manager guard flip landed there as c342453 on feat/10-seed-v2-export)

## Scope

Spec §3: update `docs/seed-contract.md` + `seed-contract.schema.json` + `src/domain/seed.ts` together. Parser accepts **v2 only** (clean rejection with re-export hint); KO tie kinds (pool / later-round with `fedBy`), `brackets[]` structure; invariants: `teamIds` xor `fedBy`, KO ties carry `round` never `group`, labels from the fixed set, `fedBy` resolves same-category strictly-earlier, wiring matches `brackets[]`. Unit tests for every invariant incl. worked example (6 qualifiers → 2 pool matches, 4 QF slots).

## Answer

Done 2026-08-19, TDD (43 parser tests). `SUPPORTED_SEED_VERSION = 2`; v1 rejected with the re-export hint. SeedTie union (group/pool/fed) + SeedBracket types. Invariants enforced: XOR, KO labels from R256…F + required table, group/round required on team ties, brackets halve, entry round declares no feeds, feed targets are real previous-round slots, pool ties belong to the entry round, fed ties sit at positional ids with wiring cross-checked against brackets[]. Contract doc + JSON schema rewritten to v2 in lockstep. The tournament-manager conformance guard (real-parser gate) flipped back to "parses cleanly" — green both repos. Suite 196→208 tests green through the ticket; vue-tsc clean.
