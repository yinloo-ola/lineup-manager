import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_BEST_OF,
  bothLineupsSubmitted,
  parseBestOf,
  validateGames,
  type GameScore,
  type Side
} from '@/domain/results'
import { parseStatus } from '@/services/adminScope'
import type { LineupStatus } from '@/domain/types'

/** A typed guard rejection from the results entry path (mapped to UI toasts). */
export class ResultEntryError extends Error {}

/** One stored rubber result row, camelCase for the UI. */
export interface StoredRubberResult {
  rubberIndex: number
  playerIds: [unknown, unknown]
  games: GameScore[]
  walkover: boolean
  walkoverSide: Side | null
}

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
    games: GameScore[]
    walkover: boolean
    walkoverSide?: Side | null
    /** The tie's best-of, for entry-time decidedness validation. */
    bestOf?: number
  }
): Promise<void> {
  // Entry-time validation runs here too — the dialogs validate for UX, but the
  // service is the seam every admin save crosses, so the rules live here.
  if (input.walkover && input.walkoverSide !== 'a' && input.walkoverSide !== 'b') {
    throw new ResultEntryError('A walkover needs its winning side.')
  }
  const violations = input.walkover
    ? validateGames([], input.bestOf ?? DEFAULT_BEST_OF, true, input.walkoverSide ?? undefined)
    : validateGames(input.games, input.bestOf ?? DEFAULT_BEST_OF)
  if (violations.length > 0) {
    throw new ResultEntryError(violations[0].message)
  }

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
    status: parseStatus(l.status) as LineupStatus
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
      walkover: input.walkover,
      walkover_side: input.walkover ? (input.walkoverSide ?? null) : null
    },
    { onConflict: 'tie_id,rubber_index' }
  )
  if (error) throw error
}

/**
 * The umpire's save of one rubber's result, through the upsert_umpire_result
 * security-definer RPC (migration 0018–0020): the server re-checks the
 * tournament scope, the entry gate, the rubber bounds and the games shape, and
 * derives the stored player identity from the submitted lineups — the client
 * cannot write player_ids. Wrapped here so the RPC seam has one error path.
 */
export async function upsertUmpireResult(
  client: SupabaseClient,
  input: {
    tieId: string
    rubberIndex: number
    games: GameScore[]
    walkover: boolean
    walkoverSide?: Side | null
  }
): Promise<void> {
  const { error } = await client.rpc('upsert_umpire_result', {
    p_tie_id: input.tieId,
    p_rubber_index: input.rubberIndex,
    p_games: input.games,
    p_walkover: input.walkover,
    p_walkover_side: input.walkover ? (input.walkoverSide ?? null) : null
  })
  if (error) throw error
}

/**
 * Everything the admin results dialog needs for one tournament's group ties:
 * per tie — best-of, rubber count, the submitted-lineups player prefill (per
 * rubber, per side) and the stored results. Loaded in one go when the
 * dashboard mounts so opening a dialog is instant.
 */
export interface TieResultContext {
  tieId: string
  teamIds: [string | null, string | null]
  bestOf: number
  rubberCount: number
  /** Submitted-lineup player ids per rubber per side (null slot = none). */
  prefill: [((string[] | null) | undefined)[], ((string[] | null) | undefined)[]]
  stored: StoredRubberResult[]
}

export async function loadTieResultContexts(
  client: SupabaseClient,
  tournamentId: string
): Promise<Map<string, TieResultContext>> {
  const [tiesRes, lineupsRes, formatsRes, resultsRes] = await Promise.all([
    client
      .from('ties')
      .select('id, team_a, team_b, is_knockout, category_id, best_of')
      .eq('tournament_id', tournamentId),
    client
      .from('lineups')
      .select('tie_id, team_id, status, player_ids')
      .eq('tournament_id', tournamentId),
    client.from('tie_formats').select('category_id, rubbers').eq('tournament_id', tournamentId),
    client
      .from('rubber_results')
      .select('tie_id, rubber_index, player_ids, games, walkover, walkover_side')
      .eq('tournament_id', tournamentId)
  ])
  for (const r of [tiesRes, lineupsRes, formatsRes, resultsRes]) {
    if (r.error) throw r.error
  }

  const rubberCountByCategory = new Map<string, number>()
  for (const f of (formatsRes.data as { category_id: string; rubbers: unknown }[]) ?? []) {
    if (Array.isArray(f.rubbers)) rubberCountByCategory.set(f.category_id, f.rubbers.length)
  }

  const prefillByTie = new Map<string, { a: (string[] | null)[]; b: (string[] | null)[] }>()
  const teamByTie = new Map<string, [string | null, string | null]>()
  for (const t of (tiesRes.data as Record<string, unknown>[]) ?? []) {
    teamByTie.set(t.id as string, [t.team_a as string | null, t.team_b as string | null])
  }
  for (const l of (lineupsRes.data as Record<string, unknown>[]) ?? []) {
    if (l.status !== 'submitted') continue
    const tieId = l.tie_id as string
    const teams = teamByTie.get(tieId)
    if (!teams) continue
    const side = l.team_id === teams[0] ? 'a' : l.team_id === teams[1] ? 'b' : null
    if (side === null) continue
    const entry = prefillByTie.get(tieId) ?? { a: [], b: [] }
    entry[side] = (l.player_ids as (string[] | null)[]) ?? []
    prefillByTie.set(tieId, entry)
  }

  const storedByTie = new Map<string, StoredRubberResult[]>()
  for (const r of (resultsRes.data as Record<string, unknown>[]) ?? []) {
    const tieId = r.tie_id as string
    const arr = storedByTie.get(tieId) ?? []
    arr[(r.rubber_index as number) - 1] = {
      rubberIndex: r.rubber_index as number,
      playerIds: (r.player_ids as [unknown, unknown]) ?? [null, null],
      games: (r.games as GameScore[]) ?? [],
      walkover: (r.walkover as boolean) ?? false,
      walkoverSide: (r.walkover_side as Side | null) ?? null
    }
    storedByTie.set(tieId, arr)
  }

  const byTie = new Map<string, TieResultContext>()
  for (const t of (tiesRes.data as Record<string, unknown>[]) ?? []) {
    const tieId = t.id as string
    if (t.is_knockout) continue // knockout entry arrives in slice 3
    const rubberCount = rubberCountByCategory.get(t.category_id as string) ?? 0
    const prefill = prefillByTie.get(tieId) ?? { a: [], b: [] }
    byTie.set(tieId, {
      tieId,
      teamIds: [t.team_a as string | null, t.team_b as string | null],
      bestOf: (t.best_of as number | null) ?? 5,
      rubberCount,
      prefill: [prefill.a, prefill.b],
      stored: storedByTie.get(tieId) ?? []
    })
  }
  return byTie
}
