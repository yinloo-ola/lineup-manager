import type { SupabaseClient } from '@supabase/supabase-js'
import type { SeedFile, SeedTie } from '@/domain/seed'
import { resolveStartDate } from '@/domain/seed'
import { nameClashes } from '@/domain/tournamentManage'

// The case-folded clash rule lives in the domain (shared with the rename path);
// re-exported here for the import view + tests.
export { nameClashes }

/**
 * DB-row payloads derived from a parsed seed (camelCase domain -> snake_case columns),
 * each stamped with the importing tournament's id and carrying freshly-minted ids.
 * Pure mapping — the only thing worth unit-testing in the import path.
 */
export interface TablePayloads {
  categories: { id: string; tournament_id: string; name: string; short_name: string }[]
  teams: {
    id: string
    tournament_id: string
    name: string
    club: string | null
    manager_email: string
  }[]
  players: {
    id: string
    tournament_id: string
    team_id: string
    name: string
    gender: string
    date_of_birth: string
  }[]
  ties: {
    id: string
    tournament_id: string
    category_id: string
    scheduled_start: string | null
    table_label: string | null
    group_label: string | null
    round_label: string | null
    team_a: string | null
    team_b: string | null
    fed_by_a: string | null
    fed_by_b: string | null
    winner_side: null
    is_knockout: boolean
    placed_match_id: string | null
  }[]
}

/** A fresh, globally-unique id for one imported row. Injectable for tests. */
export type IdFactory = () => string

/** The default id source: a cryptographically-unique id (browser + Node ≥ 19). */
const defaultIdFactory: IdFactory = () => globalThis.crypto.randomUUID()

/** The positional slot-id scheme for a bracket round (producer and consumer
 *  agree on it): `<shortName>|ko|LABEL|n`, 1-based. */
function slotId(shortName: string, label: string, n: number): string {
  return `${shortName}|ko|${label}|${n}`
}

/**
 * Assign a fresh id to every seed entity, returning a seed-id -> fresh-id map.
 * Callers re-link references (player->team, tie->category/teams, KO feeds->slots)
 * through the map. Pure given the id factory. Bracket slots are minted FIRST:
 * a fed tie's id IS its slot id, so both resolve to one minted row id.
 */
export function buildIdMap(seed: SeedFile, idFactory: IdFactory): Map<string, string> {
  const map = new Map<string, string>()
  for (const c of seed.categories) map.set(c.id, idFactory())
  for (const t of seed.teams) map.set(t.id, idFactory())
  for (const p of seed.players) map.set(p.id, idFactory())
  const shortNameByCategoryId = new Map(seed.categories.map((c) => [c.id, c.shortName] as const))
  for (const bracket of seed.brackets ?? []) {
    const shortName = shortNameByCategoryId.get(bracket.categoryId)
    if (shortName === undefined) continue // parseSeed guarantees resolution
    for (const round of bracket.rounds) {
      for (let n = 1; n <= round.slots; n++) {
        map.set(slotId(shortName, round.label, n), idFactory())
      }
    }
  }
  for (const t of seed.ties) {
    if (map.has(t.id)) {
      // A fed tie's id IS its slot id (minted above); any other collision
      // would silently merge two rows into one id — refuse loudly.
      if (!('fedBy' in t)) {
        throw new Error(`Seed tie id "${t.id}" collides with a derived bracket slot id.`)
      }
      continue
    }
    map.set(t.id, idFactory())
  }
  return map
}

/**
 * Map a validated seed to the row shapes each table expects, stamping
 * `tournament_id` on every row and remapping every id (including FK references)
 * through {@link idMap}. Pure.
 */
