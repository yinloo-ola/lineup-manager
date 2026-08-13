import type { SupabaseClient } from '@supabase/supabase-js'
import type { SeedFile } from '@/domain/seed'

/**
 * DB-row payloads derived from a parsed seed (camelCase domain -> snake_case columns).
 * Pure mapping — the only thing worth unit-testing in the import path.
 */
export interface TablePayloads {
  categories: { id: string; name: string; short_name: string }[]
  teams: { id: string; name: string; club: string | null }[]
  players: { id: string; team_id: string; name: string; gender: string; date_of_birth: string }[]
  ties: {
    id: string
    category_id: string
    scheduled_start: string
    table_label: string | null
    team_a: string
    team_b: string
  }[]
}

/** Map a validated seed to the row shapes each table expects. Pure. */
export function toTablePayloads(seed: SeedFile): TablePayloads {
  return {
    categories: seed.categories.map((c) => ({ id: c.id, name: c.name, short_name: c.shortName })),
    teams: seed.teams.map((t) => ({ id: t.id, name: t.name, club: t.club ?? null })),
    players: seed.players.map((p) => ({
      id: p.id,
      team_id: p.teamId,
      name: p.name,
      gender: p.gender,
      date_of_birth: p.dateOfBirth
    })),
    ties: seed.ties.map((t) => ({
      id: t.id,
      category_id: t.categoryId,
      scheduled_start: t.scheduledStart,
      table_label: t.table ?? null,
      team_a: t.teamIds[0],
      team_b: t.teamIds[1]
    }))
  }
}

/**
 * Upsert a parsed seed into Supabase (idempotent by id). Runs as the signed-in
 * admin (RLS permits writes via is_admin()). Throws on any table error.
 */
export async function importSeed(client: SupabaseClient, seed: SeedFile): Promise<void> {
  const payloads = toTablePayloads(seed)
  const tables: Array<[string, Record<string, unknown>[]]> = [
    ['categories', payloads.categories],
    ['teams', payloads.teams],
    ['players', payloads.players],
    ['ties', payloads.ties]
  ]

  const errors: string[] = []
  for (const [table, rows] of tables) {
    if (rows.length === 0) continue
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' })
    if (error) errors.push(`${table}: ${error.message}`)
  }
  if (errors.length > 0) {
    throw new Error(`Import failed — ${errors.join('; ')}`)
  }
}
