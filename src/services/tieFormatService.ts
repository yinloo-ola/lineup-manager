import type { SupabaseClient } from '@supabase/supabase-js'
import { breakingLineups, isFormatFrozen, withProposedFormat, type FormatBreak } from '@/domain/formatFreeze'
import { parseTieFormat } from '@/domain/tieFormat'
import { fetchAdminScopeData } from '@/services/adminScope'
import type { TieFormat } from '@/domain/types'

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
 *  Refuses once the tournament has started — the freeze of spec §6. Every app
 *  save path goes through here; a determined admin could still write via raw
 *  REST (admin RLS is global by design), which the frozen authoring page and
 *  this check both decline to help with. */
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

/**
 * The guarded pre-start edit's impact preview (spec §6): every submitted lineup
 * the PROPOSED format would break, with its team match — computed by
 * re-validating the tournament's submitted lineups with the proposal in place
 * of the stored format.
 */
export async function previewFormatImpact(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  proposed: TieFormat
): Promise<FormatBreak[]> {
  const scope = await fetchAdminScopeData(client, tournamentId)
  return breakingLineups(withProposedFormat({ ...scope, now: new Date().toISOString() }, categoryId, proposed))
}
