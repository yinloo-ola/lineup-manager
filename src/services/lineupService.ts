import type { SupabaseClient } from '@supabase/supabase-js'
import { computeCutoff, isLocked } from '@/domain/cutoff'
import {
  buildAdminLineupRows,
  type AdminLineupInput,
  type AdminLineupRow,
  type AdminTieInput
} from '@/domain/adminView'
import { emptyLineupFor } from '@/domain/lineupBuilder'
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
  // Ages default to the tie date; a rubber may override via constraint.asOf.
  const asOf = tie.scheduledStart.slice(0, 10)

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

/** Upsert a lineup row with a given status (RLS: own team; server-side cutoff). */
async function upsertLineup(
  client: SupabaseClient,
  lineup: Lineup,
  status: LineupStatus,
  submittedAt: string | null
): Promise<void> {
  const { error } = await client.from('lineups').upsert(
    {
      tie_id: lineup.tieId,
      team_id: lineup.teamId,
      player_ids: lineup.playerIds,
      status,
      submitted_at: submittedAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'tie_id,team_id' }
  )
  if (error) throw error
}

/**
 * Persist a lineup as a draft. Also serves as Recall (a submitted lineup
 * returned to draft is the same write). Server enforces the cutoff.
 */
export async function saveLineupDraft(client: SupabaseClient, lineup: Lineup): Promise<void> {
  await upsertLineup(client, lineup, 'draft', null)
}

/**
 * Submit a lineup: record status='submitted' + a timestamp. The caller must
 * ensure the lineup is complete + valid (canSubmit); the server enforces the
 * cutoff (refuses at/after — no reopen; admin edits via the admin policy).
 */
export async function submitLineup(client: SupabaseClient, lineup: Lineup): Promise<void> {
  await upsertLineup(client, lineup, 'submitted', new Date().toISOString())
}

interface AdminLineupDbRow {
  tie_id: string
  team_id: string
  status: string
  updated_at: string
  updated_by: string | null
}
interface AdminTieDbRow {
  id: string
  category_id: string
  scheduled_start: string
  team_a: string
  team_b: string
}

/**
 * Every team's lineups with team/opponent/category and the tie's cutoff/locked
 * state — the administrator oversight view. Admin RLS sees all rows.
 */
export async function fetchAdminLineups(client: SupabaseClient): Promise<AdminLineupRow[]> {
  const [lineupsRes, teamsRes, tiesRes, catsRes, formatsRes] = await Promise.all([
    client.from('lineups').select('tie_id, team_id, status, updated_at, updated_by'),
    client.from('teams').select('id, name'),
    client.from('ties').select('id, category_id, scheduled_start, team_a, team_b'),
    client.from('categories').select('id, name'),
    client.from('tie_formats').select('category_id, lead_time_minutes')
  ])
  check(lineupsRes.error)
  check(teamsRes.error)
  check(tiesRes.error)
  check(catsRes.error)
  check(formatsRes.error)

  const lineups: AdminLineupInput[] = (lineupsRes.data as AdminLineupDbRow[] | null ?? []).map(
    (l) => ({
      tieId: l.tie_id,
      teamId: l.team_id,
      status: STATUSES.includes(l.status as LineupStatus) ? (l.status as LineupStatus) : 'draft',
      updatedAt: l.updated_at,
      updatedBy: l.updated_by ?? null
    })
  )
  const ties: AdminTieInput[] = (tiesRes.data as AdminTieDbRow[] | null ?? []).map((t) => ({
    tieId: t.id,
    categoryId: t.category_id,
    scheduledStart: t.scheduled_start,
    teamIds: [t.team_a, t.team_b]
  }))
  const teamNameById = new Map(
    (teamsRes.data as { id: string; name: string }[] | null ?? []).map((t) => [t.id, t.name])
  )
  const categoryNameById = new Map(
    (catsRes.data as { id: string; name: string }[] | null ?? []).map((c) => [c.id, c.name])
  )
  const leadTimeByCategory = new Map(
    (formatsRes.data as { category_id: string; lead_time_minutes: number }[] | null ?? []).map(
      (f) => [f.category_id, f.lead_time_minutes]
    )
  )

  return buildAdminLineupRows({
    lineups,
    ties,
    teamNameById,
    categoryNameById,
    leadTimeByCategory,
    now: new Date().toISOString()
  })
}
