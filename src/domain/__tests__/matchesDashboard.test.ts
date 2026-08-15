import { describe, it, expect } from 'vitest'
import {
  buildMatchRows,
  compareMatchRows,
  matchMatchesFilter,
  matchMissesCutoff,
  type BuildMatchRowsArgs
} from '../matchesDashboard'
import type { AdminLineupInput, AdminTieInput } from '../adminView'
import type { Player, TieFormat } from '../types'

const NOW = '2026-06-01T12:00:00Z'
const FUTURE = '2099-01-01T10:00:00Z'
const PAST = '2000-01-01T10:00:00Z'
const mensSingles: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
const male = (id: string): Player => ({ id, name: id.toUpperCase(), gender: 'M', dateOfBirth: '1990-01-01' })
const female = (id: string): Player => ({ id, name: id.toUpperCase(), gender: 'F', dateOfBirth: '1990-01-01' })

function lineup(
  tieId: string,
  teamId: string,
  status: AdminLineupInput['status'],
  playerIds: (string[] | null)[]
): AdminLineupInput {
  return { tieId, teamId, status, playerIds, updatedAt: '2026-01-01T00:00Z', updatedBy: 'admin@lineup.local' }
}

function tie(extras: Partial<AdminTieInput> = {}): AdminTieInput {
  return { tieId: 't1', categoryId: 'cat', scheduledStart: FUTURE, teamIds: ['Alpha', 'Bravo'], ...extras }
}

function args(extras: Partial<BuildMatchRowsArgs> = {}): BuildMatchRowsArgs {
  return {
    lineups: [lineup('t1', 'Alpha', 'submitted', [['pa']])],
    ties: [tie()],
    teamNameById: new Map([
      ['Alpha', 'Alpha'],
      ['Bravo', 'Bravo']
    ]),
    categoryNameById: new Map([['cat', "Men's Team"]]),
    leadTimeByCategory: new Map([['cat', 30]]),
    rosterByTeam: new Map([['Alpha', [male('pa')]], ['Bravo', [male('pb')]]]),
    formatByCategory: new Map([['cat', mensSingles]]),
    tournamentStart: null,
    now: NOW,
    ...extras
  }
}

describe('buildMatchRows', () => {
  it('yields one row per team match — including ties with no lineup saved', () => {
    const rows = buildMatchRows(args({ lineups: [] }))
    expect(rows).toHaveLength(1)
    expect(rows[0].tieId).toBe('t1')
    expect(rows[0].sides.map((s) => s.teamName)).toEqual(['Alpha', 'Bravo'])
    expect(rows[0].sides.every((s) => s.status === 'not-submitted')).toBe(true)
  })

  it('derives Submitted for a valid submitted lineup and Not submitted for the rest', () => {
    const rows = buildMatchRows(
      args({
        lineups: [
          lineup('t1', 'Alpha', 'submitted', [['pa']]),
          lineup('t1', 'Bravo', 'draft', [['pb']])
        ]
      })
    )
    expect(rows[0].sides.map((s) => s.status)).toEqual(['submitted', 'not-submitted'])
  })

  it('derives Missed cutoff when a lineup is still missing past the cutoff', () => {
    const rows = buildMatchRows(
      args({
        ties: [tie({ scheduledStart: PAST })],
        lineups: [lineup('t1', 'Alpha', 'submitted', [['pa']])]
      })
    )
    expect(rows[0].locked).toBe(true)
    expect(rows[0].sides.map((s) => s.status)).toEqual(['submitted', 'missed-cutoff'])
    expect(matchMissesCutoff(rows[0])).toBe(true)
  })

  it('a draft past the cutoff is also Missed cutoff (drafting nuance is builder-internal)', () => {
    const rows = buildMatchRows(
      args({
        ties: [tie({ scheduledStart: PAST })],
        lineups: [lineup('t1', 'Bravo', 'draft', [['pb']])]
      })
    )
    expect(rows[0].sides[1].status).toBe('missed-cutoff')
  })

  it('an invalidated lineup reads Not submitted with the Needs attention marker', () => {
    // Submitted a woman into men's singles: the tightened format broke the lineup.
    const rows = buildMatchRows(
      args({
        lineups: [lineup('t1', 'Alpha', 'submitted', [['pf']])],
        rosterByTeam: new Map([['Alpha', [female('pf')]], ['Bravo', [male('pb')]]])
      })
    )
    expect(rows[0].sides[0].status).toBe('not-submitted')
    expect(rows[0].sides[0].needsAttention).toBe(true)
    expect(rows[0].sides[1].needsAttention).toBe(false)
  })

  it('carries the seed-sourced metadata and resolves lineup player names per match', () => {
    const rows = buildMatchRows(
      args({
        ties: [tie({ table: '5', group: 'Group A', round: 'Round 2' })],
        lineups: [
          lineup('t1', 'Alpha', 'submitted', [['pa']]),
          lineup('t1', 'Bravo', 'submitted', [['pb']])
        ]
      })
    )
    expect(rows[0]).toMatchObject({ table: '5', group: 'Group A', round: 'Round 2' })
    expect(rows[0].sides[0].players).toEqual([['PA']])
    expect(rows[0].sides[1].players).toEqual([['PB']])
  })

  it('omits absent metadata (undefined, not empty strings)', () => {
    const rows = buildMatchRows(args())
    expect(rows[0].table).toBeUndefined()
    expect(rows[0].group).toBeUndefined()
    expect(rows[0].round).toBeUndefined()
  })

  it('a side with no lineup saved carries no player list', () => {
    const rows = buildMatchRows(args({ lineups: [] }))
    expect(rows[0].sides[0].players).toBeNull()
  })

  it('skips lineups whose tie is missing (stale rows for deleted ties)', () => {
    const rows = buildMatchRows(args({ lineups: [lineup('orphan', 'Alpha', 'draft', [['pa']])], ties: [tie()] }))
    expect(rows).toHaveLength(1)
    expect(rows[0].sides.every((s) => s.status === 'not-submitted')).toBe(true)
  })
})

