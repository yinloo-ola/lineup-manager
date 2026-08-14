import { describe, it, expect } from 'vitest'
import { parseSeed, SeedParseError } from '../seed'

const validSeed = {
  tournamentName: 'Summer Open',
  categories: [{ id: 'c1', name: "Men's Team", shortName: 'MT' }],
  teams: [
    { id: 'tA', name: 'Team A', club: 'Club A' },
    { id: 'tB', name: 'Team B' }
  ],
  players: [
    { id: 'p1', teamId: 'tA', name: 'Alice', gender: 'F', dateOfBirth: '1990-01-01' },
    { id: 'p2', teamId: 'tB', name: 'Bob', gender: 'M', dateOfBirth: '1988-05-05' }
  ],
  ties: [
    {
      id: 'tie1',
      categoryId: 'c1',
      scheduledStart: '2026-08-20T10:00',
      table: '1',
      teamIds: ['tA', 'tB']
    }
  ]
}

describe('parseSeed — happy path', () => {
  it('parses a well-formed seed into the typed shape', () => {
    expect(parseSeed(validSeed)).toEqual(validSeed)
  })

  it('accepts empty arrays (structure before any teams/ties exist)', () => {
    const minimal = {
      tournamentName: 'X',
      categories: [],
      teams: [],
      players: [],
      ties: []
    }
    expect(parseSeed(minimal)).toEqual(minimal)
  })
})

describe('parseSeed — rejects malformed input', () => {
  const base = () => JSON.parse(JSON.stringify(validSeed))

  it('rejects non-object input', () => {
    expect(() => parseSeed('nope')).toThrow(SeedParseError)
    expect(() => parseSeed(null)).toThrow(SeedParseError)
  })

  it('rejects a missing tournamentName', () => {
    const s = base()
    delete s.tournamentName
    expect(() => parseSeed(s)).toThrow(/tournamentName/)
  })

  it('rejects wrong-typed categories', () => {
    const s = base()
    s.categories = 'nope'
    expect(() => parseSeed(s)).toThrow(/categories/)
  })

  it('rejects a category missing shortName', () => {
    const s = base()
    delete s.categories[0].shortName
    expect(() => parseSeed(s)).toThrow(/shortName/)
  })

  it('rejects a team missing name', () => {
    const s = base()
    delete s.teams[0].name
    expect(() => parseSeed(s)).toThrow(/teams\[0\].name/)
  })

  it('rejects a tie whose teamIds is not length 2', () => {
    const s = base()
    s.ties[0].teamIds = ['tA']
    expect(() => parseSeed(s)).toThrow(/exactly 2/)
  })

  it('rejects a player referencing an unknown teamId', () => {
    const s = base()
    s.players[0].teamId = 'nope'
    expect(() => parseSeed(s)).toThrow(/teamId/)
  })

  it('rejects a tie referencing an unknown team', () => {
    const s = base()
    s.ties[0].teamIds = ['tA', 'nope']
    expect(() => parseSeed(s)).toThrow(SeedParseError)
  })

  it('rejects a tie referencing an unknown category', () => {
    const s = base()
    s.ties[0].categoryId = 'nope'
    expect(() => parseSeed(s)).toThrow(SeedParseError)
  })

  it('rejects duplicate team ids', () => {
    const s = base()
    s.teams[1].id = 'tA'
    expect(() => parseSeed(s)).toThrow(/duplicate/i)
  })

  it('rejects duplicate category ids', () => {
    const s = base()
    s.categories.push({ id: 'c1', name: 'X', shortName: 'X' })
    expect(() => parseSeed(s)).toThrow(/duplicate/i)
  })

  it('rejects duplicate player ids', () => {
    const s = base()
    s.players[1].id = 'p1'
    expect(() => parseSeed(s)).toThrow(/duplicate/i)
  })

  it('rejects duplicate tie ids', () => {
    const s = base()
    s.ties.push({ ...s.ties[0] })
    expect(() => parseSeed(s)).toThrow(/duplicate/i)
  })
})

describe('parseSeed — dateOfBirth formats', () => {
  const base = () => JSON.parse(JSON.stringify(validSeed))

  it('normalizes an Excel-serial dateOfBirth (tournament-manager export) to yyyy-mm-dd', () => {
    const s = base()
    s.players[0].dateOfBirth = '36893' // Excel serial -> 2001-01-02
    const parsed = parseSeed(s)
    expect(parsed.players[0].dateOfBirth).toBe('2001-01-02')
  })

  it('leaves an already-ISO yyyy-mm-dd dateOfBirth untouched', () => {
    const s = base()
    s.players[0].dateOfBirth = '1990-01-01'
    expect(parseSeed(s).players[0].dateOfBirth).toBe('1990-01-01')
  })

  it('rejects a dateOfBirth that is neither ISO nor a serial number', () => {
    const s = base()
    s.players[0].dateOfBirth = 'not-a-date'
    expect(() => parseSeed(s)).toThrow(/dateOfBirth/)
  })
})
