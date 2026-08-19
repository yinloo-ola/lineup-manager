# 12 · Migration + domain types + import

Type: task
Status: resolved
Repo: lineup-manager
Blocked by: 11
Branch: `feat/12-migration-import` (commit 0bcf1c4, stacked on feat/11-contract-parser-v2)

## Scope

Spec §5: one additive migration (imperative style, comment header; re-run advisors) — nullable `team_a`/`team_b`/`scheduled_start`, `fed_by_a`/`fed_by_b` self-FKs, `winner_side` check, `is_knockout`, `placed_match_id` unique self-FK. Domain types: nullable sides, feeds, winner side, KO row kinds (slot / pool / later-round). `importSeed` writes all three KO kinds. Tighten lineup-write policies so a lineup's team occupies a side of the tie. Manager-read RLS unchanged (verify null-side invisibility). ADR 0002 addendum already records the amendment.

## Answer

Done 2026-08-19. Migration `0013_ko_bracket_ties.sql` applied to the local stack — advisors re-run, **zero ERROR findings** (one pre-existing WARN on `tournaments`, untouched). Policy tightening via security-definer `tie_has_team(tie_id, team_id)` (null-tolerant) on both lineup-write policies; the 0011 phantom-row tournament check preserved; manager reads untouched (null sides never match `manager_team_id()`). Domain `Tie`: nullable sides + `isKnockout`/`fedBy`/`winnerSide` (row kinds remain implicit field combinations — deliberate; the seed-level union carries the kind). `importSeed` mints bracket slot ids first (fed ties share their slot's minted id — guarded: any other collision throws), emits group/pool/fed rows plus structural slot rows for every bracket slot (bye slots included), feeds remapped through minted ids; tests cover shapes, sharing, and two-import disjointness. Null-safe read paths: `computeCutoff(null)→null`, `isLocked(null)→false`, TBD sides never read Missed-cutoff, unscheduled rows sort last, `sideDisplayName` centralizes the TBD rule, `fmt` null-tolerant in views. Suite 212 tests green (14 files), vue-tsc clean. Two-axis review applied (collision guard, TBD-rule helper, fed/pool branch collapse); deferred to 14/15 by the spec's slicing: byes off the dashboard (§7), e2e RLS lock-in (§8). Note: feed/placement FKs use `on delete set null` — safe under the tournament cascade, and it never orphans references.
