import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCutoff, isLocked } from '@/domain/cutoff'
import { emptyLineupFor, resolveAsOf } from '@/domain/lineupBuilder'
import { loadTieFormat } from '@/services/tieFormatService'
import type { Lineup, LineupStatus, Player, Tie, TieFormat } from '@/domain/types'

/** DB row ↔ domain Lineup mapping. `player_ids` is jsonb: (string[] | null)[]. */
interface LineupRow {
  tie_id: string
  team_id: string
  player_ids: unknown
  status: string
  submitted_at: string | null
  updated_at: string
}
interface TieRow {
  id: string
  category_id: string
  scheduled_start: string
  table_label: string | null
  team_a: string
  team_b: string
}
interface PlayerRow {
  id: string
  name: string
  gender: string
  date_of_birth: string
}
interface TeamRow {
  id: string
  name: string
}

const STATUSES: LineupStatus[] = ['not-started', 'draft', 'submitted', 'invalidated']

function toLineup(row: LineupRow): Lineup {
  const raw = Array.isArray(row.player_ids) ? (row.player_ids as (string[] | null)[]) : []
  return {
    tieId: row.tie_id,
    teamId: row.team_id,
    playerIds: raw,
    status: STATUSES.includes(row.status as LineupStatus) ? (row.status as LineupStatus) : 'draft',
    submittedAt: row.submitted_at ?? undefined,
    updatedAt: row.updated_at
  }
}

/** Adjust a loaded lineup's slots to the current format length (stale-format safety). */
function reconcile(lineup: Lineup, tieFormat: TieFormat): Lineup {
  const expected = tieFormat.rubbers.length
  if (lineup.playerIds.length === expected) return lineup
  const padded = lineup.playerIds.slice(0, expected)
  while (padded.length < expected) padded.push(null)
  return { ...lineup, playerIds: padded }
}

export interface LineupBuilderData {
  tie: Tie
  categoryId: string
  opponentTeamId: string
  opponentName: string
  myTeamName: string
  tieFormat: TieFormat
  roster: Player[]
  lineup: Lineup
  /** Other ties of this team (excluding the one being edited) + their lineups. */
  teamTies: Tie[]
  teamLineups: Lineup[]
  asOf: string
  cutoff: string
  locked: boolean
}

function check(error: unknown): void {
  if (error) throw error
}

/**
 * Load everything the lineup builder needs for one tie: the tie (own only, via
 * RLS), its format, the team roster, the current lineup (or a fresh empty one),
 * and the team's other ties/lineups for cross-slot clash detection.
 */
export async function fetchLineupBuilderData(
  client: SupabaseClient,
  tieId: string,
  teamId: string
): Promise<LineupBuilderData> {
  const [tieRes, playersRes, lineupRes, allTiesRes, allLineupsRes, teamsRes] = await Promise.all([
    client
      .from('ties')
      .select('id, category_id, scheduled_start, table_label, team_a, team_b')
      .eq('id', tieId)
      .maybeSingle(),
    client.from('players').select('id, name, gender, date_of_birth').eq('team_id', teamId),
    client
      .from('lineups')
      .select('tie_id, team_id, player_ids, status, submitted_at, updated_at')
      .eq('tie_id', tieId)
      .eq('team_id', teamId)
      .maybeSingle(),
    client
      .from('ties')
      .select('id, category_id, scheduled_start, table_label, team_a, team_b')
      .or(`team_a.eq.${teamId},team_b.eq.${teamId}`),
    client
      .from('lineups')
      .select('tie_id, team_id, player_ids, status, submitted_at, updated_at')
      .eq('team_id', teamId),
    client.from('teams').select('id, name')
  ])
  check(tieRes.error)
  check(playersRes.error)
  check(lineupRes.error)
  check(allTiesRes.error)
  check(allLineupsRes.error)
  check(teamsRes.error)

  if (!tieRes.data) {
    throw new Error('Tie not found (it may not belong to your team).')
  }
  const tieRow = tieRes.data as TieRow
  const isA = tieRow.team_a === teamId
  const isB = tieRow.team_b === teamId
  if (!isA && !isB) {
    throw new Error('Tie not found (it may not belong to your team).')
  }
  const opponentTeamId = isA ? tieRow.team_b : tieRow.team_a

  const tieFormat = await loadTieFormat(client, tieRow.category_id)
  if (!tieFormat) {
    throw new Error('No Tie Format has been authored for this category yet.')
  }

  const roster: Player[] = (playersRes.data as PlayerRow[] | null ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    dateOfBirth: p.date_of_birth
  }))

  const lineup =
    lineupRes.data != null
      ? reconcile(toLineup(lineupRes.data as LineupRow), tieFormat)
      : emptyLineupFor(tieFormat, tieId, teamId)

  const teamNameById = new Map((teamsRes.data as TeamRow[] | null ?? []).map((t) => [t.id, t.name]))
  const tie: Tie = {
    id: tieRow.id,
    scheduledStart: tieRow.scheduled_start,
    table: tieRow.table_label ?? undefined,
    teamIds: [tieRow.team_a, tieRow.team_b]
  }
  const teamTies: Tie[] = (allTiesRes.data as TieRow[] | null ?? [])
    .filter((t) => t.id !== tieId)
    .map((t) => ({
      id: t.id,
      scheduledStart: t.scheduled_start,
      table: t.table_label ?? undefined,
      teamIds: [t.team_a, t.team_b]
    }))
  const teamLineups: Lineup[] = (allLineupsRes.data as LineupRow[] | null ?? [])
    .filter((l) => l.tie_id !== tieId)
    .map(toLineup)

  const lead = tieFormat.leadTimeMinutes ?? 30
  const cutoff = computeCutoff(tie.scheduledStart, lead)
  const asOf = resolveAsOf({ asOf: undefined }, tie.scheduledStart.slice(0, 10))

  return {
    tie,
    categoryId: tieRow.category_id,
    opponentTeamId,
    opponentName: teamNameById.get(opponentTeamId) ?? opponentTeamId,
    myTeamName: teamNameById.get(teamId) ?? teamId,
    tieFormat,
    roster,
    lineup,
    teamTies,
    teamLineups,
    asOf,
    cutoff,
    locked: isLocked(cutoff, new Date().toISOString())
  }
}

/** Persist a lineup as a draft (RLS: own team only). */
export async function saveLineupDraft(client: SupabaseClient, lineup: Lineup): Promise<void> {
  const { error } = await client.from('lineups').upsert(
    {
      tie_id: lineup.tieId,
      team_id: lineup.teamId,
      player_ids: lineup.playerIds,
      status: 'draft',
      submitted_at: null,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tie_id,team_id' }
  )
  if (error) throw error
}