export function toTablePayloads(
  seed: SeedFile,
  tournamentId: string,
  idMap: Map<string, string>
): TablePayloads {
  // Resolve a seed id to its minted replacement. parseSeed guarantees every id
  // (and every FK reference) is covered, so a miss is a real bug — fail loudly.
  const freshId = (seedId: string): string => {
    const minted = idMap.get(seedId)
    if (minted === undefined) throw new Error(`No minted id for seed id "${seedId}"`)
    return minted
  }

  const tieRows: TablePayloads['ties'] = []
  for (const t of seed.ties) {
    const base = {
      tournament_id: tournamentId,
      category_id: freshId(t.categoryId),
      group_label: null as string | null,
      winner_side: null,
      is_knockout: false,
      placed_match_id: null as string | null
    }
    if ('teamIds' in t) {
      tieRows.push({
        ...base,
        id: freshId(t.id),
        scheduled_start: t.scheduledStart,
        table_label: t.table ?? null,
        group_label: t.group,
        round_label: t.round,
        team_a: freshId(t.teamIds[0]),
        team_b: freshId(t.teamIds[1]),
        fed_by_a: null,
        fed_by_b: null,
        is_knockout: false
      })
    } else {
      // Knockout tie — pool (no fedBy: table + time, no position, no teams —
      // the admin places it in the bracket view) or fed later round.
      const feeds = 'fedBy' in t ? t.fedBy : null
      tieRows.push({
        ...base,
        id: freshId(t.id),
        scheduled_start: t.scheduledStart,
        table_label: t.table,
        round_label: t.round,
        team_a: null,
        team_b: null,
        fed_by_a: feeds ? freshId(feeds[0]) : null,
        fed_by_b: feeds ? freshId(feeds[1]) : null,
        is_knockout: true
      })
    }
  }

  // Structural slot rows: every bracket slot exists as a tie row, bye slots
  // included. Slots occupied by a fed tie are emitted above (same minted id,
  // with the schedule); the rest — the entire entry round and any unscheduled
  // later-round slot — carry no schedule and no teams.
  const shortNameByCategoryId = new Map(seed.categories.map((c) => [c.id, c.shortName] as const))
  const fedTieIds = new Set(seed.ties.filter((t): t is Extract<SeedTie, { fedBy: [string, string] }> => 'fedBy' in t).map((t) => t.id))
  for (const bracket of seed.brackets ?? []) {
    const shortName = shortNameByCategoryId.get(bracket.categoryId)!
    for (const round of bracket.rounds) {
      for (let n = 1; n <= round.slots; n++) {
        const seedSlotId = slotId(shortName, round.label, n)
        if (fedTieIds.has(seedSlotId)) continue
        const feeds = round.fedBy?.[n - 1]
        tieRows.push({
          id: freshId(seedSlotId),
          tournament_id: tournamentId,
          category_id: freshId(bracket.categoryId),
          scheduled_start: null,
          table_label: null,
          group_label: null,
          round_label: round.label,
          team_a: null,
          team_b: null,
          fed_by_a: feeds ? freshId(feeds[0]) : null,
          fed_by_b: feeds ? freshId(feeds[1]) : null,
          winner_side: null,
          is_knockout: true,
          placed_match_id: null
        })
      }
    }
  }

  return {
    categories: seed.categories.map((c) => ({
      id: freshId(c.id),
      tournament_id: tournamentId,
      name: c.name,
      short_name: c.shortName
    })),
    teams: seed.teams.map((t) => ({
      id: freshId(t.id),
      tournament_id: tournamentId,
      name: t.name,
      club: t.club ?? null,
      manager_email: t.managerEmail
    })),
    players: seed.players.map((p) => ({
      id: freshId(p.id),
      tournament_id: tournamentId,
      team_id: freshId(p.teamId),
      name: p.name,
      gender: p.gender,
      date_of_birth: p.dateOfBirth
    })),
    ties: tieRows
  }
}

/** The names of every tournament the caller can see (admin: all, via RLS). */
export async function fetchTournamentNames(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from('tournaments').select('name')
  if (error) throw error
  return ((data as { name: string }[] | null) ?? []).map((r) => r.name)
}

/**
 * Import a parsed seed as a BRAND-NEW tournament (never upserts into an existing
 * one). Creates the tournament under `resolvedName`, mints fresh ids for every
 * child row, and stamps the tournament's id onto each. Runs as the signed-in
 * admin (RLS permits writes via is_admin()). On any failure the tournament row
 * is deleted (cascade-clearing any partial children) so no orphan is left.
 *
 * Why fresh ids? Child ids only need to be unique *within* a tournament, but the
 * schema still enforces a global `id` PK (the composite `(tournament_id, id)`
 * key lands in #16, the contract step). So each import mints globally-unique ids
 * — that is what lets the *same* seed import twice as two distinct tournaments
 * today. #16 can later relax this to keep the seed's own ids.
 *
 * Returns the new tournament's id so the caller can select it.
 */
export async function importSeed(
  client: SupabaseClient,
  seed: SeedFile,
  resolvedName: string,
  idFactory: IdFactory = defaultIdFactory
): Promise<{ tournamentId: string }> {
  const tournamentId = idFactory()
  const idMap = buildIdMap(seed, idFactory)
  const payloads = toTablePayloads(seed, tournamentId, idMap)

  // Insert order respects FKs: tournament first, then parents before children.
  const tables: Array<[string, Record<string, unknown>[]]> = [
    ['categories', payloads.categories],
    ['teams', payloads.teams],
    ['players', payloads.players],
    ['ties', payloads.ties]
  ]

  const { error: tourError } = await client.from('tournaments').insert({
    id: tournamentId,
    name: resolvedName.trim(),
    // Seed's own startDate or the earliest team match's day (spec §8).
    start_date: resolveStartDate(seed)
  })
  if (tourError) {
    throw new Error(`Import failed — tournaments: ${tourError.message}`)
  }

  try {
    const errors: string[] = []
    for (const [table, rows] of tables) {
      if (rows.length === 0) continue
      const { error } = await client.from(table).insert(rows)
      if (error) errors.push(`${table}: ${error.message}`)
    }
    if (errors.length > 0) {
      throw new Error(`Import failed — ${errors.join('; ')}`)
    }
  } catch (e) {
    // Best-effort cleanup: drop the half-imported tournament (cascade clears its
    // children) so the admin isn't left with an empty tournament to explain.
    await client.from('tournaments').delete().eq('id', tournamentId)
    throw e
  }

  return { tournamentId }
}
