import { describe, it, expect } from 'vitest'
import {
  bothLineupsSubmitted,
  parseBestOf,
  rubberWinner,
  tieWinner,
  validateGames
} from '../results'

describe('parseBestOf', () => {
  it('accepts odd positive numbers', () => {
    expect(parseBestOf(1)).toBe(1)
    expect(parseBestOf(5)).toBe(5)
    expect(parseBestOf(7)).toBe(7)
  })

  it('accepts numeric strings (form input)', () => {
    expect(parseBestOf('7')).toBe(7)
    expect(parseBestOf(' 5 ')).toBe(5)
  })

  it('rejects even values', () => {
    expect(() => parseBestOf(4)).toThrow(/odd/i)
    expect(() => parseBestOf('6')).toThrow(/odd/i)
  })

  it('rejects zero and negatives', () => {
    expect(() => parseBestOf(0)).toThrow(/odd/i)
    expect(() => parseBestOf(-3)).toThrow(/odd/i)
  })

  it('rejects non-integers and junk', () => {
    expect(() => parseBestOf(3.5)).toThrow(/odd/i)
    expect(() => parseBestOf('')).toThrow(/odd/i)
    expect(() => parseBestOf('five')).toThrow(/odd/i)
  })
})

describe('bothLineupsSubmitted', () => {
  const lineups = (statuses: ('submitted' | 'draft' | 'not-started' | 'invalidated')[]) =>
    statuses.map((status, i) => ({ teamId: `t${i}`, status }))

  it('is satisfied when both tie sides submitted', () => {
    expect(bothLineupsSubmitted(lineups(['submitted', 'submitted']), ['t0', 't1'])).toBe(true)
  })

  it('is unsatisfied when either side is missing or unsubmitted', () => {
    expect(bothLineupsSubmitted(lineups(['submitted', 'draft']), ['t0', 't1'])).toBe(false)
    expect(bothLineupsSubmitted(lineups(['submitted']), ['t0', 't1'])).toBe(false)
    expect(bothLineupsSubmitted([], ['t0', 't1'])).toBe(false)
  })

  it('is unsatisfied for a TBD side', () => {
    expect(bothLineupsSubmitted(lineups(['submitted', 'submitted']), ['t0', null])).toBe(false)
  })
})

describe('rubberWinner', () => {
  it('is the first side to the best-of majority', () => {
    // Best-of-5 games: majority is 3.
    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }], 5)).toBeNull()
    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 9, b: 11 }], 5)).toBeNull()
    expect(rubberWinner([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }], 5)).toBe('a')
    expect(rubberWinner([{ a: 5, b: 11 }, { a: 7, b: 11 }], 3)).toBe('b')
  })

  it('walkover is decided without games', () => {
    expect(rubberWinner([], 5, true)).toBe('a')
    expect(rubberWinner([], 5, true, 'b')).toBe('b')
    expect(rubberWinner([], 5, true, 'b')).not.toBe('a')
  })
})

describe('validateGames', () => {
  it('accepts a complete best-of majority', () => {
    expect(validateGames([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }], 5)).toEqual([])
  })

  it('accepts an incomplete rubber (still undecided)', () => {
    expect(validateGames([{ a: 11, b: 5 }], 5)).toEqual([])
  })

  it('rejects games entered after the majority is reached', () => {
    const v = validateGames([{ a: 11, b: 5 }, { a: 11, b: 7 }, { a: 11, b: 9 }, { a: 11, b: 8 }], 5)
    expect(v).toHaveLength(1)
    expect(v[0].kind).toBe('best-of-overflow')
  })

  it('rejects negative or non-integer scores', () => {
    expect(validateGames([{ a: -1, b: 5 }], 5)).toHaveLength(1)
    expect(validateGames([{ a: 10.5, b: 5 }], 5)).toHaveLength(1)
  })

  it('rejects a walkover carrying games and a walkover without a side', () => {
    expect(validateGames([{ a: 11, b: 5 }], 5, true).map((v) => v.kind)).toContain(
      'walkover-with-games'
    )
    expect(validateGames([], 5, true, undefined).map((v) => v.kind)).toContain('walkover-no-side')
    expect(validateGames([], 5, true, 'a')).toEqual([])
  })
})

describe('tieWinner', () => {
  it('is the side with the majority of rubbers; unplayed count for neither', () => {
    expect(tieWinner(['a', 'a', 'b'], 3)).toBe('a')
    expect(tieWinner(['a', 'b', null], 3)).toBeNull()
    expect(tieWinner(['b', null, null], 3)).toBeNull()
    expect(tieWinner(['a', 'a', null], 3)).toBe('a')
  })

  it('a 3-0 tie in a best-of-5-rubbers format is already decided', () => {
    expect(tieWinner(['a', 'a', 'a', null, null], 5)).toBe('a')
  })

  it('walkovers count as their side\'s rubber win', () => {
    expect(tieWinner(['a', null, null], 3, ['a'])).toBeNull()
    expect(tieWinner(['a', 'a', null], 3, ['a', 'b'])).toBe('a')
  })
})
