import { describe, it, expect } from 'vitest'
import { bothLineupsSubmitted, parseBestOf } from '../results'

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
