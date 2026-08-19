# 08 · Assemble the KO-import spec

Type: task
Status: resolved
Blocked by: 02, 03, 04, 05, 06, 07

## Question

Destination artifact: write `.scratch/ko-import/spec.md` covering both repos — seed contract v2 (with `docs/seed-contract.md` + schema updates specced), the tournament-manager resolution workflow, lineup-manager schema/domain/RLS/UX, the fill-in path, and the e2e plan — then slice it into build tickets. Nothing new is decided here; a gap found while writing means reopening the ticket that owns the gap, not deciding inline.

## Answer

Resolved 2026-08-19. **[`spec.md`](../spec.md) written** (house style per `ux-streamline`): 11 sections covering principles, the KO model (structure / first-round pool / later-round ties), seed contract v2 (shapes table + invariants), producer changes, the data model, bracket-module mechanics, UX (grouped-table verdict), the e2e plan, out-of-scope, implementation-enabling notes, and the build slicing.

- **Build tickets created: [09](09-generator-full-rounds.md)–[15](15-e2e.md)** (numbering continues from the wayfinder tickets): generator + byes → seed v2 export (producer chain); contract+parser → migration+import → bracket module → view/UX → e2e (consumer chain).
- Assembly-level encodings chosen and marked in the spec (pool-entry id format, `brackets[]` JSON shape, `placed_match_id` direction) — deliberately reversible, not user decisions.
- ADR 0002 amended with the no-bye-ties/placement-model addendum.
- The two carried judgment calls (byes advance on round balance; winner selection requires placement) are spec'd as-is per 07's close.

The wayfinder map's destination — a decided spec covering both repos, ready to slice into build tickets — is reached; the slicing is done too. Execution of 09–15 is outside the map (per its Notes: planning only).
