// The Provision managers page's reads/writes (ticket #17): the per-team list
// fed by the seeded manager email, and the email correction write. Account
// creation itself goes through the provision-manager edge function (service
// role lives server-side only). Admin RLS sees all rows; queries are scoped.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProvisionTeam } from '@/domain/provisionView'

interface TeamRow {
  id: string
  name: string
  manager_email: string | null
}
interface ManagerRow {
  team_id: string
  user_id: string
  must_change_password: boolean
}

/** Every team of the tournament with its seeded manager email and the linked
 *  manager account's state (null account = not provisioned yet).
 *  team_managers carries no tournament dimension (it keys on the bare team id,
 *  ADR 0001), so it is scoped through the tournament's team ids. */
export async function fetchProvisionTeams(
  client: SupabaseClient,
  tournamentId: string
): Promise<ProvisionTeam[]> {
  const teamsRes = await client
    .from('teams')
    .select('id, name, manager_email')
    .eq('tournament_id', tournamentId)
    .order('name')
  if (teamsRes.error) throw teamsRes.error
  const teams = (teamsRes.data as TeamRow[] | null) ?? []
  if (teams.length === 0) return []

  const managersRes = await client
    .from('team_managers')
    .select('team_id, user_id, must_change_password')
    .in(
      'team_id',
      teams.map((t) => t.id)
    )
  if (managersRes.error) throw managersRes.error
  const managerByTeam = new Map(
    ((managersRes.data as ManagerRow[] | null) ?? []).map((m) => [m.team_id, m])
  )
  return teams.map((t) => {
    const m = managerByTeam.get(t.id)
    return {
      teamId: t.id,
      teamName: t.name,
      managerEmail: t.manager_email ?? null,
      managerUserId: m?.user_id ?? null,
      mustChangePassword: m?.must_change_password ?? false
    }
  })
}

/** Persist an admin's correction of a team's seeded manager email. */
export async function updateTeamManagerEmail(
  client: SupabaseClient,
  tournamentId: string,
  teamId: string,
  email: string
): Promise<void> {
  const { error } = await client
    .from('teams')
    .update({ manager_email: email })
    .eq('tournament_id', tournamentId)
    .eq('id', teamId)
  if (error) throw error
}
