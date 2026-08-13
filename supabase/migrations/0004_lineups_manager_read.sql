-- Ticket 5: lineups table + manager read access (own roster, own ties, own lineups).

create table if not exists lineups (
  tie_id       text not null references ties(id) on delete cascade,
  team_id      text not null references teams(id) on delete cascade,
  player_ids   jsonb not null default '[]',
  status       text not null default 'not-started',
  submitted_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (tie_id, team_id)
);

alter table lineups enable row level security;

create policy "admin all on lineups" on lineups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "manager reads own lineups" on lineups
  for select to authenticated using (team_id = public.manager_team_id());

-- Team names/clubs are public tournament info: any signed-in user may read them.
create policy "authenticated reads teams" on teams
  for select to authenticated using (true);

-- A manager sees only their own roster and their own ties (opponent rosters stay hidden).
create policy "manager reads own players" on players
  for select to authenticated using (team_id = public.manager_team_id());
create policy "manager reads own ties" on ties
  for select to authenticated using (
    team_a = public.manager_team_id() or team_b = public.manager_team_id()
  );
