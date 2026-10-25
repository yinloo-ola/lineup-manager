-- 0016: results entry foundations (results-and-standings slice 1, R2).
--
-- The umpire role: per-tournament accounts provisioned by an admin (mirroring
-- team_managers), confined to their tournament, able to READ everything they
-- need to score a tie (ties, teams, players, lineups, formats, categories) and
-- to read back the results they entered. Writes land with slice 1's entry
-- requirements (via a security-definer RPC, so the stored player identity stays
-- the submitted lineup's, not whatever a client sends).

-- ---------------------------------------------------------------------------
-- Umpires

create table if not exists umpires (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  tournament_id        text not null references tournaments(id) on delete cascade,
  email                text not null,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now(),
  -- An auth account umpires at most one tournament.
  unique (user_id, tournament_id)
);

alter table umpires enable row level security;

create policy "admin all on umpires" on umpires
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "umpire reads own row" on umpires
  for select to authenticated using (user_id = auth.uid());

-- The tournament the caller umpires (null if the caller is not an umpire).
create or replace function public.umpire_tournament_id()
returns text
language sql
security definer
set search_path = public
as $$
  select tournament_id from umpires where user_id = auth.uid()
$$;

grant execute on function public.umpire_tournament_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Rubber results (raw entered data — winners are derived, never stored here)

create table if not exists rubber_results (
  id           uuid primary key default gen_random_uuid(),
  tournament_id text not null references tournaments(id) on delete cascade,
  tie_id       text not null references ties(id) on delete cascade,
  rubber_index integer not null,
  player_ids   jsonb not null,
  games        jsonb not null default '[]'::jsonb,
  walkover     boolean not null default false,
  entered_by   uuid references auth.users(id) on delete set null,
  entered_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tie_id, rubber_index)
);

alter table rubber_results enable row level security;

create policy "admin all on rubber_results" on rubber_results
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "umpire reads own tournament results" on rubber_results
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());

-- ---------------------------------------------------------------------------
-- Umpire read access: everything needed to score a tie in their own tournament
-- (the same read surface managers got in migrations 0004/0010, scoped by the
-- umpire's tournament instead of the manager's team).

create policy "umpires read own tournament ties" on ties
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament teams" on teams
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament players" on players
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament lineups" on lineups
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament formats" on tie_formats
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament categories" on categories
  for select to authenticated
  using (tournament_id = public.umpire_tournament_id());
create policy "umpires read own tournament" on tournaments
  for select to authenticated
  using (id = public.umpire_tournament_id());

-- ---------------------------------------------------------------------------
-- The must-change flag now covers both provisioned roles: extend the
-- security-definer RPC to clear the umpire row too (the manager update is a
-- no-op for umpires and vice versa).

create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update team_managers set must_change_password = false where user_id = auth.uid();
  update umpires set must_change_password = false where user_id = auth.uid();
$$;
