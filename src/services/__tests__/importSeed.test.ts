import { describe, it, expect } from 'vitest'
import { toTablePayloads } from '../importSeed'
import { parseSeed } from '@/domain/seed'

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

describe('toTablePayloads', () => {
  it('maps camelCase domain fields to snake_case columns', () => {
    const p = toTablePayloads(seed)
    expect(p.categories[0]).toEqual({ id: 'c1', name: "Men's Team", short_name: 'MT' })
    expect(p.teams).toEqual([
      { id: 'tA', name: 'Team A', club: 'Club A' },
      { id: 'tB', name: 'Team B', club: null }
    ])
    expect(p.players[0]).toEqual({
      id: 'p1',
      team_id: 'tA',
      name: 'Alice',
      gender: 'F',
      date_of_birth: '1990-01-01'
    })
    expect(p.ties[0]).toEqual({
      id: 'tie1',
      category_id: 'c1',
      scheduled_start: '2026-08-20T10:00',
      table_label: '1',
      team_a: 'tA',
      team_b: 'tB'
    })
  })

  it('nulls out optional fields that were omitted', () => {
    const p = toTablePayloads(
      parseSeed({
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
    )
    expect(p.teams[0].club).toBeNull()
    expect(p.ties[0].table_label).toBeNull()
  })
})
