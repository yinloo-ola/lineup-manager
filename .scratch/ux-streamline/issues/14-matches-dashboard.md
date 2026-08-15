# 14 — Matches dashboard

**What to build:** The fixture table decided in spec §5 — the screen the admin runs a tournament day from. One row per team match, sorted ascending by scheduled time then table number, each team's lineup status inline: **Submitted**, **Not submitted**, or **Missed cutoff** (missing past the cutoff — error chip with alert icon and a red-tinted row, unmissable at a glance). Cutoff-passed team matches carry the calm **Locked** chip; a broken-by-format-edit lineup reads Not submitted with the **Needs attention** marker. Group and round show where available (seed-sourced; omitted when absent). Filters: All / Not submitted / Submitted / Past cutoff. Row click drills into a dialog with both teams' lineups side by side, the metadata line (group · round · table · scheduled), and per-team on-behalf actions — **Edit on behalf**, or **Fill lineup on behalf** (error-toned, with the chase-or-fill alert) for a missed-cutoff team — opening the lineup builder as that team. This ticket absorbs the admin-surface vocabulary sweep: raw status enum strings, the `action needed` chip, and `complete`/`incomplete` wording never reach an admin screen again. Chasing stays visibility-only — no nudge controls.

**Blocked by:** 12 (group/round + status data), 13 (shell).

**Status:** ready-for-agent

- [ ] Fixture table: sort scheduled-time → table; Scheduled/Table/Group·Round/both teams + chips
- [ ] Missed cutoff: error chip + red row; Locked: calm match-level chip; Needs attention marker renders where a confirmed format edit broke a submitted lineup
- [ ] Filters All / Not submitted / Submitted / Past cutoff, worded exactly per the vocabulary
- [ ] Drill-in dialog: both lineups, metadata, Edit/Fill on behalf into the builder (`?team=`)
- [ ] No raw enums, action-needed, or complete/incomplete wording on any admin surface
- [ ] Unit tests for sort/filter/status derivation; no nudge controls anywhere
