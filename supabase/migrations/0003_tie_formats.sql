-- Ticket 4: per-category Tie Format (rubbers + constraints + usage policy + lead time).

create table if not exists tie_formats (
  category_id        text primary key references categories(id) on delete cascade,
  rubbers            jsonb not null default '[]',
  usage_policy       jsonb,
  lead_time_minutes  int not null default 30
);

alter table tie_formats enable row level security;

-- The format is just the rules (men's singles, mixed doubles, …), not lineups or
-- strategy, so any signed-in user may read it. Only admins author/edit.
create policy "authenticated reads tie_formats" on tie_formats
  for select to authenticated using (true);
create policy "admin writes tie_formats" on tie_formats
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
