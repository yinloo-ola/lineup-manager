import { describe, it, expect } from 'vitest'
import { canSubmit, tryAssign, removePlayer, isLineupComplete, emptyLineupFor } from '../lineupBuilder'
import type { Lineup, Player, Tie, TieFormat } from '../types'

const AS_OF = '2026-01-01'
const tie: Tie = { id: 't1', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'B'] }

function player(id: string, gender: string, dob: string): Player {
  return { id, name: id, gender, dateOfBirth: dob }
}

/** Build a lineup: one entry per rubber (null = unfilled). */
function lineupOf(...rubbers: (string[] | null)[]): Lineup {
  return {
    tieId: 't1',
    teamId: 'A',
    playerIds: rubbers,
    status: 'draft',
    updatedAt: '2026-01-01T00:00'
  }
}

function baseArgs(extra: Partial<Parameters<typeof tryAssign>[0]>) {
  return {
    tieFormat: { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] } as TieFormat,
    tie,
    roster: [player('p1', 'M', '1990-01-01')],
    asOf: AS_OF,
    lineup: emptyLineupFor({ rubbers: [] } as TieFormat, 't1', 'A'),
    rubberIndex: 0,
    playerId: 'p1',
    teamTies: [],
    teamLineups: [],
    ...extra
  }
}

describe('tryAssign — legal picks', () => {
  it('admits an eligible singles player', () => {
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lineup.playerIds[0]).toEqual(['p1'])
  })

  it('admits the first player of a doubles rubber (partial draft allowed)', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'doubles', constraint: {}, pairRule: 'mixed' }]
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01'), player('p2', 'F', '1991-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lineup.playerIds[0]).toEqual(['p1'])
  })
})

describe('tryAssign — illegal picks are blocked with a reason', () => {
  it('blocks a gender-ineligible player', () => {
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'F', '1990-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/gender/i)
  })

  it('blocks an age-ineligible player', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'], ageMin: 40 } }]
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')], // 35 on AS_OF
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/age/i)
  })

  it('blocks over-filling a singles rubber', () => {
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01'), player('p2', 'M', '1991-01-01')],
        lineup: lineupOf(['p1']),
        playerId: 'p2'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/over-fill|single|expected|1/i)
  })

  it('blocks pairing the same player twice in a doubles rubber', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'doubles', constraint: { allowedGenders: ['M'] }, pairRule: 'any' }]
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: lineupOf(['p1']),
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/themself|same|duplicate/i)
  })

  it('blocks a pair-rule violation (same gender when mixed is required)', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'doubles', constraint: {}, pairRule: 'mixed' }]
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01'), player('p2', 'M', '1991-01-01')],
        lineup: lineupOf(['p1']),
        playerId: 'p2'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/mixed|pair|gender/i)
  })

  it('blocks within-tie overuse under at-most-once', () => {
    const fmt: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: { allowedGenders: ['M'] } },
        { format: 'singles', constraint: { allowedGenders: ['M'] } }
      ]
      // usagePolicy defaults to at-most-once
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: lineupOf(['p1'], null),
        rubberIndex: 1,
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/rubber|once|max|overuse/i)
  })
})

describe('tryAssign — cross-slot double-booking', () => {
  it('blocks a player fielded in another tie sharing the time slot', () => {
    const slot = '2026-02-01T10:00'
    const sameSlotTie: Tie = { id: 't2', scheduledStart: slot, teamIds: ['A', 'C'] }
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    // p1 is already fielded for the team in t2 (same slot).
    const otherLineup: Lineup = {
      tieId: 't2',
      teamId: 'A',
      playerIds: [['p1']],
      status: 'draft',
      updatedAt: '2026-01-01T00:00'
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        teamTies: [sameSlotTie],
        teamLineups: [otherLineup],
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/double|slot|tie/i)
  })

  it('allows a player whose other tie is in a different time slot', () => {
    const otherTie: Tie = { id: 't2', scheduledStart: '2026-02-01T14:00', teamIds: ['A', 'C'] }
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    const otherLineup: Lineup = {
      tieId: 't2',
      teamId: 'A',
      playerIds: [['p1']],
      status: 'draft',
      updatedAt: '2026-01-01T00:00'
    }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        teamTies: [otherTie],
        teamLineups: [otherLineup],
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(true)
  })

  it('does not block a pick because of a pre-existing clash between OTHER ties', () => {
    // p1 is double-booked across t2 + t3 (same slot), but the tie being edited
    // (t1) is in a different slot — adding p1 here must still be allowed.
    const slot = '2026-03-01T10:00'
    const otherTies: Tie[] = [
      { id: 't2', scheduledStart: slot, teamIds: ['A', 'C'] },
      { id: 't3', scheduledStart: slot, teamIds: ['A', 'D'] }
    ]
    const otherLineups: Lineup[] = [
      { tieId: 't2', teamId: 'A', playerIds: [['p1']], status: 'draft', updatedAt: '2026-01-01T00:00' },
      { tieId: 't3', teamId: 'A', playerIds: [['p1']], status: 'draft', updatedAt: '2026-01-01T00:00' }
    ]
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
    const r = tryAssign(
      baseArgs({
        tieFormat: fmt,
        roster: [player('p1', 'M', '1990-01-01')],
        lineup: emptyLineupFor(fmt, 't1', 'A'),
        teamTies: otherTies,
        teamLineups: otherLineups,
        playerId: 'p1'
      })
    )
    expect(r.ok).toBe(true)
  })
})

