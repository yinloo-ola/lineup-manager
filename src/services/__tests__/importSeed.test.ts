import { describe, it, expect } from 'vitest'
import { buildIdMap, nameClashes, toTablePayloads } from '../importSeed'
import { parseSeed, type SeedFile } from '@/domain/seed'

const seed = parseSeed({
  seedVersion: 2,
  tournamentName: 'Summer Open',
  startDate: '2026-08-19',
  categories: [{ id: 'c1', name: "Men's Team", shortName: 'MT' }],
  teams: [
    { id: 'tA', name: 'Team A', club: 'Club A', managerEmail: 'a@club.example' },
    { id: 'tB', name: 'Team B', managerEmail: 'b@club.example' }
  ],
  players: [{ id: 'p1', teamId: 'tA', name: 'Alice', gender: 'F', dateOfBirth: '1990-01-01' }],
  ties: [
    {
      id: 'tie1',
      categoryId: 'c1',
      scheduledStart: '2026-08-20T10:00',
      table: '1',
      group: 'A',
      round: '1',
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
      {
        id: idMap.get('tA'),
        tournament_id: tournamentId,
        name: 'Team A',
        club: 'Club A',
        manager_email: 'a@club.example'
      },
      {
        id: idMap.get('tB'),
        tournament_id: tournamentId,
        name: 'Team B',
        club: null,
        manager_email: 'b@club.example'
      }
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
      group_label: 'A',
      round_label: '1',
      team_a: idMap.get('tA'),
      team_b: idMap.get('tB'),
      fed_by_a: null,
      fed_by_b: null,
      winner_side: null,
      is_knockout: false,
      placed_match_id: null
    })
  })

  it('nulls out optional fields that were omitted (labels are required on team ties under v2)', () => {
    const minimalSeed: SeedFile = parseSeed({
      seedVersion: 2,
      tournamentName: 'X',
      categories: [{ id: 'c', name: 'C', shortName: 'C' }],
      teams: [
        { id: 'a', name: 'A', managerEmail: 'a@x.example' },
        { id: 'b', name: 'B', managerEmail: 'b@x.example' }
      ],
      players: [],
      ties: [
        { id: 'tie', categoryId: 'c', scheduledStart: '2026-01-01T09:00', group: 'A', round: '1', teamIds: ['a', 'b'] }
      ]
    })
    const idMap = buildIdMap(minimalSeed, counterFactory().factory)
    const p = toTablePayloads(minimalSeed, tournamentId, idMap)
    expect(p.teams[0].club).toBeNull()
    expect(p.ties[0].table_label).toBeNull()
    expect(p.ties[0].group_label).toBe('A')
    expect(p.ties[0].round_label).toBe('1')
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

describe('toTablePayloads — knockout bracket (contract v2)', () => {
  const tournamentId = 'tour-ko'

  const koSeed = parseSeed({
    seedVersion: 2,
    tournamentName: 'KO Cup',
    categories: [{ id: 'c1', name: "Men's Team", shortName: 'MT' }],
    teams: [
      { id: 'tA', name: 'Team A', managerEmail: 'a@club.example' },
      { id: 'tB', name: 'Team B', managerEmail: 'b@club.example' }
    ],
    players: [{ id: 'p1', teamId: 'tA', name: 'Alice', gender: 'F', dateOfBirth: '1990-01-01' }],
    ties: [
      { id: 'tie1', categoryId: 'c1', scheduledStart: '2026-08-20T10:00', group: 'A', round: '1', teamIds: ['tA', 'tB'] },
      { id: 'MT|ko|QF|T1|2026-08-21T14:00', categoryId: 'c1', scheduledStart: '2026-08-21T14:00', table: 'T1', round: 'QF' },
      { id: 'MT|ko|QF|T2|2026-08-21T14:00', categoryId: 'c1', scheduledStart: '2026-08-21T14:00', table: 'T2', round: 'QF' },
      { id: 'MT|ko|SF|1', categoryId: 'c1', scheduledStart: '2026-08-21T16:00', table: 'T1', round: 'SF', fedBy: ['MT|ko|QF|1', 'MT|ko|QF|2'] },
      { id: 'MT|ko|SF|2', categoryId: 'c1', scheduledStart: '2026-08-21T16:00', table: 'T2', round: 'SF', fedBy: ['MT|ko|QF|3', 'MT|ko|QF|4'] },
      { id: 'MT|ko|F|1', categoryId: 'c1', scheduledStart: '2026-08-21T18:00', table: 'T1', round: 'F', fedBy: ['MT|ko|SF|1', 'MT|ko|SF|2'] }
    ],
    brackets: [
      {
        categoryId: 'c1',
        rounds: [
          { label: 'QF', slots: 4 },
          { label: 'SF', slots: 2, fedBy: [['MT|ko|QF|1', 'MT|ko|QF|2'], ['MT|ko|QF|3', 'MT|ko|QF|4']] },
          { label: 'F', slots: 1, fedBy: [['MT|ko|SF|1', 'MT|ko|SF|2']] }
        ]
      }
    ]
  })

  it('mints ids for every bracket slot; a fed tie shares its slot id', () => {
    const idMap = buildIdMap(koSeed, counterFactory().factory)
    for (const slot of ['MT|ko|QF|1', 'MT|ko|QF|2', 'MT|ko|QF|3', 'MT|ko|QF|4', 'MT|ko|SF|1', 'MT|ko|SF|2', 'MT|ko|F|1']) {
      expect(idMap.get(slot)).toBeDefined()
    }
  })

  it('emits group, pool, fed, and structural slot rows — one row per bracket slot, bye slots included', () => {
    const idMap = buildIdMap(koSeed, counterFactory('g').factory)
    const p = toTablePayloads(koSeed, tournamentId, idMap)

    // 1 group tie + 2 pool + 3 fed + 4 entry-round slots (SF/F covered by fed ties).
    expect(p.ties).toHaveLength(10)
    const byId = new Map(p.ties.map((r) => [r.id, r]))
    const rowBySeedId = (seedId: string) => byId.get(idMap.get(seedId)!)

    // Group tie: teams, labels, not knockout.
    const group = rowBySeedId('tie1')!
    expect(group).toMatchObject({ team_a: idMap.get('tA'), team_b: idMap.get('tB'), is_knockout: false, scheduled_start: '2026-08-20T10:00' })

    // Pool match: table + time, no position, no teams, no feeds.
    const pool = rowBySeedId('MT|ko|QF|T1|2026-08-21T14:00')!
    expect(pool).toMatchObject({ team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, is_knockout: true, table_label: 'T1', round_label: 'QF', scheduled_start: '2026-08-21T14:00', placed_match_id: null })

    // Fed later-round tie: positional id, feeds minted to the slot rows.
    const sf1 = rowBySeedId('MT|ko|SF|1')!
    expect(sf1).toMatchObject({ is_knockout: true, round_label: 'SF', scheduled_start: '2026-08-21T16:00' })
    expect(sf1.fed_by_a).toBe(idMap.get('MT|ko|QF|1'))
    expect(sf1.fed_by_b).toBe(idMap.get('MT|ko|QF|2'))
    const f1 = rowBySeedId('MT|ko|F|1')!
    expect(f1.fed_by_a).toBe(idMap.get('MT|ko|SF|1'))
    expect(f1.fed_by_b).toBe(idMap.get('MT|ko|SF|2'))

    // Structural entry-round slots: no schedule, no teams, no feeds (filled by
    // placement + entry later), is_knockout.
    for (const n of [1, 2, 3, 4]) {
      const slot = rowBySeedId(`MT|ko|QF|${n}`)!
      expect(slot).toMatchObject({ scheduled_start: null, table_label: null, team_a: null, team_b: null, fed_by_a: null, fed_by_b: null, is_knockout: true, round_label: 'QF', winner_side: null })
    }
  })

  it('minted feeds are globally unique across two imports of the same seed', () => {
    const p1 = toTablePayloads(koSeed, 't1', buildIdMap(koSeed, counterFactory('a').factory))
    const p2 = toTablePayloads(koSeed, 't2', buildIdMap(koSeed, counterFactory('b').factory))
    const ids1 = new Set(p1.ties.map((r) => r.id))
    expect(p2.ties.some((r) => ids1.has(r.id))).toBe(false)
    // And every feed points inside its own plan.
    for (const p of [p1, p2]) {
      const own = new Set(p.ties.map((r) => r.id))
      for (const r of p.ties) {
        if (r.fed_by_a) expect(own.has(r.fed_by_a)).toBe(true)
        if (r.fed_by_b) expect(own.has(r.fed_by_b)).toBe(true)
      }
    }
  })
})
