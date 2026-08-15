# 15 — Tournament settings

**What to build:** The Tournament settings section inside the shell (spec §7): managing the **selected** tournament — rename, start-date edit, delete. The selector owns switching; this page owns managing the one already selected — no tournament list here (that was the rejected design). The start date keys the format freeze (ticket 16) and the selector's Active & upcoming grouping, so editing it takes effect in both. Delete asks for explicit confirmation and makes clear what goes with it.

**Blocked by:** 13 (shell).

**Status:** ready-for-agent

- [ ] Rename, start-date edit, and delete for the selected tournament, inside the shell
- [ ] Start-date changes reflected in the selector's grouping and the format-freeze anchor
- [ ] Delete requires explicit confirmation; behavior after delete lands the admin somewhere sensible (setup-aware landing rules)
- [ ] No tournament list on the page — pointer to the top-right selector for switching instead
- [ ] Unit tests cover the rename/delete state transitions; type-check passes
