-- Ticket 7: enforce the lineup cutoff SERVER-SIDE. A client clock can be
-- bypassed, so the database itself must refuse manager writes at/after the
-- cutoff. The cutoff = tie.scheduled_start − category lead_time (Ticket 4),
-- compared as UTC against the database clock (now()). Admins keep full access
-- via the existing "admin all on lineups" policy (no-reopen: admin-only after).

-- True when now() is at/after the tie's cutoff. Security definer so it can read
-- ties/tie_formats (and their lead time) regardless of the caller's RLS — the
-- same pattern as is_admin() / manager_team_id().
create or replace function public.tie_locked(p_tie_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ties t
    left join tie_formats f on f.category_id = t.category_id
    where t.id = p_tie_id
      and t.scheduled_start - make_interval(mins => coalesce(f.lead_time_minutes, 30)) <= now()
  )
$$;

grant execute on function public.tie_locked(text) to authenticated;

-- Replace the Ticket 6 manager write policies with cutoff-gated versions.
-- Reads (0004) are unchanged — a manager may always VIEW their lineup.
drop policy if exists "manager inserts own lineups" on lineups;
drop policy if exists "manager updates own lineups" on lineups;

create policy "manager inserts own lineups before cutoff" on lineups
  for insert to authenticated
  with check (team_id = public.manager_team_id() and not public.tie_locked(tie_id));

create policy "manager updates own lineups before cutoff" on lineups
  for update to authenticated
  using (team_id = public.manager_team_id())
  with check (team_id = public.manager_team_id() and not public.tie_locked(tie_id));
