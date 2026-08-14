-- Ticket #12 (expand): introduce the Tournament as the top-level scope — NON-BREAKING.
-- Adds a `tournaments` table and a nullable `tournament_id` on every tournament-scoped
-- table, backfills any existing rows into a single "Default" tournament, and gates the
-- new table with admin-only RLS. Nothing reads or filters on tournament_id yet, so
-- today's single-tournament behaviour is unchanged. (Ticket #16 makes the column
-- required and tightens RLS once every writer populates it.)

create table if not exists tournaments (
  id          text primary key,
  name        text not null unique,
  start_date  date,
  created_at  timestamptz not null default now()
);

alter table tournaments enable row level security;

create policy "admin all on tournaments" on tournaments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on table tournaments to anon, authenticated, service_role;

-- Nullable tournament_id on each tournament-scoped table. Nullable on purpose: this
-- is the expand step. #16 makes it NOT NULL once every writer sets it.
alter table categories  add column if not exists tournament_id text references tournaments(id) on delete cascade;
alter table teams       add column if not exists tournament_id text references tournaments(id) on delete cascade;
alter table players     add column if not exists tournament_id text references tournaments(id) on delete cascade;
alter table ties        add column if not exists tournament_id text references tournaments(id) on delete cascade;
alter table tie_formats add column if not exists tournament_id text references tournaments(id) on delete cascade;
alter table lineups     add column if not exists tournament_id text references tournaments(id) on delete cascade;

-- Backfill: if there is existing data, gather it under one "Default" tournament so
-- nothing is orphaned. On a fresh (empty) database no Default is created, matching the
-- "empty state" intent — the WHERE EXISTS guards the insert (idempotent on re-run).
insert into tournaments (id, name)
select 'default', 'Default'
where exists (select 1 from teams)
   or exists (select 1 from categories)
   or exists (select 1 from ties)
   or exists (select 1 from players)
   or exists (select 1 from lineups)
   or exists (select 1 from tie_formats)
on conflict (id) do nothing;

update categories  set tournament_id = 'default' where tournament_id is null;
update teams       set tournament_id = 'default' where tournament_id is null;
update players     set tournament_id = 'default' where tournament_id is null;
update ties        set tournament_id = 'default' where tournament_id is null;
update tie_formats set tournament_id = 'default' where tournament_id is null;
update lineups     set tournament_id = 'default' where tournament_id is null;
