// Bracket-module DB actions (ko-import spec §6) — thin, guard-checked writes
// over the pure domain module. Every action is a single-row (or single
// statement) update: fed sides are DERIVED, never stored, so the bracket
// cannot drift and no multi-row transaction is needed. The one two-statement
// action is cascadeClear (clear winners, then remove departed lineups) — both
// statements are idempotent, and a stale lineup for a departed team is
// invisible to every read path (sides derive without it). Runs as the admin
// (RLS: managers hold no update policy on ties and no delete on lineups).

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  byeAdvances,
  buildBracketSnapshot,
  canClearTeam,
  canEnterTeam,
  canPlaceMatch,
  canToggleWinner,
  clearTeamPatch,
  planCascade,
  type BracketSnapshot,
  type BracketTieRow,
  type CascadePlan
} from '@/domain/bracket'

/** Thrown when an un-pick requires the cascade confirmation; carries the plan
 *  the UI shows before the admin confirms and calls {@link cascadeClear}. */
export class CascadeNeededError extends Error {
  constructor(public readonly plan: CascadePlan) {
    super('This correction rewinds the bracket — confirm the cascade first.')
    this.name = 'CascadeNeededError'
  }
}

interface TieDbRow {
  id: string
  category_id: string
  scheduled_start: string | null
  table_label: string | null
  group_label: string | null
  round_label: string | null
  team_a: string | null
  team_b: string | null
  fed_by_a: string | null
  fed_by_b: string | null
  winner_side: 'a' | 'b' | null
  placed_match_id: string | null
  is_knockout: boolean
  bracket_slot: number | null
}
interface LineupDbRow {
  tie_id: string
  team_id: string
  status: string
}
interface TeamDbRow {
  id: string
  name: string
}

export interface BracketLoad {
  snapshot: BracketSnapshot
  teamNameById: Map<string, string>
}

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

/** Load one category's bracket snapshot (derived read-model) + team names. */
export async function fetchBracket(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string
): Promise<BracketLoad> {
  const [tiesRes, lineupsRes, teamsRes] = await Promise.all([
    client
      .from('ties')
      .select(
        'id, category_id, scheduled_start, table_label, group_label, round_label, team_a, team_b, fed_by_a, fed_by_b, winner_side, placed_match_id, is_knockout, bracket_slot'
      )
      .eq('tournament_id', tournamentId)
      .eq('category_id', categoryId),
    client.from('lineups').select('tie_id, team_id, status').eq('tournament_id', tournamentId),
    client.from('teams').select('id, name').eq('tournament_id', tournamentId)
  ])
  check(tiesRes.error)
  check(lineupsRes.error)
  check(teamsRes.error)

  const rows: BracketTieRow[] = ((tiesRes.data as TieDbRow[] | null) ?? []).map((t) => ({
    id: t.id,
    categoryId: t.category_id,
    scheduledStart: t.scheduled_start,
    tableLabel: t.table_label,
    groupLabel: t.group_label,
    roundLabel: t.round_label,
    teamA: t.team_a,
    teamB: t.team_b,
    fedByA: t.fed_by_a,
    fedByB: t.fed_by_b,
    winnerSide: t.winner_side,
    placedMatchId: t.placed_match_id,
    isKnockout: t.is_knockout,
    bracketSlot: t.bracket_slot
  }))
  const lineups = ((lineupsRes.data as LineupDbRow[] | null) ?? []).map((l) => ({
    tieId: l.tie_id,
    teamId: l.team_id,
    status: l.status
  }))
  return {
    snapshot: buildBracketSnapshot(rows, lineups),
    teamNameById: new Map(((teamsRes.data as TeamDbRow[] | null) ?? []).map((t) => [t.id, t.name]))
  }
}

/** Enter a team onto an entry-round side (guards: same category, one KO slot
 *  per team, side free, slot undecided). Single-row update. */
