# Manager journey walkthrough — where does the flow actually confuse?

Type: grilling
Status: resolved
Blocked by: 01

## Question

Walk the team-manager journey live with the user and record every point of friction: login (including the forced password change on first login), the manager home (roster card + team-match list), building a lineup, saving a draft, submitting, and the locked and invalidated states afterwards. Which parts genuinely confuse, which merely annoy, and what is missing entirely — a usage overview of who is already assigned where, deadline urgency, a confirmation after submit?

Candidates observed in code — to confirm or dismiss with the user, never assumed:

- Status chip soup: `not-started` / `draft` / `submitted` / `invalidated` shown as raw enum strings beside a second `locked` / `open` chip (`src/views/ManagerView.vue:96-118`).
- Assignment is a dropdown per match with removable chips; there is no player-centric view of who has been used across the whole lineup (`src/views/LineupBuilderView.vue:258-312`).
- Violations surface as scattered alert banners rather than at the point of the mistake (`src/views/LineupBuilderView.vue:300-309`).
- Save draft / Submit / Recall buttons swap visibility with status, and the locked-vs-admin-edit banners are subtle (`src/views/LineupBuilderView.vue:251-256`, `370-406`).

If [Confirm the destination and scope](01-confirm-destination-and-scope.md) scopes the admin flow out entirely, this ticket becomes the whole effort's user research.

## Answer

Closed as out of scope — no walkthrough held. [Confirm the destination and scope](01-confirm-destination-and-scope.md) scoped this map to the administrator console; the manager experience stays as-is. Recorded in the map's Out of scope section. If the manager flow's confusion resurfaces, it returns as a fresh effort, not a resumption of this map.
