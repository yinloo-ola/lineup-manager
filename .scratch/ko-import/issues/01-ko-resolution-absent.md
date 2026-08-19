# 01 · KO resolution does not exist in tournament-manager

Type: research
Status: resolved

## Question

How do knockout-round participants in tournament-manager get filled in today, and how stable are seed tie ids across re-exports — facts the KO-import design depends on?

## Answer

Resolved during charting (research subagent, 2026-08-18). Findings, all in /Volumes/Ext/code/personal/tournament-manager:

1. **KO participants are never resolved by anything.** The only writes to `entry1Idx/entry2Idx` set them to `-1` (empty): bracket generation (`web/src/features/matches/domain/generateRounds.ts:62-63`, `:134-164`) and the draw-clear reset (`web/src/features/draw/domain/draw.ts:255-263`). The KO tab is display-only (`web/src/features/matches/ui/KnockoutMatchesTab.vue:37-44` renders "—"/"BYE"); no assignment UI exists anywhere.
2. **No standings / qualification concept.** `GroupsTab.vue:18-26` position/points functions are stubbed placeholders; the round-robin chart prints empty Points/Position columns for handwriting (`features/roundrobin/excel/roundrobinChartWorkbook.ts:153-156, 193`) and nothing is read back. Scoresheets substitute template placeholders (`features/scoresheet/excel/scoresheetWorkbook.ts:5-14`) — no result import exists.
3. **Seed ties have no bracket-slot identity.** `buildLineupSeed.ts:173-175` skips any match whose entries don't map to teams, so an unresolved KO slot produces **zero** seed ties. Resolved tie ids are `teamA|teamB|scheduledStart` (`:178`) — stable only while teams+time are unchanged; a time move changes the id. Nothing encodes category+round+match position.
4. **An accidental backdoor, not a workflow.** Final-schedule import round-trips EntryID1/2 columns into KO matches (`importFinalSchedule.ts:80-81`, `:244-252`; the merge replaces `knockoutRounds` wholesale at `calculator/schedule.ts:42-63`) — but the matches sheet is protected (hardcoded password, `draftScheduleWorkbook.ts:35`), the exporter leaves unresolved cells empty (`:197-199`), nothing validates plausibility, and re-running draft export resets assignments (`generateRounds.ts:62-63` via `views/TournamentView.vue:294`).
5. **Docs describe generation only** (`docs/FUNCTIONALITY.md:62-76`); no resolving/advancing workflow is described anywhere; `docs/plans/` is empty.

**Consequence:** "import KO before teams are known" spans two gaps, not one — the producer needs a deliberate participant-resolution capability (at minimum manual assignment) plus a bracket-slot identity in the seed, before lineup-manager can fill anything in.
