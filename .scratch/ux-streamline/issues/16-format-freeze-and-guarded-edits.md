# 16 — Team match format freeze and guarded pre-start edits

**What to build:** The two format rules from spec §6. **Freeze:** once the tournament has started (anchored on its start date), the Team match format can no longer be amended — the authoring page shows a frozen/disabled state with its reason, and the rail entry carries the lock icon. **Guarded pre-start edit:** before the freeze, a format save that would break already-submitted lineups first shows an impact preview — which team matches and lineups are affected — and requires explicit confirmation; no silent invalidation. A confirmed break surfaces downstream as Needs attention on the dashboard (ticket 14's marker). The authoring form itself is otherwise fine as-is (walkthrough verdict) — this ticket adds the freeze and the guard, not a redesign.

**Blocked by:** 12 (start-date anchor), 13 (shell + rail lock placement).

**Status:** ready-for-agent

- [ ] Started tournament: authoring page frozen/disabled with reason; rail entry shows the lock icon
- [ ] Pre-start breaking save: impact preview (affected team matches + lineups) then explicit confirm; cancel leaves everything untouched
- [ ] Confirmed break produces Needs attention states visible on the Matches dashboard
- [ ] Non-breaking pre-start saves proceed without the guard
- [ ] Unit tests for freeze determination and break-detection; e2e or integration coverage for the guarded path
