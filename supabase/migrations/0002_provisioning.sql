-- Ticket 3b: manager provisioning + forced first-login password change.

-- One manager account per team (1:1), one team per manager.
create table if not exists team_managers (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  team_id              text unique references teams(id) on delete cascade,
  email                text not null,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

alter table team_managers enable row level security;

-- Admins manage everything; a manager may read their own row (so the app can
-- see must_change_password / their team). Writes for managers are via the
-- security-definer RPCs below, not direct table access.
create policy "admin all on team_managers" on team_managers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "manager reads own row" on team_managers
  for select to authenticated using (user_id = auth.uid());

-- The managed team of the caller (null if the caller is not a manager).
create or replace function public.manager_team_id()
returns text
language sql
security definer
set search_path = public
as $$
  select team_id from team_managers where user_id = auth.uid()
$$;

-- Clears the caller's must-change-password flag. Called by the app after a
-- successful password change. Security definer so a manager can flip only this
-- flag (via the RPC) without broader write access to the table.
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update team_managers set must_change_password = false where user_id = auth.uid()
$$;

grant execute on function public.manager_team_id() to authenticated;
grant execute on function public.clear_must_change_password() to authenticated;