export async function enterTeam(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  slotId: string,
  side: 0 | 1,
  teamId: string
): Promise<void> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const guard = canEnterTeam(snapshot, slotId, side, teamId)
  if (!guard.ok) throw new Error(`Cannot enter team: ${guard.reason}`)
  const { error } = await client
    .from('ties')
    .update(side === 0 ? { team_a: teamId } : { team_b: teamId })
    .eq('tournament_id', tournamentId)
    .eq('id', slotId)
  check(error)
}

/** Remove an entered team (✕). A placed slot always holds two teams, so any
 *  clear drops it below two — the patch releases the placement in the SAME
 *  single-row update (pool match returns to the pool; the slot may degrade
 *  to bye-pending). */
export async function clearTeam(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  slotId: string,
  side: 0 | 1
): Promise<void> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const guard = canClearTeam(snapshot, slotId, side)
  if (!guard.ok) throw new Error(`Cannot remove team: ${guard.reason}`)
  const { error } = await client
    .from('ties')
    .update(clearTeamPatch(snapshot, slotId, side))
    .eq('tournament_id', tournamentId)
    .eq('id', slotId)
  check(error)
}

/** Place an unplaced pool match onto a two-team entry slot. Single-row update. */
export async function placeMatch(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  slotId: string,
  poolMatchId: string
): Promise<void> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const guard = canPlaceMatch(snapshot, slotId, poolMatchId)
  if (!guard.ok) throw new Error(`Cannot place match: ${guard.reason}`)
  const { error } = await client
    .from('ties')
    .update({ placed_match_id: poolMatchId })
    .eq('tournament_id', tournamentId)
    .eq('id', slotId)
  check(error)
}

/** The winner toggle: pick when undecided; un-pick by clicking the selected
 *  side again — instantly when nothing downstream moved, else a
 *  {@link CascadeNeededError} carrying the plan to confirm. */
export async function toggleWinner(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  slotId: string,
  side: 0 | 1
): Promise<void> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const guard = canToggleWinner(snapshot, slotId, side)
  if (!guard.ok) {
    if ('cascade' in guard) throw new CascadeNeededError(guard.cascade)
    throw new Error(`Cannot select winner: ${guard.reason}`)
  }
  const winnerSide = guard.action === 'pick' ? (side === 0 ? 'a' : 'b') : null
  const { error } = await client
    .from('ties')
    .update({ winner_side: winnerSide })
    .eq('tournament_id', tournamentId)
    .eq('id', slotId)
  check(error)
}

/** Execute a confirmed cascade: clear the origin's and every downstream
 *  winner, remove the lineups of sides that depart (teams that survive keep
 *  theirs). Idempotent. The instant (non-cascade) un-pick goes through
 *  toggleWinner — the guard routes it before the UI ever gets here. */
export async function cascadeClear(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  slotId: string
): Promise<CascadePlan> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const plan = planCascade(snapshot, slotId)
  if (plan.clearedWinners.length > 0) {
    const { error } = await client
      .from('ties')
      .update({ winner_side: null })
      .eq('tournament_id', tournamentId)
      .in('id', plan.clearedWinners)
    check(error)
  }
  if (plan.removedLineups.length > 0) {
    const orFilter = plan.removedLineups
      .map((l) => `and(tie_id.eq.${l.tieId},team_id.eq.${l.teamId})`)
      .join(',')
    const { error } = await client
      .from('lineups')
      .delete()
      .eq('tournament_id', tournamentId)
      .or(orFilter)
    check(error)
  }
  return plan
}

/** Advance the round's byes once balanced: each lone entry slot's team is
 *  written as its slot's winner (feeding the next round). Idempotent. */
export async function advanceByes(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string
): Promise<number> {
  const { snapshot } = await fetchBracket(client, tournamentId, categoryId)
  const advances = byeAdvances(snapshot)
  for (const winnerSide of ['a', 'b'] as const) {
    const ids = advances.filter((a) => a.winnerSide === winnerSide).map((a) => a.slotId)
    if (ids.length === 0) continue
    const { error } = await client
      .from('ties')
      .update({ winner_side: winnerSide })
      .eq('tournament_id', tournamentId)
      .in('id', ids)
    check(error)
  }
  return advances.length
}
