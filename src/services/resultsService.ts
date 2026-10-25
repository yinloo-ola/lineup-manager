import type { SupabaseClient } from '@supabase/supabase-js'
import { bothLineupsSubmitted, parseBestOf } from '@/domain/results'

/** A typed guard rejection from the results entry path (mapped to UI toasts). */
export class ResultEntryError extends Error {}

/**
 * Set a tie's best-of-games value (admin, per-tie override of the import
 * default 5). Domain validation runs first — an even or non-positive value is
 * refused before any write (the DB check constraint backs this server-side).
 */
export async function setTieBestOf(
  client: SupabaseClient,
  tieId: string,
  bestOf: unknown
): Promise<void> {
  const value = parseBestOf(bestOf)
  const { error } = await client.from('ties').update({ best_of: value }).eq('id', tieId)
  if (error) throw error
}

/**
 * The admin's direct save of one rubber's result. Same entry gate as the
 * umpire path (both lineups submitted, enforced here against live lineup rows
 * — not just the UI), and group ties only: knockout entry arrives in slice 3
 * with the winner cascade.
 */
export async function saveRubberResult(
  client: SupabaseClient,
  input: {
    tieId: string
    rubberIndex: number
    /** Per-side player id arrays (admin override — umpires ride the RPC). */
    playerIds: [unknown, unknown]
    games: unknown
    walkover: boolean
  }
): Promise<void> {
  const tieRes = await client
    .from('ties')
    .select('tournament_id, team_a, team_b, is_knockout')
    .eq('id', input.tieId)
    .maybeSingle()
  if (tieRes.error) throw tieRes.error
  const tie = tieRes.data as
    | { tournament_id: string; team_a: string | null; team_b: string | null; is_knockout: boolean | null }
    | null
  if (!tie) throw new ResultEntryError('Tie not found.')
  if (tie.is_knockout) {
    throw new ResultEntryError('Knockout results are not enterable yet — group ties only for now.')
  }
  if (tie.team_a === null || tie.team_b === null) {
    throw new ResultEntryError('Both sides must be known before results can be entered.')
  }

  const lineupsRes = await client
    .from('lineups')
    .select('team_id, status')
    .eq('tie_id', input.tieId)
  if (lineupsRes.error) throw lineupsRes.error
  const lineups = ((lineupsRes.data as { team_id: string; status: string }[]) ?? []).map((l) => ({
    teamId: l.team_id,
    status: l.status as 'submitted'
  }))
  if (!bothLineupsSubmitted(lineups, [tie.team_a, tie.team_b])) {
    throw new ResultEntryError('Both lineups must be submitted before results can be entered.')
  }

  const { error } = await client.from('rubber_results').upsert(
    {
      tournament_id: tie.tournament_id,
      tie_id: input.tieId,
      rubber_index: input.rubberIndex,
      player_ids: input.playerIds,
      games: input.games,
      walkover: input.walkover
    },
    { onConflict: 'tie_id,rubber_index' }
  )
  if (error) throw error
}
