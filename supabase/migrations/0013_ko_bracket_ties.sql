-- Ticket #12 (ko-import): knockout bracket columns on ties. Knockout team
-- matches import before their teams are known, as three row kinds: positional
-- slots (bracket structure; no schedule until a pool match is placed), the
-- entry round's imported pool (table + time, no position), and later-round
-- positional ties (scheduled, both sides fed). Byes are NOT rows — a bye is a
-- slot that ends up with one team (ADR 0002, amended).

alter table ties alter column team_a drop not null;
alter table ties alter column team_b drop not null;
-- Slot rows carry no schedule until a pool match is placed onto them.
alter table ties alter column scheduled_start drop not null;

alter table ties add column if not exists fed_by_a text references ties(id) on delete set null;
alter table ties add column if not exists fed_by_b text references ties(id) on delete set null;
alter table ties add column if not exists winner_side text check (winner_side in ('a', 'b'));
alter table ties add column if not exists is_knockout boolean not null default false;
-- A placed pool match binds to the slot it was placed on (one slot each).
alter table ties add column if not exists placed_match_id text references ties(id) on delete set null;
create unique index if not exists ties_placed_match_unique
  on ties (placed_match_id) where placed_match_id is not null;

-- Manager-read RLS (0004) needs no change: null sides never match
-- manager_team_id(), so unresolved knockout rows are invisible to managers
-- until their team lands on one. The lineup-write policies, however, only
-- checked team ownership + cutoff + tournament — not that the lineup's team
-- actually occupies a side of the tie (membership was app-layer only). This
-- helper closes that at the policy layer, tolerating null sides.

create or replace function public.tie_has_team(p_tie_id text, p_team_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from ties t
    where t.id = p_tie_id and (t.team_a = p_team_id or t.team_b = p_team_id)
  )
$$;

grant execute on function public.tie_has_team(text, text) to authenticated;

drop policy if exists "manager inserts own lineups before cutoff" on lineups;
create policy "manager inserts own lineups before cutoff" on lineups
  for insert to authenticated
  with check (
    team_id = public.manager_team_id()
    and public.tie_has_team(tie_id, team_id)
    and not public.tie_locked(tie_id)
    and tournament_id = public.tie_tournament(tie_id)
  );

drop policy if exists "manager updates own lineups before cutoff" on lineups;
create policy "manager updates own lineups before cutoff" on lineups
  for update to authenticated
  using (team_id = public.manager_team_id())
  with check (
    team_id = public.manager_team_id()
    and public.tie_has_team(tie_id, team_id)
    and not public.tie_locked(tie_id)
    and tournament_id = public.tie_tournament(tie_id)
  );
