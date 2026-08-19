import { describe, it, expect } from 'vitest'
import { parseSeed, resolveStartDate, SeedParseError } from '../seed'

// Contract v2 (.scratch/ko-import spec §3): group ties carry both teams and
// their group/round labels; knockout ties carry NEITHER team — the entry round
// travels as an unplaced pool (table + time) and later rounds as positional
// fed ties — with the bracket structure declared separately in brackets[].
// Slot ids follow the producer's positional scheme `<shortName>|ko|LABEL|n`.
const validSeed = {
  seedVersion: 2,
  tournamentName: 'Summer Open',
  categories: [{ id: 'c1', name: "Men's Team", shortName: 'MT' }],
  teams: [
    { id: 'tA', name: 'Team A', club: 'Club A', managerEmail: 'a@club.example' },
    { id: 'tB', name: 'Team B', managerEmail: 'b@club.example' }
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
      group: 'A',
      round: '1',
      teamIds: ['tA', 'tB']
    },
    {
      id: 'MT|ko|QF|T1|2026-08-21T14:00',
      categoryId: 'c1',
      scheduledStart: '2026-08-21T14:00',
      table: 'T1',
      round: 'QF'
    },
    {
      id: 'MT|ko|QF|T2|2026-08-21T14:00',
      categoryId: 'c1',
      scheduledStart: '2026-08-21T14:00',
      table: 'T2',
      round: 'QF'
    },
    {
      id: 'MT|ko|SF|1',
      categoryId: 'c1',
      scheduledStart: '2026-08-21T16:00',
      table: 'T1',
      round: 'SF',
      fedBy: ['MT|ko|QF|1', 'MT|ko|QF|2']
    },
    {
      id: 'MT|ko|SF|2',
      categoryId: 'c1',
      scheduledStart: '2026-08-21T16:00',
      table: 'T2',
      round: 'SF',
      fedBy: ['MT|ko|QF|3', 'MT|ko|QF|4']
    },
    {
      id: 'MT|ko|F|1',
      categoryId: 'c1',
      scheduledStart: '2026-08-21T18:00',
      table: 'T1',
      round: 'F',
      fedBy: ['MT|ko|SF|1', 'MT|ko|SF|2']
    }
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
}

/** A deep copy of the valid seed, for tests that mutate one field at a time. */
const base = () => JSON.parse(JSON.stringify(validSeed))

describe('parseSeed — happy path', () => {
  it('parses a well-formed v2 seed into the typed shape', () => {
    expect(parseSeed(validSeed)).toEqual(validSeed)
  })

  it('accepts empty arrays (structure before any teams/ties exist)', () => {
    const minimal = {
      seedVersion: 2,
      tournamentName: 'X',
      categories: [],
      teams: [],
      players: [],
      ties: []
    }
    expect(parseSeed(minimal)).toEqual(minimal)
  })

  it('accepts a group-only seed without brackets', () => {
    const s = base()
    s.ties = [s.ties[0]]
    delete s.brackets
    expect(parseSeed(s).ties).toHaveLength(1)
    expect('brackets' in parseSeed(s)).toBe(false)
  })

  it('accepts a valid optional startDate', () => {
    const s = base()
    s.startDate = '2026-08-20'
    expect(parseSeed(s).startDate).toBe('2026-08-20')
  })

  it('accepts brackets with no knockout ties (unscheduled bracket)', () => {
    const s = base()
    s.ties = [s.ties[0]]
    const parsed = parseSeed(s)
    expect(parsed.brackets).toHaveLength(1)
  })
})

describe('parseSeed — seedVersion gate', () => {
  it('rejects a seed without seedVersion (pre-contract export) with a re-export hint', () => {
    const s = base()
    delete s.seedVersion
    expect(() => parseSeed(s)).toThrow(/pre-v1.*organizer tool/)
  })

  it('rejects a v1 seed, naming the supported version', () => {
    const s = base()
    s.seedVersion = 1
    expect(() => parseSeed(s)).toThrow(/version 1.*version 2|unsupported.*version 1/i)
  })

  it('rejects a non-integer seedVersion', () => {
    const s = base()
    s.seedVersion = '2'
    expect(() => parseSeed(s)).toThrow(/seedVersion/)
  })
})

describe('parseSeed — managerEmail (one manager per team)', () => {
  it('rejects a missing managerEmail, naming the team', () => {
    const s = base()
    delete s.teams[1].managerEmail
    expect(() => parseSeed(s)).toThrow(/teams\[1\].*Team B.*managerEmail|managerEmail.*Team B/)
  })

  it('rejects a malformed managerEmail, naming the team', () => {
    const s = base()
    s.teams[0].managerEmail = 'not-an-email'
    expect(() => parseSeed(s)).toThrow(/Team A.*not-an-email|managerEmail/)
  })

  it('rejects the same managerEmail on two teams (case-insensitive), naming both', () => {
    const s = base()
    s.teams[1].managerEmail = 'A@CLUB.EXAMPLE'
    expect(() => parseSeed(s)).toThrow(/Team A.*Team B|Team B.*Team A/)
  })
})

