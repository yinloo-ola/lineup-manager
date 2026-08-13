import type { SupabaseClient } from '@supabase/supabase-js'
import { parseTieFormat } from '@/domain/tieFormat'
import type { TieFormat } from '@/domain/types'

interface StoredRow {
  rubbers: unknown
  usage_policy: unknown
  lead_time_minutes: number
}

/** Load a category's Tie Format, parsing/validating the stored jsonb. Null if none authored yet. */
export async function loadTieFormat(
  client: SupabaseClient,
  categoryId: string
): Promise<TieFormat | null> {
  const { data, error } = await client
    .from('tie_formats')
    .select('rubbers, usage_policy, lead_time_minutes')
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

/** Create or replace a category's Tie Format (idempotent upsert by category_id). */
export async function saveTieFormat(
  client: SupabaseClient,
  categoryId: string,
  fmt: TieFormat
): Promise<void> {
  const { error } = await client.from('tie_formats').upsert(
    {
      category_id: categoryId,
      rubbers: fmt.rubbers,
      usage_policy: fmt.usagePolicy ?? null,
      lead_time_minutes: fmt.leadTimeMinutes ?? 30
    },
    { onConflict: 'category_id' }
  )
  if (error) throw error
}
