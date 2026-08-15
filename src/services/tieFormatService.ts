import type { SupabaseClient } from '@supabase/supabase-js'
import { breakingLineups, isFormatFrozen, withProposedFormat, type FormatBreak } from '@/domain/formatFreeze'
import { parseTieFormat } from '@/domain/tieFormat'
import type { LineupStatus, Player, TieFormat } from '@/domain/types'

interface StoredRow {
  rubbers: unknown
  usage_policy: unknown
  lead_time_minutes: number
}

/**
 * Load a team event's Tie Format within one tournament (the format is keyed
 * (tournament, team event) since the contract step), parsing/validating the
 * stored jsonb. Null if none authored yet.
 */
export async function loadTieFormat(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string
): Promise<TieFormat | null> {
  const { data, error } = await client
    .from('tie_formats')
    .select('rubbers, usage_policy, lead_time_minutes')
    .eq('tournament_id', tournamentId)
    .eq('category_id', categoryId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as StoredRow
  return parseTieFormat({
    rubbers: row.rubbers,
    usagePolicy: row.usage_policy ?? undefined,
    leadTimeMinutes: row.lead_time_minutes
  })
}

/** Create or replace a team event's Tie Format (idempotent upsert on the
 *  (tournament, team event) key; stamps the NOT NULL tournament_id).
 *  Refuses once the tournament has started — the freeze of spec §6, enforced
 *  here so not even the REST path bypasses the disabled authoring page. */
export async function saveTieFormat(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  fmt: TieFormat
): Promise<void> {
  const tourRes = await client
    .from('tournaments')
    .select('start_date')
    .eq('id', tournamentId)
    .maybeSingle()
  if (tourRes.error) throw tourRes.error
  const startDate = (tourRes.data as { start_date: string | null } | null)?.start_date ?? null
  if (isFormatFrozen(startDate, new Date().toISOString().slice(0, 10))) {
    throw new Error(
      'Team Match Formats are frozen — this tournament has already started (the freeze anchors on its start date).'
    )
  }
  const { error } = await client.from('tie_formats').upsert(
    {
      tournament_id: tournamentId,
      category_id: categoryId,
      rubbers: fmt.rubbers,
      usage_policy: fmt.usagePolicy ?? null,
      lead_time_minutes: fmt.leadTimeMinutes ?? 30
    },
    { onConflict: 'tournament_id,category_id' }
  )
  if (error) throw error
}

interface PreviewLineupRow {
  tie_id: string
  team_id: string
  status: string
  player_ids: unknown
  updated_at: string
  updated_by: string | null
}
interface PreviewTieRow {
  id: string
  category_id: string
  scheduled_start: string
  team_a: string
  team_b: string
}
interface PreviewPlayerRow {
  id: string
  team_id: string
  name: string
  gender: string
  date_of_birth: string
}
interface PreviewFormatRow {
  category_id: string
  rubbers: unknown
  usage_policy: unknown
  lead_time_minutes: number
}

const STATUSES: LineupStatus[] = ['not-started', 'draft', 'submitted', 'invalidated']

/**
 * The guarded pre-start edit's impact preview (spec §6): every submitted lineup
 * the PROPOSED format would break, with its team match — computed by
 * re-validating the tournament's submitted lineups with the proposal in place
 * of the stored format. Admin RLS sees all rows; every query is scoped.
 */
export async function previewFormatImpact(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  proposed: TieFormat
): Promise<FormatBreak[]> {
  const [lineupsRes, teamsRes, tiesRes, formatsRes, playersRes, tourRes] = await Promise.all([
    client.from('lineups').select('tie_id, team_id, status, player_ids, updated_at, updated_by').eq('tournament_id', tournamentId),
    client.from('teams').select('id, name').eq('tournament_id', tournamentId),
    client.from('ties').select('id, category_id, scheduled_start, team_a, team_b').eq('tournament_id', tournamentId),
    client.from('tie_formats').select('category_id, rubbers, usage_policy, lead_time_minutes').eq('tournament_id', tournamentId),
    client.from('players').select('id, team_id, name, gender, date_of_birth').eq('tournament_id', tournamentId),
    client.from('tournaments').select('start_date').eq('id', tournamentId).maybeSingle()
  ])
  for (const r of [lineupsRes, teamsRes, tiesRes, formatsRes, playersRes, tourRes]) {
    if (r.error) throw r.error
  }
  const tournamentStart =
    (tourRes.data as { start_date: string | null } | null)?.start_date ?? null

  const lineups = ((lineupsRes.data as PreviewLineupRow[] | null) ?? []).map((l) => ({
    tieId: l.tie_id,
    teamId: l.team_id,
    status: (STATUSES.includes(l.status as LineupStatus) ? l.status : 'draft') as LineupStatus,
    playerIds: Array.isArray(l.player_ids) ? (l.player_ids as (string[] | null)[]) : [],
    updatedAt: l.updated_at,
    updatedBy: l.updated_by ?? null
  }))
  const ties = ((tiesRes.data as PreviewTieRow[] | null) ?? []).map((t) => ({
    tieId: t.id,
    categoryId: t.category_id,
    scheduledStart: t.scheduled_start,
    teamIds: [t.team_a, t.team_b] as [string, string]
  }))
  const formats = (formatsRes.data as PreviewFormatRow[] | null) ?? []
  const formatByCategory = new Map(
    formats.map((f) => [
      f.category_id,
      parseTieFormat({
        rubbers: f.rubbers,
        usagePolicy: f.usage_policy ?? undefined,
        leadTimeMinutes: f.lead_time_minutes
      })
    ])
  )
  const rosterByTeam = new Map<string, Player[]>()
  for (const p of (playersRes.data as PreviewPlayerRow[] | null) ?? []) {
    const arr = rosterByTeam.get(p.team_id) ?? []
    arr.push({ id: p.id, name: p.name, gender: p.gender, dateOfBirth: p.date_of_birth })
    rosterByTeam.set(p.team_id, arr)
  }

  return breakingLineups(
    withProposedFormat(
      {
        lineups,
        ties,
        teamNameById: new Map(
          ((teamsRes.data as { id: string; name: string }[] | null) ?? []).map((t) => [t.id, t.name])
        ),
        categoryNameById: new Map<string, string>(),
        leadTimeByCategory: new Map(formats.map((f) => [f.category_id, f.lead_time_minutes])),
        rosterByTeam,
        formatByCategory,
        tournamentStart,
        now: new Date().toISOString()
      },
      categoryId,
      proposed
    )
  )
}
