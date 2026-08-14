-- Ticket #13: let a Team Manager read their OWN tournament.
-- `tournaments` is admin-only by default (Ticket #12), but tournament-awareness —
-- in particular resolving the "as of tournament start" age rule — needs the
-- manager's tournament `start_date`. This adds a narrow read of the single
-- tournament the manager's team belongs to. The manager still gets no selector
-- and cannot read any other tournament.

-- The tournament of the caller's team (null if the caller is not a manager or
-- their team has no tournament). Security definer so it reads teams regardless of
-- the caller's RLS — the same pattern as manager_team_id().
create or replace function public.manager_tournament_id()
returns text
language sql
security definer
set search_path = public
as $$
  select t.tournament_id from teams t where t.id = public.manager_team_id()
$$;

grant execute on function public.manager_tournament_id() to authenticated;

create policy "manager reads own tournament" on tournaments
  for select to authenticated using (id = public.manager_tournament_id());
