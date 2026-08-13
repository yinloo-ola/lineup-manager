import { describe, it, expect } from 'vitest'
import { buildManagerTieRows } from '../managerView'
import type { BuildManagerTieRowsArgs } from '../managerView'

const baseArgs: BuildManagerTieRowsArgs = {
  // tie1 involves my team A; tie2 does not; tie3 is my team as teamB.
  ties: [
    { id: 'tie1', categoryId: 'c1', scheduledStart: '2026-08-20T10:00:00Z', teamIds: ['A', 'B'] },
    { id: 'tie2', categoryId: 'c1', scheduledStart: '2026-08-20T10:00:00Z', teamIds: ['C', 'D'] },
    { id: 'tie3', categoryId: 'c2', scheduledStart: '2026-08-20T10:00:00Z', teamIds: ['E', 'A'] }
  ],
  myTeamId: 'A',
  teamNameById: new Map([
    ['A', 'Alpha'],
    ['B', 'Bravo'],
    ['E', 'Echo']
  ]),
  leadTimeByCategory: new Map([
    ['c1', 30],
    ['c2', 15]
  ]),
  statusByTie: new Map([['tie1', 'draft']]),
  now: '2026-08-20T09:00:00Z'
}

describe('buildManagerTieRows', () => {
  it('keeps only my ties and fills opponent/cutoff/status', () => {
    const rows = buildManagerTieRows(baseArgs)
    expect(rows.map((r) => r.tieId)).toEqual(['tie1', 'tie3'])
    const tie1 = rows[0]
    expect(tie1).toEqual({
      tieId: 'tie1',
      opponentTeamId: 'B',
      opponentName: 'Bravo',
      scheduledStart: '2026-08-20T10:00:00Z',
      cutoff: '2026-08-20T09:30:00.000Z',
      locked: false,
      status: 'draft'
    })
  })

  it('handles being teamB (opponent is teamA)', () => {
    const rows = buildManagerTieRows(baseArgs)
    expect(rows[1].opponentTeamId).toBe('E')
    expect(rows[1].opponentName).toBe('Echo')
  })

  it('uses the per-category lead time for the cutoff', () => {
    const rows = buildManagerTieRows(baseArgs)
    // tie3 is c2 with a 15-min lead -> 10:00 - 15 = 09:45
    expect(rows[1].cutoff).toBe('2026-08-20T09:45:00.000Z')
  })

  it('marks a tie locked once now is at/after the cutoff', () => {
    const rows = buildManagerTieRows({ ...baseArgs, now: '2026-08-20T09:30:00Z' })
    expect(rows[0].locked).toBe(true)
  })

  it('defaults lead time to 30 when the category is unknown', () => {
    const rows = buildManagerTieRows({
      ...baseArgs,
      leadTimeByCategory: new Map()
    })
    expect(rows[0].cutoff).toBe('2026-08-20T09:30:00.000Z')
  })

  it('defaults status to not-started when there is no lineup', () => {
    const rows = buildManagerTieRows(baseArgs)
    expect(rows[1].status).toBe('not-started')
  })

  it('falls back to the opponent id when the name is unknown', () => {
    const rows = buildManagerTieRows({ ...baseArgs, teamNameById: new Map() })
    expect(rows[0].opponentName).toBe('B')
  })
})
