import { describe, it, expect } from 'vitest'
import { buildIdMap, nameClashes, toTablePayloads } from '../importSeed'
import { parseSeed, type SeedFile } from '@/domain/seed'

const seed = parseSeed({
  tournamentName: 'Summer Open',
  categories: [{ id: 'c1', name: "Men's Team", shortName: 'MT' }],
  teams: [
    { id: 'tA', name: 'Team A', club: 'Club A' },
    { id: 'tB', name: 'Team B' }
  ],
  players: [{ id: 'p1', teamId: 'tA', name: 'Alice', gender: 'F', dateOfBirth: '1990-01-01' }],
  ties: [
    {
      id: 'tie1',
      categoryId: 'c1',
      scheduledStart: '2026-08-20T10:00',
      table: '1',
      teamIds: ['tA', 'tB']
    }
  ]
})

/** Deterministic id factory: returns <prefix>1, <prefix>2, … in call order. */
function counterFactory(prefix = 'g'): { factory: () => string; nth: (k: number) => string } {
  let n = 0
  return {
    factory: () => `${prefix}${++n}`,
    nth: (k: number) => `${prefix}${k}`
  }
}

describe('nameClashes', () => {
  it('flags an exact match', () => {
    expect(nameClashes('Summer Open', ['Spring', 'Summer Open'])).toBe(true)
  })

  it('is case-insensitive (DB unique is case-sensitive; this is the stricter UX guard)', () => {
    expect(nameClashes('summer open', ['Summer Open'])).toBe(true)
    expect(nameClashes('SUMMER OPEN', ['Summer Open'])).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(nameClashes('  Summer Open  ', ['Summer Open'])).toBe(true)
  })

  it('passes on a genuinely new name', () => {
    expect(nameClashes('Autumn Open', ['Summer Open'])).toBe(false)
    expect(nameClashes('Summer Open', [])).toBe(false)
  })
})

describe('buildIdMap', () => {
  it('assigns a fresh id to every seed entity via the factory', () => {
    const { factory, nth } = counterFactory()
    const map = buildIdMap(seed, factory)
    // Order: categories → teams → players → ties (the FK-safe insert order).
    expect(map.get('c1')).toBe(nth(1))
    expect(map.get('tA')).toBe(nth(2))
    expect(map.get('tB')).toBe(nth(3))
    expect(map.get('p1')).toBe(nth(4))
    expect(map.get('tie1')).toBe(nth(5))
  })

  it('produces globally-unique ids (so the same seed imports twice)', () => {
    const map = buildIdMap(seed, () => Math.random().toString(36).slice(2))
    const values = [...map.values()]
    expect(new Set(values).size).toBe(values.length)
    // Every seed id is covered.
    for (const id of ['c1', 'tA', 'tB', 'p1', 'tie1']) expect(map.has(id)).toBe(true)
  })
})

describe('toTablePayloads', () => {
  const tournamentId = 'tour-xyz'

  it('stamps tournament_id and remaps every id (incl. FK references)', () => {
    const { factory } = counterFactory()
    const idMap = buildIdMap(seed, factory)
    const p = toTablePayloads(seed, tournamentId, idMap)

    expect(p.categories[0]).toEqual({
      id: idMap.get('c1'),
      tournament_id: tournamentId,
      name: "Men's Team",
      short_name: 'MT'
    })
    expect(p.teams).toEqual([
      { id: idMap.get('tA'), tournament_id: tournamentId, name: 'Team A', club: 'Club A' },
      { id: idMap.get('tB'), tournament_id: tournamentId, name: 'Team B', club: null }
    ])
    // player.team_id follows its team's remapped id.
    expect(p.players[0]).toEqual({
      id: idMap.get('p1'),
      tournament_id: tournamentId,
      team_id: idMap.get('tA'),
      name: 'Alice',
      gender: 'F',
      date_of_birth: '1990-01-01'
    })
    // tie.category_id + team_a/team_b all follow the remapped ids.
    expect(p.ties[0]).toEqual({
      id: idMap.get('tie1'),
      tournament_id: tournamentId,
      category_id: idMap.get('c1'),
      scheduled_start: '2026-08-20T10:00',
      table_label: '1',
      team_a: idMap.get('tA'),
      team_b: idMap.get('tB')
    })
  })

  it('nulls out optional fields that were omitted', () => {
    const minimalSeed: SeedFile = parseSeed({
      tournamentName: 'X',
      categories: [{ id: 'c', name: 'C', shortName: 'C' }],
      teams: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' }
      ],
      players: [],
      ties: [
        { id: 'tie', categoryId: 'c', scheduledStart: '2026-01-01T09:00', teamIds: ['a', 'b'] }
      ]
    })
    const idMap = buildIdMap(minimalSeed, counterFactory().factory)
    const p = toTablePayloads(minimalSeed, tournamentId, idMap)
    expect(p.teams[0].club).toBeNull()
    expect(p.ties[0].table_label).toBeNull()
  })
})

describe('same seed imported twice', () => {
  // AC3: the same seed must be importable as two distinct tournaments. The global
  // `id` PK still holds (composite keys land in #16), so each import mints its own
  // ids — two plans from one seed therefore carry disjoint ids + different scopes.
  it('two imports mint disjoint ids and different tournament_ids (no PK collision)', () => {
    const p1 = toTablePayloads(seed, 'tour-1', buildIdMap(seed, counterFactory('a').factory))
    const p2 = toTablePayloads(seed, 'tour-2', buildIdMap(seed, counterFactory('b').factory))

    // Every row is scoped to its own tournament.
    expect(p1.teams[0].tournament_id).toBe('tour-1')
    expect(p2.teams[0].tournament_id).toBe('tour-2')

    // No id is shared across the two plans (so both can coexist under one global PK).
    const ids1 = new Set<string>()
    for (const t of [p1.categories, p1.teams, p1.players, p1.ties]) {
      for (const r of t) ids1.add(r.id)
    }
    const shared = [p2.categories, p2.teams, p2.players, p2.ties]
      .flat()
      .some((r) => ids1.has(r.id))
    expect(shared).toBe(false)

    // Internal references still line up within each plan (player→team, tie→category).
    expect(p1.players[0].team_id).toBe(p1.teams[0].id)
    expect(p2.players[0].team_id).toBe(p2.teams[0].id)
    expect(p1.ties[0].category_id).toBe(p1.categories[0].id)
    expect(p2.ties[0].category_id).toBe(p2.categories[0].id)
  })
})
