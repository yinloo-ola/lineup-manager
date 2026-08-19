# 13 · Bracket module logic

Type: task
Status: resolved
Repo: lineup-manager
Blocked by: 12
Branch: `feat/13-bracket-module` (commit c0914d1, stacked on feat/12-migration-import)

## Scope

Spec §6 as pure domain + service logic (primary test seam): team entry (same-category, one KO slot per team, ✕ removal with **placement release**); placement binding; balance rule + advance-byes; winner toggle (placement-gated in the first round; instant un-pick when downstream untouched); cascade-clear (downstream rewind, lineups stand/remove with confirmation enumerating the blast radius); admin-only actions; one transaction per action. Unit tests: the prototype's verified flows plus guardrails.

## Answer

Done 2026-08-19. **Key design choice: fed sides are DERIVED, never stored** — a later-round side resolves to its feeder's winner team at read time (ticket 12's import already writes exactly that shape), so propagation needs no writes, drift is impossible by construction, and every action is a single-row update — strictly stronger than the spec's transaction note (which presumed stored fed sides).

`src/domain/bracket.ts` (pure, 231-test suite incl. 19 bracket tests on the spec's worked example): the derived `buildBracketSnapshot` (slots/pool/category-teams/lineups, schedule via placement or own import); guards — `canEnterTeam` (same-category, one-KO-slot-per-team, free side, undecided slot; **pool matches rejected as slots**), `canClearTeam` + `clearTeamPatch` (✕ always releases a placement — a placed slot holds two teams by construction, any clear drops below two; one patch, one row), `canPlaceMatch`, `isBalanced` (all pool placed ∧ two-team slots = pool count ∧ every slot ≥ one team), `byeAdvances` (balance-gated), `canToggleWinner` (both sides + entry placement; un-pick via the selected side only; downstream-touched → `needs-cascade` with the plan), `planCascade` (blast radius: downstream winners clear; lineups of departed sides removed; surviving teams keep theirs — origin lineups always stand).

`src/services/bracketService.ts`: thin, guard-checked, tournament-scoped writes; `CascadeNeededError` carries the plan for ticket 14's confirmation dialog. Admin-only by RLS (managers hold no update on ties, no delete on lineups). Known trade-off: `cascadeClear` (UPDATE + DELETE) and `advanceByes` (two side-bucketed UPDATEs) are two-statement, idempotent actions without a transaction — a torn cascadeClear leaves an invisible-to-readers stale lineup until re-run (recorded for ticket 15's e2e).

Two-axis review caught two real bugs, both fixed with regression tests: a dead placement-release condition (bracket would stall) and the pool-row guard hole.
