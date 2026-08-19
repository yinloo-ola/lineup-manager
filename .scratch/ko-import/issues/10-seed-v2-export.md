# 10 · Seed v2 export

Type: task
Status: resolved
Repo: tournament-manager
Blocked by: 09
Branch: `feat/10-seed-v2-export` (commit d6924ab, stacked on feat/09-generator-full-rounds)

## Scope

Spec §3–§4: `buildLineupSeed.ts` emits contract **v2** — first round as the **unplaced pool** (scheduled matches only, bye-adjusted count, no position), `brackets[]` carrying structure + feed wiring, later rounds as positional scheduled ties with `fedBy`; round labels keyed by **slot size** from the fixed set R256…F (table gains R256); drop the both-teams skip for KO ties; `SEED_VERSION = 2`. Export tests treat `docs/seed-contract.md` (updated in ticket 11) as reference — coordinate lockstep.

## Answer

Done 2026-08-19, TDD. `SeedTie` is now a union (GroupSeedTie / KnockoutPoolTie / KnockoutFedTie); `SeedFile.brackets?` carries per-category round labels, slot counts, and feed wiring with positional slot ids (bye slots included). Pool ids = `category|ko|LABEL|table|time`; later-round ids = `category|ko|LABEL|n`. Labels keyed off `KnockoutRound.round` (slot size), R256 added. Fail-loudly guards added on review: non-halving brackets (was silently emitting undefined feeds) and scheduled KO matches without a table (duplicate-id hole). Golden bumped to seedVersion 2 (fixture is group-only — v2 KO shapes are pinned by exact-shape unit tests). The live conformance guard (real lineup-manager parser) now asserts the **version-gate rejection** until ticket 11 lands the v2 consumer, then flips back to "parses cleanly" — the deliberate lockstep cutover. Full suite 330 passed, vue-tsc clean. Two-axis review applied (structure guard, table requirement, feeder-pair dedup, stale v1 comments, semantically inconsistent R256 test fixed).
