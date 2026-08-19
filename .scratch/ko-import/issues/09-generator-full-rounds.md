# 09 · Generator: full rounds + structural byes

Type: task
Status: resolved
Repo: tournament-manager
Blocked by: —
Branch: `feat/09-generator-full-rounds` (commit b224bc6; ADR 0004 committed separately as 9baacd2)

## Scope

Spec §4 (`.scratch/ko-import/spec.md`): knockout generation emits **full power-of-two rounds** with **byes placed structurally at generation, evenly distributed across the first KO round** (what `docs/FUNCTIONALITY.md` already documents — the shrinking code is the deviation). The scheduler **skips bye matches** (no table/time). Real matches across all rounds keep the final schedule's table + time. No assignment UI, no results (ADR 0004). Tests: round shapes for bye-affected qualifier counts; scheduler output excludes byes.

## Answer

Done 2026-08-19, TDD (failing tests first). Model: `Match.bye?: boolean`. Generator: full rounds + `byeMatchIndexes` even spread (`floor(j·matches/byes)`). Scheduler skips byes. Final-schedule import merge re-attaches byes positionally (wholesale fallback on shape mismatch). Scoresheet exporter and KO data table exclude byes; bracket cards show "BYE — no schedule". Tests: updated structural goldens (6→8 draw: 4 entry slots, byes at {0,2}; 20→32: 12 byes), scheduler exclusion (5 real KO matches, none for byes), merge preservation + fallback. Full suite 325 passed, vue-tsc clean. Code review (two-axis) applied: scoresheet bye-skip was a found regression, fixed; legacy-barrel test import, duplicated mapping literal, and `needsByeReattach` naming cleaned. The bye-free Go goldens are unchanged; only bye-affected shapes were superseded.
