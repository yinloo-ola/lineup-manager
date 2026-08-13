import { describe, it, expect } from 'vitest'
import { expectedSlots, findDoubleBookings, resolveAsOf, validateLineup } from '../validate'
import type { Lineup, PairRule, Player, Rubber, Tie, TieFormat, ViolationKind } from '../types'

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

function kinds(violations: { kind: ViolationKind }[]): ViolationKind[] {
  return violations.map((v) => v.kind).sort()
}

describe('validateLineup — eligibility', () => {
  it("admits an eligible men's-singles player", () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }]
    }
    const roster = [player('p1', 'M', '1990-01-01')]
    expect(validateLineup(fmt, tie, lineupOf(['p1']), roster, { asOf: AS_OF })).toEqual([])
  })

  it("rejects a woman from men's singles", () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }]
    }
    const roster = [player('p1', 'F', '1990-01-01')]
    const v = validateLineup(fmt, tie, lineupOf(['p1']), roster, { asOf: AS_OF })
    expect(kinds(v)).toEqual(['ineligible-gender'])
    expect(v[0].playerIds).toEqual(['p1'])
    expect(v[0].rubberIndex).toBe(0)
  })

  it("rejects a man from women's singles", () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['F'] } }]
    }
    const roster = [player('p1', 'M', '1990-01-01')]
    expect(kinds(validateLineup(fmt, tie, lineupOf(['p1']), roster, { asOf: AS_OF }))).toEqual([
      'ineligible-gender'
    ])
  })

  it('enforces ageMin on a veteran-doubles rubber', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'doubles', constraint: { ageMin: 40 }, pairRule: 'any' }]
    }
    const old1 = player('old1', 'M', '1984-06-01') // 41
    const old2 = player('old2', 'M', '1982-01-01') // 43
    const young = player('young', 'M', '1990-01-01') // 36
    const roster = [old1, old2, young]

    expect(validateLineup(fmt, tie, lineupOf(['old1', 'old2']), roster, { asOf: AS_OF })).toEqual([])
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['old1', 'young']), roster, { asOf: AS_OF }))
    ).toEqual(['ineligible-age'])
  })

  it('enforces gender + ageMax together (under-18 boys)', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'], ageMax: 17 } }]
    }
    const boyU16 = player('b1', 'M', '2010-01-01') // 16
    const boy19 = player('b2', 'M', '2006-12-31') // 18 on 2026-01-01 → over 17
    const girl = player('g1', 'F', '2012-01-01') // 14 but wrong gender
    const roster = [boyU16, boy19, girl]

    expect(validateLineup(fmt, tie, lineupOf(['b1']), roster, { asOf: AS_OF })).toEqual([])
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['b2']), roster, { asOf: AS_OF }))
    ).toEqual(['ineligible-age'])
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['g1']), roster, { asOf: AS_OF }))
    ).toEqual(['ineligible-gender'])
  })
})

describe('validateLineup — doubles pair rule', () => {
  const m1 = player('m1', 'M', '1990-01-01')
  const m2 = player('m2', 'M', '1991-01-01')
  const f1 = player('f1', 'F', '1992-01-01')
  const f2 = player('f2', 'F', '1993-01-01')
  const roster = [m1, m2, f1, f2]
  const openFmt = (pairRule: PairRule): TieFormat => ({
    rubbers: [{ format: 'doubles', constraint: { allowedGenders: ['M', 'F'] }, pairRule }]
  })

  it('same-gender accepts a same-gender pair', () => {
    expect(
      validateLineup(openFmt('same-gender'), tie, lineupOf(['m1', 'm2']), roster, { asOf: AS_OF })
    ).toEqual([])
    expect(
      validateLineup(openFmt('same-gender'), tie, lineupOf(['f1', 'f2']), roster, { asOf: AS_OF })
    ).toEqual([])
  })

  it('same-gender rejects a mixed pair', () => {
    const v = validateLineup(openFmt('same-gender'), tie, lineupOf(['m1', 'f1']), roster, {
      asOf: AS_OF
    })
    expect(kinds(v)).toEqual(['pair-rule'])
    expect(v[0].rubberIndex).toBe(0)
  })

  it('mixed accepts one-of-each', () => {
    expect(
      validateLineup(openFmt('mixed'), tie, lineupOf(['m1', 'f1']), roster, { asOf: AS_OF })
    ).toEqual([])
  })

  it('mixed rejects a same-gender pair', () => {
    expect(
      kinds(validateLineup(openFmt('mixed'), tie, lineupOf(['m1', 'm2']), roster, { asOf: AS_OF }))
    ).toEqual(['pair-rule'])
    expect(
      kinds(validateLineup(openFmt('mixed'), tie, lineupOf(['f1', 'f2']), roster, { asOf: AS_OF }))
    ).toEqual(['pair-rule'])
  })

  it('any accepts any pairing', () => {
    expect(
      validateLineup(openFmt('any'), tie, lineupOf(['m1', 'f1']), roster, { asOf: AS_OF })
    ).toEqual([])
    expect(
      validateLineup(openFmt('any'), tie, lineupOf(['m1', 'm2']), roster, { asOf: AS_OF })
    ).toEqual([])
  })

  it('flags a player paired with themself as malformed', () => {
    const fmt: TieFormat = {
      rubbers: [{ format: 'doubles', constraint: { allowedGenders: ['M'] }, pairRule: 'any' }]
    }
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['m1', 'm1']), [m1], { asOf: AS_OF }))
    ).toEqual(['malformed'])
  })
})