describe('compareMatchRows (sorting)', () => {
  function row(scheduledStart: string, table?: string, tieId = 't'): ReturnType<typeof buildMatchRows>[number] {
    return {
      tieId,
      scheduledStart,
      table,
      sides: [
        { teamId: 'A', teamName: 'A', status: 'not-submitted', needsAttention: false, players: null, submittedAt: null },
        { teamId: 'B', teamName: 'B', status: 'not-submitted', needsAttention: false, players: null, submittedAt: null }
      ],
      cutoff: scheduledStart,
      locked: false
    }
  }

  it('sorts ascending by scheduled time', () => {
    const sorted = [row('2099-01-02T10:00:00Z'), row('2099-01-01T10:00:00Z')].sort(compareMatchRows)
    expect(sorted.map((r) => r.scheduledStart)).toEqual(['2099-01-01T10:00:00Z', '2099-01-02T10:00:00Z'])
  })

  it('breaks time ties on table number, numerically', () => {
    const sorted = [row(FUTURE, '10'), row(FUTURE, '2')].sort(compareMatchRows)
    expect(sorted.map((r) => r.table)).toEqual(['2', '10'])
  })

  it('falls back to string comparison when tables are not numeric', () => {
    const sorted = [row(FUTURE, 'B2'), row(FUTURE, 'B1')].sort(compareMatchRows)
    expect(sorted.map((r) => r.table)).toEqual(['B1', 'B2'])
  })

  it('a missing table sorts after a present one', () => {
    const sorted = [row(FUTURE, undefined), row(FUTURE, '3')].sort(compareMatchRows)
    expect(sorted.map((r) => r.table)).toEqual(['3', undefined])
  })
})

describe('matchMatchesFilter', () => {
  const base = {
    tieId: 't1',
    scheduledStart: FUTURE,
    cutoff: FUTURE,
    sides: [
      { teamId: 'A', teamName: 'A', status: 'not-submitted' as const, needsAttention: false, players: null, submittedAt: null },
      { teamId: 'B', teamName: 'B', status: 'not-submitted' as const, needsAttention: false, players: null, submittedAt: null }
    ]
  }
  const open = { ...base, locked: false }
  const lockedBothMissing = { ...base, locked: true, sides: base.sides.map((s) => ({ ...s, status: 'missed-cutoff' as const })) }
  const lockedBothSubmitted = { ...base, locked: true, sides: base.sides.map((s) => ({ ...s, status: 'submitted' as const })) }
  const oneSubmitted = { ...base, locked: false, sides: [{ ...base.sides[0], status: 'submitted' as const }, base.sides[1]] }

  it('All matches everything', () => {
    for (const m of [open, lockedBothMissing, lockedBothSubmitted, oneSubmitted]) {
      expect(matchMatchesFilter(m, 'all')).toBe(true)
    }
  })

  it('Not submitted matches when any team has not submitted', () => {
    expect(matchMatchesFilter(open, 'not-submitted')).toBe(true)
    expect(matchMatchesFilter(lockedBothMissing, 'not-submitted')).toBe(true)
    expect(matchMatchesFilter(oneSubmitted, 'not-submitted')).toBe(true)
    expect(matchMatchesFilter(lockedBothSubmitted, 'not-submitted')).toBe(false)
  })

  it('Submitted matches only when both teams submitted', () => {
    expect(matchMatchesFilter(lockedBothSubmitted, 'submitted')).toBe(true)
    expect(matchMatchesFilter(oneSubmitted, 'submitted')).toBe(false)
  })

  it('Past cutoff matches team matches past their cutoff', () => {
    expect(matchMatchesFilter(open, 'past-cutoff')).toBe(false)
    expect(matchMatchesFilter(lockedBothMissing, 'past-cutoff')).toBe(true)
    expect(matchMatchesFilter(lockedBothSubmitted, 'past-cutoff')).toBe(true)
  })
})
