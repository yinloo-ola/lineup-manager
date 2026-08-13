-- Ticket 3a: schema + RLS foundations for the lineup system.
-- IDs are the string ids supplied by the seed (text primary keys).

-- Category a team event belongs to (the Tie Format is authored per category in Ticket 4).
create table if not exists categories (
  id          text primary key,
  name        text not null,
  short_name  text not null
);

create table if not exists teams (
  id    text primary key,
  name  text not null,
  club  text
);

create table if not exists players (
  id             text primary key,
  team_id        text not null references teams(id) on delete cascade,
  name           text not null,
  gender         text not null,
  date_of_birth  date not null
);

create table if not exists ties (
  id               text primary key,
  category_id      text not null references categories(id) on delete cascade,
  scheduled_start  timestamptz not null,
  table_label      text,
  team_a           text not null references teams(id) on delete cascade,
  team_b           text not null references teams(id) on delete cascade
);

-- Admin identity. Provisioning of managers (3b) will add a profiles/team_managers
-- layer; for now adminship isByEmail so the dev/test admin can import via the UI.
create table if not exists app_admins (
  email text primary key
);

-- The local/test administrator (matches e2e/global-setup.ts). Harmless in prod
-- (no user with that email exists there).
insert into app_admins (email) values ('admin@lineup.local') on conflict do nothing;

-- is_admin(): true for the service role (bypasses RLS anyway) or an email in app_admins.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_admins a
    where a.email = coalesce(auth.jwt() ->> 'email', '')
  )
$$;

-- Row-level security: admin may do anything; everyone else is denied by default.
-- (Manager-scoped read policies arrive with provisioning in Ticket 3b.)

alter table categories enable row level security;
alter table teams      enable row level security;
alter table players    enable row level security;
alter table ties       enable row level security;
alter table app_admins enable row level security;

create policy "admin all on categories" on categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all on teams" on teams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all on players" on players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all on ties" on ties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin manages admins" on app_admins
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
