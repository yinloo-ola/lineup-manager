# 13 · Bracket module logic

Type: task
Status: open
Repo: lineup-manager
Blocked by: 12

## Scope

Spec §6 as pure domain + service logic (primary test seam): team entry (same-category, one KO slot per team, ✕ removal with **placement release**); placement binding; balance rule + advance-byes; winner toggle (placement-gated in the first round; instant un-pick when downstream untouched); cascade-clear (downstream rewind, lineups stand/remove with confirmation enumerating the blast radius); admin-only actions; one transaction per action. Unit tests: the prototype's verified flows plus guardrails.
