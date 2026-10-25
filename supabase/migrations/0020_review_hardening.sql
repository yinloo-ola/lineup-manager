-- 0020: review hardening for the umpire RPC (results-and-standings slice 1).
--
-- Four fixes from the feature review:
--   1. CRITICAL: the FORBIDDEN check compared v_tournament_id <> umpire_tournament_id().
--      For a caller with NO umpires row the right side is NULL, the comparison is
--      NULL, and PL/pgSQL treats a NULL IF condition as false — so any
--      authenticated non-umpire could write results. Use IS DISTINCT FROM plus an
--      explicit null guard.
--   2. The RPC accepted knockout ties; slice 1's contract is group ties only —
--      enforced here, not just in the browser.
--   3. p_games was stored verbatim; now shape-validated (array of
--      {a,b} non-negative integers), so derivation readers cannot be fed junk.
--   4. Explicit DML grants (migration 0005's lesson: tables get no default
--      privileges we should rely on); anon never gets EXECUTE on this function.

revoke execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) from anon;
grant execute on function public.upsert_umpire_result(text, integer, jsonb, boolean, text) to authenticated;

grant select, insert, update, delete on public.rubber_results to authenticated;
grant select on public.umpires to authenticated;

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
  v_game jsonb;
  v_is_knockout boolean;
begin
  -- The caller must umpire the tie's tournament. IS DISTINCT FROM is null-safe:
  -- a caller without an umpires row (managers, admins, anyone else) has
  -- umpire_tournament_id() = NULL and must be refused, not slipped through by
  -- three-valued logic.
  if public.umpire_tournament_id() is null then
    raise exception 'FORBIDDEN: umpires only';
  end if;
  select tournament_id, category_id, is_knockout into v_tournament_id, v_category_id, v_is_knockout
    from ties where id = p_tie_id;
  if v_tournament_id is null or v_tournament_id is distinct from public.umpire_tournament_id() then
    raise exception 'FORBIDDEN: not your tournament';
  end if;

  -- Slice 1 enters group ties only; knockout entry arrives with the winner
  -- cascade in a later slice.
  if v_is_knockout then
    raise exception 'NOT_ENTERABLE: knockout results are not enterable yet';
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

  -- Game scores are shape-validated server-side: an array of {a,b} pairs of
  -- non-negative integers, honouring the tie's best-of (no games after the
  -- majority is reached). This is the integrity floor for derivation readers;
  -- the dialogs add friendlier entry-time messages on top.
  if p_games is not null and jsonb_typeof(p_games) <> 'array' then
    raise exception 'BAD_GAMES: games must be an array';
  end if;
  if not coalesce(p_walkover, false) and p_games is not null then
    declare
      v_best_of integer;
      v_majority integer;
      v_a integer := 0;
      v_b integer := 0;
    begin
      select best_of into v_best_of from ties where id = p_tie_id;
      v_majority := ceil(coalesce(v_best_of, 5) / 2.0);
      if jsonb_array_length(p_games) > coalesce(v_best_of, 5) then
        raise exception 'BAD_GAMES: more games than the best-of allows';
      end if;
      for v_game in select * from jsonb_array_elements(p_games) loop
        if jsonb_typeof(v_game) <> 'object'
           or jsonb_typeof(v_game -> 'a') not in ('number')
           or jsonb_typeof(v_game -> 'b') not in ('number')
           or (v_game ->> 'a')::numeric <> floor((v_game ->> 'a')::numeric)
           or (v_game ->> 'b')::numeric <> floor((v_game ->> 'b')::numeric)
           or (v_game ->> 'a')::numeric < 0
           or (v_game ->> 'b')::numeric < 0 then
          raise exception 'BAD_GAMES: each game needs non-negative integer a/b scores';
        end if;
        if v_a >= v_majority or v_b >= v_majority then
          raise exception 'BAD_GAMES: the rubber was decided before game %', v_a + v_b + 1;
        end if;
        if (v_game ->> 'a')::numeric > (v_game ->> 'b')::numeric then
          v_a := v_a + 1;
        elsif (v_game ->> 'b')::numeric > (v_game ->> 'a')::numeric then
          v_b := v_b + 1;
        end if;
      end loop;
    end;
  elsif p_games is not null then
    for v_game in select * from jsonb_array_elements(p_games) loop
      if jsonb_typeof(v_game) <> 'object'
         or jsonb_typeof(v_game -> 'a') not in ('number')
         or jsonb_typeof(v_game -> 'b') not in ('number')
         or (v_game ->> 'a')::numeric <> floor((v_game ->> 'a')::numeric)
         or (v_game ->> 'b')::numeric <> floor((v_game ->> 'b')::numeric)
         or (v_game ->> 'a')::numeric < 0
         or (v_game ->> 'b')::numeric < 0 then
        raise exception 'BAD_GAMES: each game needs non-negative integer a/b scores';
      end if;
    end loop;
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
