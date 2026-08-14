-- Ticket #16: the contract step — harden the Tournament dimension now that
-- every writer populates it. (The app write paths that still omitted it — the
-- lineup builder's upsert and the Tie Format save — are fixed in this ticket;
-- the backfills below converge any stragglers written before that fix.)

-- 1. Backfill stragglers, deriving each row's tournament from its parent. A
-- lineup always has its tie (FK), a format its category, a player its team, a
-- tie its category; teams/categories have no parent, so they fall back to the
-- Default tournament (only reachable on a legacy stack that skipped 0009's own
-- backfill — 0009 already converged everything existing at its time).
update lineups l set tournament_id = t.tournament_id
  from ties t where l.tie_id = t.id and l.tournament_id is null;
update tie_formats f set tournament_id = c.tournament_id
  from categories c where f.category_id = c.id and f.tournament_id is null;
update players p set tournament_id = t.tournament_id
  from teams t where p.team_id = t.id and p.tournament_id is null;
update ties ti set tournament_id = c.tournament_id
  from categories c where ti.category_id = c.id and ti.tournament_id is null;
update teams      set tournament_id = 'default' where tournament_id is null;
update categories set tournament_id = 'default' where tournament_id is null;

-- 2. The dimension is now required, not optional.
alter table categories  alter column tournament_id set not null;
alter table teams       alter column tournament_id set not null;
alter table players     alter column tournament_id set not null;
alter table ties        alter column tournament_id set not null;
alter table tie_formats alter column tournament_id set not null;
alter table lineups     alter column tournament_id set not null;

-- 3. Composite keys.
--
-- lineups and tie_formats take the composite as their PRIMARY KEY (upsert
-- conflict targets move with it): a lineup is identified within its tournament
-- by (tie, team), and a format by its team event within its tournament.
--
-- teams, categories and ties KEEP their global-id primary keys and enforce the
-- composite (tournament_id, id) as UNIQUE constraints instead. Deliberate: a
-- bare team id is what team_managers (the 1:1 manager↔team binding) and every
-- manager RLS policy key on, so per-tournament recurrence of a team id would
-- make "the manager's team" ambiguous and leak policies across tournaments.
-- Global id uniqueness for those tables is a correctness constraint, not a
-- limitation — the seed import mints fresh ids per import regardless.
alter table lineups drop constraint lineups_pkey;
alter table lineups add primary key (tournament_id, tie_id, team_id);

alter table tie_formats drop constraint tie_formats_pkey;
alter table tie_formats add primary key (tournament_id, category_id);

create unique index if not exists teams_tournament_id_id_key
  on teams (tournament_id, id);
create unique index if not exists categories_tournament_id_id_key
  on categories (tournament_id, id);
create unique index if not exists ties_tournament_id_id_key
  on ties (tournament_id, id);

-- The lineups PK change above removed the FK-covering index the old
-- (tie_id, team_id) PK provided; restore covering indexes for the tie/team
-- FKs (used by the on-delete cascades and the per-tie/per-team reads).
create index if not exists lineups_tie_id_idx on lineups (tie_id);
create index if not exists lineups_team_id_idx on lineups (team_id);

-- 4. Tighten the two remaining unscoped read policies. Teams and tie formats
-- were readable by ANY authenticated user across ALL tournaments (expand-era
-- "team names are public tournament info"); now they're readable only within
-- your own tournament (managers) or with admin access. Team-scoped policies
-- (players, ties, lineups) already confine a manager to their own tournament,
-- because a team belongs to exactly one tournament.
drop policy if exists "authenticated reads teams" on teams;
create policy "reads teams in own tournament" on teams
  for select to authenticated
  using (public.is_admin() or tournament_id = public.manager_tournament_id());

drop policy if exists "authenticated reads tie_formats" on tie_formats;
create policy "reads tie_formats in own tournament" on tie_formats
  for select to authenticated
  using (public.is_admin() or tournament_id = public.manager_tournament_id());

-- 5. A manager's lineup write must stamp the tie's ACTUAL tournament. The
-- Ticket 7 policies only checked team ownership, so a manager could insert a
-- phantom (own tie, own team, foreign tournament) row — invisible to every
-- tournament-scoped view. The tie's tournament resolver is security definer
-- (same pattern as tie_locked/manager_team_id) so the check works regardless
-- of the caller's RLS on ties.
create or replace function public.tie_tournament(p_tie_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select t.tournament_id from ties t where t.id = p_tie_id
$$;

grant execute on function public.tie_tournament(text) to authenticated;

drop policy if exists "manager inserts own lineups before cutoff" on lineups;
create policy "manager inserts own lineups before cutoff" on lineups
  for insert to authenticated
  with check (
    team_id = public.manager_team_id()
    and not public.tie_locked(tie_id)
    and tournament_id = public.tie_tournament(tie_id)
  );

drop policy if exists "manager updates own lineups before cutoff" on lineups;
create policy "manager updates own lineups before cutoff" on lineups
  for update to authenticated
  using (team_id = public.manager_team_id())
  with check (
    team_id = public.manager_team_id()
    and not public.tie_locked(tie_id)
    and tournament_id = public.tie_tournament(tie_id)
  );
