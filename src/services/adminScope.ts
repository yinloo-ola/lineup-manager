// Shared read-model for the admin's tournament-scoped surfaces: everything the
// lineup re-validation seam (buildAdminLineupRows and its consumers — the
// Matches dashboard, the format guard's impact preview) needs about one
// tournament, mapped snake_case → camelCase. Admin RLS sees all rows; every
// query is scoped to the tournament.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AdminLineupInput, AdminTieInput } from '@/domain/adminView'
import { parseTieFormat } from '@/domain/tieFormat'
import type { LineupStatus, Player, TieFormat } from '@/domain/types'

export interface AdminScopeData {
  lineups: AdminLineupInput[]
  ties: AdminTieInput[]
  teamNameById: Map<string, string>
  categoryNameById: Map<string, string>
  leadTimeByCategory: Map<string, number>
  formatByCategory: Map<string, TieFormat>
  rosterByTeam: Map<string, Player[]>
  /** Tournament start date ('as of tournament start' age anchor); null = none. */
  tournamentStart: string | null
}

interface LineupDbRow {
  tie_id: string
  team_id: string
  status: string
  player_ids: unknown
  submitted_at: string | null
  updated_at: string
  updated_by: string | null
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
  is_knockout: boolean | null
  placed_match_id: string | null
}
interface TeamDbRow {
  id: string
  name: string
}
interface PlayerDbRow {
  id: string
  team_id: string
  name: string
  gender: string
  date_of_birth: string
}
interface FormatDbRow {
  category_id: string
  rubbers: unknown
  usage_policy: unknown
  lead_time_minutes: number
}

const STATUSES: LineupStatus[] = ['not-started', 'draft', 'submitted', 'invalidated']

/** Coerce a stored status string into the domain union (unknown → draft). */
export function parseStatus(status: string): LineupStatus {
  return STATUSES.includes(status as LineupStatus) ? (status as LineupStatus) : 'draft'
}

/** Load the admin read-model for one tournament. */
export async function fetchAdminScopeData(
  client: SupabaseClient,
  tournamentId: string
): Promise<AdminScopeData> {
  const [lineupsRes, teamsRes, tiesRes, catsRes, formatsRes, playersRes, tourRes] = await Promise.all([
    client.from('lineups').select('tie_id, team_id, status, player_ids, submitted_at, updated_at, updated_by').eq('tournament_id', tournamentId),
    client.from('teams').select('id, name').eq('tournament_id', tournamentId),
    client.from('ties').select('id, category_id, scheduled_start, table_label, group_label, round_label, team_a, team_b, is_knockout, placed_match_id').eq('tournament_id', tournamentId),
    client.from('categories').select('id, name').eq('tournament_id', tournamentId),
    client.from('tie_formats').select('category_id, rubbers, usage_policy, lead_time_minutes').eq('tournament_id', tournamentId),
    client.from('players').select('id, team_id, name, gender, date_of_birth').eq('tournament_id', tournamentId),
    client.from('tournaments').select('start_date').eq('id', tournamentId).maybeSingle()
  ])
  for (const r of [lineupsRes, teamsRes, tiesRes, catsRes, formatsRes, playersRes, tourRes]) {
    if (r.error) throw r.error
  }

  const lineups: AdminLineupInput[] = ((lineupsRes.data as LineupDbRow[] | null) ?? []).map((l) => ({
    tieId: l.tie_id,
    teamId: l.team_id,
    status: parseStatus(l.status),
    playerIds: Array.isArray(l.player_ids) ? (l.player_ids as (string[] | null)[]) : [],
    submittedAt: l.submitted_at,
    updatedAt: l.updated_at,
    updatedBy: l.updated_by ?? null
  }))
  const ties: AdminTieInput[] = ((tiesRes.data as TieDbRow[] | null) ?? []).map((t) => ({
    tieId: t.id,
    categoryId: t.category_id,
    scheduledStart: t.scheduled_start,
    table: t.table_label ?? undefined,
    group: t.group_label ?? undefined,
    round: t.round_label ?? undefined,
    teamIds: [t.team_a, t.team_b],
    isKnockout: t.is_knockout ?? false,
    placedMatchId: t.placed_match_id
  }))
  const formats = (formatsRes.data as FormatDbRow[] | null) ?? []
  const rosterByTeam = new Map<string, Player[]>()
  for (const p of (playersRes.data as PlayerDbRow[] | null) ?? []) {
    const arr = rosterByTeam.get(p.team_id) ?? []
    arr.push({ id: p.id, name: p.name, gender: p.gender, dateOfBirth: p.date_of_birth })
    rosterByTeam.set(p.team_id, arr)
  }

  return {
    lineups,
    ties,
    teamNameById: new Map(((teamsRes.data as TeamDbRow[] | null) ?? []).map((t) => [t.id, t.name])),
    categoryNameById: new Map(
      ((catsRes.data as { id: string; name: string }[] | null) ?? []).map((c) => [c.id, c.name])
    ),
    leadTimeByCategory: new Map(formats.map((f) => [f.category_id, f.lead_time_minutes])),
    formatByCategory: new Map(
      formats.map((f) => [
        f.category_id,
        parseTieFormat({
          rubbers: f.rubbers,
          usagePolicy: f.usage_policy ?? undefined,
          leadTimeMinutes: f.lead_time_minutes
        })
      ])
    ),
    rosterByTeam,
    tournamentStart:
      (tourRes.data as { start_date: string | null } | null)?.start_date ?? null
  }
}
