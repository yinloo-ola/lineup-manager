import { describe, it, expect } from 'vitest'
import { buildUmpireTieRows, LOCKED_REASON } from '../umpireView'

const names = new Map([
  ['a', 'Alpha'],
  ['b', 'Bravo'],
  ['c', 'Charlie']
])

const baseTie = {
  tieId: 't1',
  scheduledStart: '2099-01-01T10:00:00',
  table: '1',
  teamIds: ['a', 'b'] as [string, string]
}

describe('buildUmpireTieRows', () => {
  it('opens entry only when both sides have submitted lineups', () => {
    const rows = buildUmpireTieRows({
      ties: [baseTie],
      lineups: [{ tieId: 't1', teamId: 'a', status: 'submitted' }],
      teamNameById: names
    })
    expect(rows[0].entryOpen).toBe(false)
    expect(rows[0].state).toBe('locked')
    expect(LOCKED_REASON).toBe('lineup not submitted')
  })

  it('stays locked while a lineup is draft even if the other side submitted', () => {
    const rows = buildUmpireTieRows({
      ties: [baseTie],
      lineups: [
        { tieId: 't1', teamId: 'a', status: 'submitted' },
        { tieId: 't1', teamId: 'b', status: 'draft' }
      ],
      teamNameById: names
    })
    expect(rows[0].entryOpen).toBe(false)
  })

  it('opens when both sides submitted and shows team display names', () => {
    const rows = buildUmpireTieRows({
      ties: [baseTie],
      lineups: [
        { tieId: 't1', teamId: 'a', status: 'submitted' },
        { tieId: 't1', teamId: 'b', status: 'submitted' }
      ],
      teamNameById: names
    })
    expect(rows[0].entryOpen).toBe(true)
    expect(rows[0].state).toBe('not-entered')
    expect(rows[0].teamAName).toBe('Alpha')
    expect(rows[0].teamBName).toBe('Bravo')
  })

  it('excludes knockout ties and null-sided ties', () => {
    const rows = buildUmpireTieRows({
      ties: [
        { ...baseTie, tieId: 'ko', isKnockout: true },
        { ...baseTie, tieId: 'tbd', teamIds: ['a', null] as [string, null] }
      ],
      lineups: [],
      teamNameById: names
    })
    expect(rows).toEqual([])
  })

  it('falls back to the raw team id when the name is missing', () => {
    const rows = buildUmpireTieRows({
      ties: [baseTie],
      lineups: [
        { tieId: 't1', teamId: 'a', status: 'submitted' },
        { tieId: 't1', teamId: 'b', status: 'submitted' }
      ],
      teamNameById: new Map()
    })
    expect(rows[0].teamAName).toBe('a')
  })

  it('derives partial and decided states from entered results', () => {
    const rows = buildUmpireTieRows({
      ties: [
        { ...baseTie, tieId: 't1' },
        { ...baseTie, tieId: 't2', teamIds: ['a', 'c'] }
      ],
      lineups: [
        { tieId: 't1', teamId: 'a', status: 'submitted' },
        { tieId: 't1', teamId: 'b', status: 'submitted' },
        { tieId: 't2', teamId: 'a', status: 'submitted' },
        { tieId: 't2', teamId: 'c', status: 'submitted' }
      ],
      teamNameById: names,
      rubberCountByTie: new Map([
        ['t1', 3],
        ['t2', 3]
      ]),
      results: [
        // t1: one rubber entered, tie undecided → partial.
        { tieId: 't1', rubberIndex: 1, games: [{ a: 11, b: 5 }, { a: 11, b: 7 }], walkover: false },
        // t2: rubbers 1+2 entered, side a reaches the majority → decided a.
        {
          tieId: 't2',
          rubberIndex: 1,
          games: [
            { a: 11, b: 5 },
            { a: 11, b: 7 },
            { a: 11, b: 9 }
          ],
          walkover: false
        },
        { tieId: 't2', rubberIndex: 2, games: [], walkover: true, walkoverSide: 'a' }
      ],
      bestOfByTie: new Map([
        ['t1', 5],
        ['t2', 5]
      ])
    })
    expect(rows[0].state).toBe('partial')
    expect(rows[1].state).toBe('decided')
    expect(rows[1].winnerSide).toBe('a')
    expect(rows[1].winnerName).toBe('Alpha')
  })

  it('a walkover decides only with its recorded side', () => {
    const withSide = () =>
      buildUmpireTieRows({
        ties: [baseTie],
        lineups: [
          { tieId: 't1', teamId: 'a', status: 'submitted' },
          { tieId: 't1', teamId: 'b', status: 'submitted' }
        ],
        teamNameById: names,
        rubberCountByTie: new Map([['t1', 1]]),
        bestOfByTie: new Map([['t1', 5]]),
        results: [{ tieId: 't1', rubberIndex: 1, games: [], walkover: true, walkoverSide: 'a' }]
      })
    const sideless = () =>
      buildUmpireTieRows({
        ties: [baseTie],
        lineups: [
          { tieId: 't1', teamId: 'a', status: 'submitted' },
          { tieId: 't1', teamId: 'b', status: 'submitted' }
        ],
        teamNameById: names,
        rubberCountByTie: new Map([['t1', 1]]),
        bestOfByTie: new Map([['t1', 5]]),
        results: [{ tieId: 't1', rubberIndex: 1, games: [], walkover: true }]
      })
    expect(withSide()[0].state).toBe('decided')
    expect(withSide()[0].winnerSide).toBe('a')
    // A side-less walkover is undecided — never a silent default win.
    expect(sideless()[0].state).toBe('partial')
    expect(sideless()[0].winnerSide).toBeUndefined()
  })

  it('stays not-entered when no results are passed', () => {
    const rows = buildUmpireTieRows({
      ties: [baseTie],
      lineups: [
        { tieId: 't1', teamId: 'a', status: 'submitted' },
        { tieId: 't1', teamId: 'b', status: 'submitted' }
      ],
      teamNameById: names
    })
    expect(rows[0].state).toBe('not-entered')
  })
})
