import { describe, it, expect } from 'vitest'
import { breakingLineups, isFormatFrozen, startDateEditError } from '../formatFreeze'
import type { AdminLineupInput, AdminTieInput } from '../adminView'
import type { Player, TieFormat } from '../types'

// Ticket #16: the two format rules of spec §6 — the freeze (anchored on the
// tournament's start date) and the guarded pre-start edit (which submitted
// lineups a proposed format would break).

describe('isFormatFrozen', () => {
  it('frozen once the start date is on or before today', () => {
    expect(isFormatFrozen('2026-08-15', '2026-08-15')).toBe(true)
    expect(isFormatFrozen('2026-08-14', '2026-08-15')).toBe(true)
  })

  it('not frozen before the start date', () => {
    expect(isFormatFrozen('2026-08-16', '2026-08-15')).toBe(false)
  })

  it('not frozen without a start date (pre-v1 tournament)', () => {
    expect(isFormatFrozen(null, '2026-08-15')).toBe(false)
  })
})

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

function args(
  formatByCategory: Map<string, TieFormat>,
  extras: {
    lineups?: AdminLineupInput[]
    rosterByTeam?: Map<string, Player[]>
  } = {}
) {
  return {
    lineups:
      extras.lineups ??
      [lineup('t1', 'Alpha', 'submitted', [['pa']])],
    ties: [
      { tieId: 't1', categoryId: 'cat', scheduledStart: '2099-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] }
    ] as AdminTieInput[],
    teamNameById: new Map([
      ['Alpha', 'Alpha'],
      ['Bravo', 'Bravo']
    ]),
    categoryNameById: new Map([['cat', "Men's Team"]]),
    leadTimeByCategory: new Map([['cat', 30]]),
    rosterByTeam:
      extras.rosterByTeam ??
      new Map([
        ['Alpha', [male('pa')]],
        ['Bravo', [male('pb')]]
      ]),
    formatByCategory,
    tournamentStart: null,
    now: '2026-06-01T12:00:00Z'
  }
}

describe('breakingLineups', () => {
  it('flags the submitted lineups the proposed format would break, with team-match context', () => {
    // Proposed format tightens to women-only; Alpha's submitted lineup has a man.
    const proposed = new Map([['cat', { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['F'] } }] } as TieFormat]])
    const breaks = breakingLineups(args(proposed))
    expect(breaks).toEqual([
      { teamName: 'Alpha', opponentName: 'Bravo', scheduledStart: '2099-01-01T10:00:00Z' }
    ])
  })

  it('a proposed format the submitted lineup still satisfies breaks nothing', () => {
    expect(breakingLineups(args(new Map([['cat', mensSingles]])))).toEqual([])
  })

  it('adding a match breaks submitted lineups (they do not cover it)', () => {
    const twoMatches: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: { allowedGenders: ['M'] } },
        { format: 'singles', constraint: { allowedGenders: ['M'] } }
      ]
    }
    expect(breakingLineups(args(new Map([['cat', twoMatches]])))).toHaveLength(1)
  })

  it('drafts are never breakage (drafting nuance; only submitted lineups guard)', () => {
    const proposed = new Map([['cat', { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['F'] } }] } as TieFormat]])
    const breaks = breakingLineups(
      args(proposed, { lineups: [lineup('t1', 'Alpha', 'draft', [['pa']])] })
    )
    expect(breaks).toEqual([])
  })

  it('lineups of other categories keep their stored formats (only the target is re-validated)', () => {
    const proposed = new Map([
      ['cat', { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['F'] } }] } as TieFormat],
      ['other', mensSingles]
    ])
    const breaks = breakingLineups({
      ...args(proposed),
      ties: [
        { tieId: 't1', categoryId: 'cat', scheduledStart: '2099-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] },
        { tieId: 't2', categoryId: 'other', scheduledStart: '2099-01-02T10:00:00Z', teamIds: ['Bravo', 'Alpha'] }
      ],
      lineups: [
        lineup('t1', 'Alpha', 'submitted', [['pa']]), // breaks under the proposed women-only format
        lineup('t2', 'Bravo', 'submitted', [['pb']]) // valid under its own category's stored format
      ],
      rosterByTeam: new Map([
        ['Alpha', [male('pa')]],
        ['Bravo', [male('pb')]]
      ])
    })
    expect(breaks).toEqual([{ teamName: 'Alpha', opponentName: 'Bravo', scheduledStart: '2099-01-01T10:00:00Z' }])
  })
})

describe('startDateEditError', () => {
  it('blocks clearing the start date of a started tournament (the freeze anchor)', () => {
    expect(startDateEditError('2026-08-01', '', '2026-08-15')).toMatch(/must keep a start date in the past/)
  })

  it('blocks moving a started tournament\'s start date into the future — that lifts the freeze too', () => {
    expect(startDateEditError('2026-08-01', '2099-01-01', '2026-08-15')).toMatch(/must keep a start date in the past/)
  })

  it('allows editing within the past — the tournament stays started', () => {
    expect(startDateEditError('2026-08-01', '2026-07-02', '2026-08-15')).toBeNull()
  })

  it('allows any edit while the start date has not arrived (not yet started)', () => {
    expect(startDateEditError('2099-01-01', '', '2026-08-15')).toBeNull()
    expect(startDateEditError('2099-01-01', '2026-08-16', '2026-08-15')).toBeNull()
  })

  it('allows any edit when no start date is set', () => {
    expect(startDateEditError(null, '', '2026-08-15')).toBeNull()
  })
})
