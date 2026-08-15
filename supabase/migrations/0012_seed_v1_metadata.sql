-- Ticket #12 (ux-streamline): seed contract v1 metadata — a team-manager email
-- per team, human-label group/round per team match, and a start date on every
-- tournament that has team matches. The parser (src/domain/seed.ts) enforces the
-- contract at entry; these columns let the import persist what it now parses.
-- No new policies or grants: the columns ride the existing table policies
-- (admin-all; managers read their own tournament's teams).

alter table teams add column if not exists manager_email text;
alter table ties  add column if not exists group_label text;
alter table ties  add column if not exists round_label text;

-- "start_date is required for a running tournament" (spec §6/§8). A running
-- tournament is one with team matches, so converge any existing tournament that
-- has ties but no start date using the same rule the import applies: the
-- tournament starts when its earliest team match does. Tournaments with no ties
-- stay null (nothing runs yet; Tournament settings owns setting that date).
update tournaments t
set start_date = d.day
from (
  select tournament_id, min(scheduled_start)::date as day
  from ties
  group by tournament_id
) d
where t.id = d.tournament_id
  and t.start_date is null;
