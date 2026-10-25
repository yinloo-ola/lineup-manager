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
})
