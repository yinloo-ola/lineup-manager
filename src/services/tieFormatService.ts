import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTieFormat } from '@/domain/tieFormat'
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
 *  (tournament, team event) key; stamps the NOT NULL tournament_id). */
export async function saveTieFormat(
  client: SupabaseClient,
  tournamentId: string,
  categoryId: string,
  fmt: TieFormat
): Promise<void> {
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
