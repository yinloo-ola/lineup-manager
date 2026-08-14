import type { SupabaseClient } from '@supabase/supabase-js'
import { ageOn } from '@/domain/age'
import { buildManagerTieRows, type ManagerTieInput, type ManagerTieRow } from '@/domain/managerView'

export interface RosterPlayer {
  id: string
  name: string
  gender: string
  dateOfBirth: string
  age: number
}

export interface ManagerData {
  myTeamName: string
  roster: RosterPlayer[]
  tieRows: ManagerTieRow[]
}

interface PlayerRow {
  id: string
  name: string
  gender: string
  date_of_birth: string
}
interface TieRow {
  id: string
  category_id: string
  scheduled_start: string
  table_label: string | null
  team_a: string
  team_b: string
}
interface LineupRow {
  tie_id: string
  status: string
}
interface FormatRow {
  category_id: string
  lead_time_minutes: number
}
interface TeamRow {
  id: string
  name: string
}

function check(error: unknown): void {
  if (error) throw error
}

/** Fetch the signed-in manager's roster and tie list (own data only, via RLS). */
export async function fetchManagerData(
  client: SupabaseClient,
  teamId: string
): Promise<ManagerData> {
  // The manager's one tournament (RLS: they see exactly their own) scopes the
  // reads that aren't already team-confined — tie formats and the team-name map
  // used for opponent labels.
  const { data: tournamentId, error: tourErr } = await client.rpc('manager_tournament_id')
  check(tourErr)
  const tourId = (tournamentId as string | null) ?? ''

  const [playersRes, tiesRes, lineupsRes, formatsRes, teamsRes] = await Promise.all([
    client.from('players').select('id, name, gender, date_of_birth').eq('team_id', teamId),
    client
      .from('ties')
      .select('id, category_id, scheduled_start, table_label, team_a, team_b')
      .or(`team_a.eq.${teamId},team_b.eq.${teamId}`),
    client.from('lineups').select('tie_id, status').eq('team_id', teamId),
    client
      .from('tie_formats')
      .select('category_id, lead_time_minutes')
      .eq('tournament_id', tourId),
    client
      .from('teams')
      .select('id, name')
      .eq('tournament_id', tourId)
  ])
  check(playersRes.error)
  check(tiesRes.error)
  check(lineupsRes.error)
  check(formatsRes.error)
  check(teamsRes.error)

  const today = new Date().toISOString().slice(0, 10)
  const roster: RosterPlayer[] = (playersRes.data as PlayerRow[] | null ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    gender: p.gender,
    dateOfBirth: p.date_of_birth,
    age: ageOn(p.date_of_birth, today)
  }))

  const tieInputs: ManagerTieInput[] = (tiesRes.data as TieRow[] | null ?? []).map((t) => ({
    id: t.id,
    categoryId: t.category_id,
    scheduledStart: t.scheduled_start,
    teamIds: [t.team_a, t.team_b]
  }))
  const statusByTie = new Map(
    (lineupsRes.data as LineupRow[] | null ?? []).map((l) => [l.tie_id, l.status] as const)
  )
  const leadTimeByCategory = new Map(
    (formatsRes.data as FormatRow[] | null ?? []).map((f) => [f.category_id, f.lead_time_minutes])
  )
  const teamNameById = new Map(
    (teamsRes.data as TeamRow[] | null ?? []).map((t) => [t.id, t.name])
  )

  const tieRows = buildManagerTieRows({
    ties: tieInputs,
    myTeamId: teamId,
    teamNameById,
    leadTimeByCategory,
    statusByTie: statusByTie as Map<string, ManagerTieRow['status']>,
    now: new Date().toISOString()
  })

  return { myTeamName: teamNameById.get(teamId) ?? teamId, roster, tieRows }
}
