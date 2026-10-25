import type { SupabaseClient } from '@supabase/supabase-js'
import { parseBestOf } from '@/domain/results'

/**
 * Set a tie's best-of-games value (admin, per-tie override of the import
 * default 5). Domain validation runs first — an even or non-positive value is
 * refused before any write (the DB check constraint backs this server-side).
 */
export async function setTieBestOf(
  client: SupabaseClient,
  tieId: string,
  bestOf: unknown
): Promise<void> {
  const value = parseBestOf(bestOf)
  const { error } = await client.from('ties').update({ best_of: value }).eq('id', tieId)
  if (error) throw error
}