describe('validateLineup — within-tie usage', () => {
  const m1 = player('m1', 'M', '1990-01-01')
  const m2 = player('m2', 'M', '1991-01-01')
  const m3 = player('m3', 'M', '1989-01-01')
  const m4 = player('m4', 'M', '1988-01-01')
  const m5 = player('m5', 'M', '1987-01-01')
  const roster = [m1, m2, m3, m4, m5]
  const S = (): Rubber => ({ format: 'singles', constraint: { allowedGenders: ['M'] } })
  const D = (): Rubber => ({ format: 'doubles', constraint: { allowedGenders: ['M'] }, pairRule: 'any' })

  it('default policy is at-most-once', () => {
    const fmt: TieFormat = { rubbers: [S(), S()] }
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['m1'], ['m1']), roster, { asOf: AS_OF }))
    ).toEqual(['within-tie-overuse'])
    expect(validateLineup(fmt, tie, lineupOf(['m1'], ['m2']), roster, { asOf: AS_OF })).toEqual([])
  })

  it('max-rubbers allows up to the cap', () => {
    const fmt: TieFormat = {
      rubbers: [S(), S(), S()],
      usagePolicy: { kind: 'max-rubbers', max: 2 }
    }
    expect(
      validateLineup(fmt, tie, lineupOf(['m1'], ['m1'], ['m2']), roster, { asOf: AS_OF })
    ).toEqual([])
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['m1'], ['m1'], ['m1']), roster, { asOf: AS_OF }))
    ).toEqual(['within-tie-overuse'])
  })

  it('singles-plus-doubles: one singles + one doubles is allowed, more is not', () => {
    const fmt: TieFormat = {
      rubbers: [S(), S(), D(), D()],
      usagePolicy: { kind: 'singles-plus-doubles', maxSingles: 1, maxDoubles: 1 }
    }
    expect(
      validateLineup(
        fmt,
        tie,
        lineupOf(['m1'], ['m2'], ['m1', 'm3'], ['m2', 'm4']),
        roster,
        { asOf: AS_OF }
      )
    ).toEqual([])
    expect(
      kinds(
        validateLineup(fmt, tie, lineupOf(['m1'], ['m1'], ['m2', 'm3'], ['m4', 'm5']), roster, {
          asOf: AS_OF
        })
      )
    ).toEqual(['within-tie-overuse'])
    expect(
      kinds(
        validateLineup(fmt, tie, lineupOf(['m2'], ['m3'], ['m1', 'm4'], ['m1', 'm5']), roster, {
          asOf: AS_OF
        })
      )
    ).toEqual(['within-tie-overuse'])
  })
})

describe('validateLineup — completeness & shape', () => {
  const m1 = player('m1', 'M', '1990-01-01')
  const m2 = player('m2', 'M', '1991-01-01')
  const m3 = player('m3', 'M', '1989-01-01')
  const roster = [m1, m2, m3]
  const S = (): Rubber => ({ format: 'singles', constraint: { allowedGenders: ['M'] } })
  const D = (): Rubber => ({ format: 'doubles', constraint: { allowedGenders: ['M'] }, pairRule: 'any' })

  it('flags an unfilled rubber as incomplete', () => {
    const fmt: TieFormat = { rubbers: [S()] }
    const v = validateLineup(fmt, tie, lineupOf(null), roster, { asOf: AS_OF })
    expect(kinds(v)).toEqual(['incomplete-rubber'])
    expect(v[0].rubberIndex).toBe(0)
  })

  it('flags an under-filled doubles rubber as incomplete', () => {
    const fmt: TieFormat = { rubbers: [D()] }
    expect(kinds(validateLineup(fmt, tie, lineupOf(['m1']), roster, { asOf: AS_OF }))).toEqual([
      'incomplete-rubber'
    ])
  })

  it('passes a fully-filled multi-rubber lineup', () => {
    const fmt: TieFormat = { rubbers: [S(), D()] }
    expect(
      validateLineup(fmt, tie, lineupOf(['m1'], ['m2', 'm3']), roster, { asOf: AS_OF })
    ).toEqual([])
  })

  it('flags an unknown player id as malformed', () => {
    const fmt: TieFormat = { rubbers: [S()] }
    expect(kinds(validateLineup(fmt, tie, lineupOf(['ghost']), roster, { asOf: AS_OF }))).toEqual([
      'malformed'
    ])
  })

  it('flags an over-filled singles rubber as malformed', () => {
    const fmt: TieFormat = { rubbers: [S()] }
    expect(
      kinds(validateLineup(fmt, tie, lineupOf(['m1', 'm2']), roster, { asOf: AS_OF }))
    ).toEqual(['malformed'])
  })

  it('flags a lineup whose length does not match the Tie Format', () => {
    const fmt: TieFormat = { rubbers: [S(), S()] }
    expect(kinds(validateLineup(fmt, tie, lineupOf(['m1']), roster, { asOf: AS_OF }))).toEqual([
      'malformed'
    ])
  })
})

