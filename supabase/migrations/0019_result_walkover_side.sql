-- 0019: a walkover's winning side (results-and-standings slice 1, R5).
-- The derived winner needs to know WHO received the walkover; null when the
-- row is not a walkover. The umpire RPC grows the matching parameter.

alter table public.rubber_results
  add column walkover_side text
  check (walkover_side in ('a', 'b'));

create or replace function public.upsert_umpire_result(
  p_tie_id text,
  p_rubber_index integer,
  p_games jsonb,
  p_walkover boolean,
  p_walkover_side text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id text;
  v_category_id text;
  v_rubber_count integer;
  v_submitted integer;
  v_player_a jsonb;
  v_player_b jsonb;
begin
  -- The caller must umpire the tie's tournament.
  select tournament_id, category_id into v_tournament_id, v_category_id
    from ties where id = p_tie_id;
  if v_tournament_id is null or v_tournament_id <> public.umpire_tournament_id() then
    raise exception 'FORBIDDEN: not your tournament';
  end if;

  -- The entry gate: both sides must have a submitted lineup.
  select count(*) into v_submitted
    from lineups
    where tie_id = p_tie_id and status = 'submitted'
      and team_id in (select team_a from ties where id = p_tie_id
                      union all
                      select team_b from ties where id = p_tie_id);
  if v_submitted < 2 then
    raise exception 'LINEUP_GATE: both lineups must be submitted before results can be entered';
  end if;

  -- The rubber must exist in the tie's format.
  select coalesce(jsonb_array_length(rubbers), 0) into v_rubber_count
    from tie_formats
    where tournament_id = v_tournament_id and category_id = v_category_id;
  if p_rubber_index < 1 or p_rubber_index > coalesce(v_rubber_count, 0) then
    raise exception 'BAD_RUBBER: rubber index % outside the format', p_rubber_index;
  end if;

  -- A walkover needs its side; a played rubber carries none.
  if coalesce(p_walkover, false) and p_walkover_side not in ('a', 'b') then
    raise exception 'WALKOVER_SIDE: a walkover needs its winning side';
  end if;

  -- Player identity rides on the submitted lineups, never on client input.
  select l.player_ids -> (p_rubber_index - 1) into v_player_a
    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_a from ties where id = p_tie_id);
  select l.player_ids -> (p_rubber_index - 1) into v_player_b
    from lineups l where l.tie_id = p_tie_id and l.team_id = (select team_b from ties where id = p_tie_id);

  insert into rubber_results
    (tournament_id, tie_id, rubber_index, player_ids, games, walkover, walkover_side, entered_by)
  values
    (v_tournament_id, p_tie_id, p_rubber_index,
     jsonb_build_array(coalesce(v_player_a, 'null'::jsonb), coalesce(v_player_b, 'null'::jsonb)),
     case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
     coalesce(p_walkover, false),
     case when coalesce(p_walkover, false) then p_walkover_side else null end,
     auth.uid())
  on conflict (tie_id, rubber_index) do update
    set games = case when coalesce(p_walkover, false) then '[]'::jsonb else coalesce(p_games, '[]'::jsonb) end,
        walkover = coalesce(p_walkover, false),
        walkover_side = case when coalesce(p_walkover, false) then p_walkover_side else null end,
        entered_by = auth.uid(),
        updated_at = now();
  -- (player_ids deliberately absent from the update set: immutable for umpires)
end;
$$;

grant execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) to authenticated;