describe('removePlayer', () => {
  it('removes a player and nulls an emptied rubber', () => {
    const fmt: TieFormat = { rubbers: [{ format: 'singles', constraint: {} }] }
    const after = removePlayer(lineupOf(['p1']), 0, 'p1')
    expect(after.playerIds[0]).toBeNull()
  })

  it('removes one player from a doubles pair, leaving a partial', () => {
    const after = removePlayer(lineupOf(['p1', 'p2']), 0, 'p1')
    expect(after.playerIds[0]).toEqual(['p2'])
  })
})

describe('canSubmit', () => {
  const mensSingles: TieFormat = {
    rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }]
  }

  it('accepts a complete, valid lineup', () => {
    const r = canSubmit({
      tieFormat: mensSingles,
      tie,
      roster: [player('p1', 'M', '1990-01-01')],
      asOf: AS_OF,
      lineup: lineupOf(['p1']),
      teamTies: [],
      teamLineups: []
    })
    expect(r.ok).toBe(true)
  })

  it('rejects an incomplete lineup', () => {
    const r = canSubmit({
      tieFormat: mensSingles,
      tie,
      roster: [player('p1', 'M', '1990-01-01')],
      asOf: AS_OF,
      lineup: emptyLineupFor(mensSingles, 't1', 'A'),
      teamTies: [],
      teamLineups: []
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons.join(' ')).toMatch(/complete/i)
  })

  it('rejects a complete lineup with an illegal assignment', () => {
    // men's singles fielding a woman
    const r = canSubmit({
      tieFormat: mensSingles,
      tie,
      roster: [player('p1', 'F', '1990-01-01')],
      asOf: AS_OF,
      lineup: lineupOf(['p1']),
      teamTies: [],
      teamLineups: []
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons.join(' ')).toMatch(/gender/i)
  })

  it('rejects a complete lineup that cross-slot double-books', () => {
    const sameSlotTie: Tie = { id: 't2', scheduledStart: tie.scheduledStart, teamIds: ['A', 'C'] }
    const other: Lineup = {
      tieId: 't2',
      teamId: 'A',
      playerIds: [['p1']],
      status: 'draft',
      updatedAt: '2026-01-01T00:00'
    }
    const r = canSubmit({
      tieFormat: mensSingles,
      tie,
      roster: [player('p1', 'M', '1990-01-01')],
      asOf: AS_OF,
      lineup: lineupOf(['p1']),
      teamTies: [sameSlotTie],
      teamLineups: [other]
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reasons.join(' ')).toMatch(/double|slot|tie/i)
  })
})

describe('isLineupComplete', () => {
  it('is false while any rubber is unfilled', () => {
    const fmt: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: {} },
        { format: 'singles', constraint: {} }
      ]
    }
    expect(isLineupComplete(fmt, lineupOf(['p1'], null))).toBe(false)
  })
  it('is true when every rubber is filled', () => {
    const fmt: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: {} },
        { format: 'doubles', constraint: {}, pairRule: 'any' }
      ]
    }
    expect(isLineupComplete(fmt, lineupOf(['p1'], ['p2', 'p3']))).toBe(true)
  })
})

describe('emptyLineupFor', () => {
  it('builds an all-null, not-started lineup sized to the format', () => {
    const fmt: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: {} },
        { format: 'doubles', constraint: {}, pairRule: 'any' }
      ]
    }
    const l = emptyLineupFor(fmt, 't9', 'A')
    expect(l.tieId).toBe('t9')
    expect(l.teamId).toBe('A')
    expect(l.status).toBe('not-started')
    expect(l.playerIds).toEqual([null, null])
  })
})