describe('findDoubleBookings — cross-slot double-booking', () => {
  function lineupFor(tieId: string, ids: (string[] | null)[]): Lineup {
    return { tieId, teamId: 'A', playerIds: ids, status: 'draft', updatedAt: '2026-01-01T00:00' }
  }

  it('flags a player fielded in two ties sharing a time slot', () => {
    const ties: Tie[] = [
      { id: 't1', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'B'] },
      { id: 't2', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'C'] }
    ]
    const lineups = [lineupFor('t1', [['m1']]), lineupFor('t2', [['m1']])]
    const v = findDoubleBookings(ties, lineups)
    expect(v).toHaveLength(1)
    expect(v[0].kind).toBe('cross-slot-double-book')
    expect(v[0].playerIds).toEqual(['m1'])
    expect(v[0].tieIds).toEqual(['t1', 't2'])
  })

  it('does not flag a player in ties on different time slots', () => {
    const ties: Tie[] = [
      { id: 't1', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'B'] },
      { id: 't2', scheduledStart: '2026-02-01T12:00', teamIds: ['A', 'C'] }
    ]
    const lineups = [lineupFor('t1', [['m1']]), lineupFor('t2', [['m1']])]
    expect(findDoubleBookings(ties, lineups)).toEqual([])
  })

  it('ignores different players across ties in the same slot', () => {
    const ties: Tie[] = [
      { id: 't1', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'B'] },
      { id: 't2', scheduledStart: '2026-02-01T10:00', teamIds: ['A', 'C'] }
    ]
    const lineups = [lineupFor('t1', [['m1']]), lineupFor('t2', [['m2']])]
    expect(findDoubleBookings(ties, lineups)).toEqual([])
  })

  it('lists all conflicting ties when a player spans three ties in one slot', () => {
    const ties: Tie[] = [
      { id: 't1', scheduledStart: 'S', teamIds: ['A', 'B'] },
      { id: 't2', scheduledStart: 'S', teamIds: ['A', 'C'] },
      { id: 't3', scheduledStart: 'S', teamIds: ['A', 'D'] }
    ]
    const lineups = [
      lineupFor('t1', [['m1']]),
      lineupFor('t2', [['m1']]),
      lineupFor('t3', [['m1']])
    ]
    const v = findDoubleBookings(ties, lineups)
    expect(v).toHaveLength(1)
    expect([...(v[0].tieIds ?? [])].sort()).toEqual(['t1', 't2', 't3'])
  })
})

describe('resolveAsOf', () => {
  it('uses a concrete constraint date', () => {
    expect(resolveAsOf({ asOf: '2026-06-06' }, '2026-01-01')).toBe('2026-06-06')
  })
  it('falls back when asOf is the literal "tournament-start"', () => {
    expect(resolveAsOf({ asOf: 'tournament-start' }, '2026-01-01')).toBe('2026-01-01')
  })
  it('falls back when asOf is omitted', () => {
    expect(resolveAsOf({}, '2026-01-01')).toBe('2026-01-01')
  })
})

describe('expectedSlots', () => {
  it('is 1 for singles and 2 for doubles', () => {
    expect(expectedSlots({ format: 'singles', constraint: {} })).toBe(1)
    expect(expectedSlots({ format: 'doubles', constraint: {}, pairRule: 'any' })).toBe(2)
  })
})

describe('validateLineup — per-rubber asOf', () => {
  it('honours a rubber constraint.asOf instead of the global opts.asOf', () => {
    // Age min 18 evaluated as of 2020-01-01 (per-rubber), not the 2026 default.
    const fmt: TieFormat = {
      rubbers: [
        { format: 'singles', constraint: { allowedGenders: ['M'], ageMin: 18, asOf: '2020-01-01' } }
      ]
    }
    // Born 2005-01-01: age 15 on 2020-01-01 (too young) but 21 on 2026-01-01.
    const roster = [player('p1', 'M', '2005-01-01')]
    expect(kinds(validateLineup(fmt, tie, lineupOf(['p1']), roster, { asOf: AS_OF }))).toEqual([
      'ineligible-age'
    ])
  })
})