describe('parseSeed — startDate', () => {
  it('rejects a startDate that is not a real calendar date', () => {
    const s = base()
    s.startDate = '2026-02-30'
    expect(() => parseSeed(s)).toThrow(/startDate/)
  })

  it('rejects a startDate that is not yyyy-mm-dd', () => {
    const s = base()
    s.startDate = '20/08/2026'
    expect(() => parseSeed(s)).toThrow(/startDate/)
  })
})

describe('resolveStartDate — the seed-or-earliest-tie rule (spec §8)', () => {
  const parsed = () => parseSeed(validSeed)

  it("prefers the seed's own startDate when present", () => {
    const s = parsed()
    s.startDate = '2026-09-01'
    expect(resolveStartDate(s)).toBe('2026-09-01')
  })

  it('derives the earliest tie day when the seed omits startDate', () => {
    const s = parsed()
    s.startDate = undefined
    s.ties.push({ ...s.ties[0], id: 'tie2', scheduledStart: '2026-08-18T09:00' })
    expect(resolveStartDate(s)).toBe('2026-08-18')
  })

  it('returns null for a seed with neither startDate nor ties', () => {
    const s = parsed()
    s.ties = []
    expect(resolveStartDate(s)).toBeNull()
  })
})

describe('parseSeed — rejects malformed input', () => {
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
    s.ties.push(JSON.parse(JSON.stringify(s.ties[1])))
    expect(() => parseSeed(s)).toThrow(/duplicate/i)
  })

  it('requires group and round labels on team ties', () => {
    const s = base()
    delete s.ties[0].group
    expect(() => parseSeed(s)).toThrow(/group/)
  })
})

describe('parseSeed — knockout contract v2', () => {
  it('rejects a knockout tie that also carries teamIds or group', () => {
    const s = base()
    ;(s.ties[3] as Record<string, unknown>).teamIds = ['tA', 'tB']
    expect(() => parseSeed(s)).toThrow(/teamIds.*knockout|knockout.*teamIds/i)
  })

  it('rejects a pool tie whose round is not from the fixed label set', () => {
    const s = base()
    s.ties[1].round = 'QE'
    expect(() => parseSeed(s)).toThrow(/round.*R256|R128/)
  })

  it('rejects knockout ties for a category with no bracket structure', () => {
    const s = base()
    delete s.brackets
    expect(() => parseSeed(s)).toThrow(/bracket/i)
  })

  it('rejects a pool tie whose round is not the bracket entry round', () => {
    const s = base()
    s.ties[1].round = 'SF'
    expect(() => parseSeed(s)).toThrow(/entry round/)
  })

  it('rejects a bracket whose rounds do not halve', () => {
    const s = base()
    s.brackets[0].rounds[1].slots = 1
    s.brackets[0].rounds[1].fedBy = [['MT|ko|QF|1', 'MT|ko|QF|2']]
    expect(() => parseSeed(s)).toThrow(/halve/i)
  })

  it('rejects a bracket round with a label outside the fixed set', () => {
    const s = base()
    s.brackets[0].rounds[0].label = 'QE'
    expect(() => parseSeed(s)).toThrow(/R256|R128/)
  })

  it('rejects a first bracket round that carries feeds', () => {
    const s = base()
    s.brackets[0].rounds[0].fedBy = [
      ['MT|ko|QF|1', 'MT|ko|QF|2'],
      ['MT|ko|QF|3', 'MT|ko|QF|4'],
      ['MT|ko|QF|5', 'MT|ko|QF|6'],
      ['MT|ko|QF|7', 'MT|ko|QF|8']
    ]
    expect(() => parseSeed(s)).toThrow(/entry round.*feeds|feeds.*entry round/i)
  })

  it('rejects a fed tie whose wiring disagrees with the bracket structure', () => {
    const s = base()
    s.ties[3].fedBy = ['MT|ko|QF|2', 'MT|ko|QF|1']
    expect(() => parseSeed(s)).toThrow(/wiring|fedBy/)
  })

  it('rejects a fed tie whose id is not its positional slot id', () => {
    const s = base()
    s.ties[3].id = 'some-other-id'
    expect(() => parseSeed(s)).toThrow(/slot id|positional/i)
  })

  it('rejects fedBy that references a slot outside the bracket', () => {
    const s = base()
    s.brackets[0].rounds[1].fedBy[0] = ['MT|ko|QF|9', 'MT|ko|QF|2']
    s.ties[3].fedBy = ['MT|ko|QF|9', 'MT|ko|QF|2']
    expect(() => parseSeed(s)).toThrow(/slot/)
  })
})

describe('parseSeed — dateOfBirth formats', () => {
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
