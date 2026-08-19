# 02 · Producer-side participant resolution workflow

Type: grilling
Status: resolved

## Question

tournament-manager has KO structure (empty slots, tables, times) but **no way to resolve participants** (see [01](01-ko-resolution-absent.md)). What is the deliberate resolution workflow the organizer will use, and how far does its scope go?

Decisions to make with the user:

- **Scope fork**: minimum viable = manual assignment UI (organizer picks which entry fills each KO slot) vs standings-driven (record group results, compute positions, auto-advance) vs workbook-declared (make the EntryID backdoor a real, validated workflow). Standings math is a large feature of its own — in this effort or a later one?
- Where assignment lives (KO tab inline? draw feature? schedule grid?) and whether byes/walkovers are assignable.
- Guarding the wipe hazard: re-generating rounds (`generateRounds.ts:62-63`) resets assignments — regeneration must preserve them or warn.
- What the organizer needs to see to decide assignments (group results/charts are paper today).

## Answer

Resolved 2026-08-18, grilling with the user (plus fact-finds recorded here and in [01](01-ko-resolution-absent.md)).

**There is no producer-side resolution workflow — by decision, not by gap.** KO participant resolution lives in **lineup-manager**, not tournament-manager:

- **tournament-manager stays structure + scheduling + print.** Its only new duty is exporting seed v2 faithfully: unresolved KO ties included, each with a stable bracket-slot identity (detail owned by [03](03-seed-contract-v2.md)). No assignment UI, no standings, no results. User direction: lineup-manager will be extended in the future to manage results; the KO participant-input module is the first step, and it is **in this map's destination** (user decision) — the admin assigns the two **Teams** to each TBD bracket slot, round by round, from the Matches dashboard.
- **Terminology sharpened**: bracket slots resolve to **Teams** (the user's "players" = participants); players are named in lineups per team match as today. New term **Bracket Slot** added to `CONTEXT.md`.
- **Regeneration/wipe hazard is moot producer-side** — nothing is ever assigned there. The surviving requirement — bracket-slot identity stable across re-exports — belongs to 03. Fact: `generateRoundsForTournament` runs on every draw-modal close and every draft-schedule re-export, rebuilding group rounds and the KO bracket; acceptable while the seed is exported once, after the final schedule.
- **One-shot import discipline (user decision)**: export the seed only after importing the final schedule, so times/tables are final. Corrections before any lineups exist = delete tournament + re-import; after lineups exist = out of scope for this effort. No re-import/update path, so no amendment to lineup-manager ADR 0001 is needed.
- **Byes & walkovers need nothing special**: byes are implicit shrinkage in the bracket (the absent matches simply don't exist in the seed); a walkover is just the admin typing the advancing team into the next slot.
- **Fact recorded for 03/06**: the draw feature seeds group slots only (`features/draw` never touches `knockoutRounds`); there is **no slot-source convention anywhere in data, UI, or docs** ("A1 feeds QF1" lives only on paper). Seed v2 therefore cannot carry organizer-computed source labels; any "Winner QF2" hint must be derived from positional feed structure — 03's call whether to export it.

ADR written: tournament-manager `docs/adr/0004-ko-resolution-in-lineup-manager.md` records the split (results-free organizer tool; resolution + future results in lineup-manager).

## Comments

- 2026-08-18 (user, same day) — refinement of the fill-in semantics decided above: the admin enters Teams **only for the first knockout round**; every later round fills by **propagation** — the admin selects the winner of a two-team match ("for now simply select the winner"; full results key-in is the future extension), and a match with only one team advances that team directly. lineup-manager therefore becomes **bracket-aware**; the seed must carry feed structure (which match's winner fills which next-round slot) — folded into the premises of [03](03-seed-contract-v2.md), [04](04-tbd-sides-data-model.md), [05](05-fill-in-mechanism.md), [06](06-tbd-ux.md). This also refines the answer's "byes need nothing special": absent first-round bye matches still never exist in the seed (shrinkage stands), but bye TEAMS now surface in lineup-manager as lone-team matches that auto-advance. Confirmed: group ties are complete at import (draw + final schedule give table, time, teams) — only KO ties need any of this.

