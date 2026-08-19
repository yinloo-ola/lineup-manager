# 12 · Migration + domain types + import

Type: task
Status: open
Repo: lineup-manager
Blocked by: 11

## Scope

Spec §5: one additive migration (imperative style, comment header; re-run advisors) — nullable `team_a`/`team_b`/`scheduled_start`, `fed_by_a`/`fed_by_b` self-FKs, `winner_side` check, `is_knockout`, `placed_match_id` unique self-FK. Domain types: nullable sides, feeds, winner side, KO row kinds (slot / pool / later-round). `importSeed` writes all three KO kinds. Tighten lineup-write policies so a lineup's team occupies a side of the tie. Manager-read RLS unchanged (verify null-side invisibility). ADR 0002 addendum already records the amendment.
