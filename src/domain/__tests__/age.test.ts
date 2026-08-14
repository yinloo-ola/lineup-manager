import { describe, it, expect } from 'vitest'
import { ageOn, resolveAsOf } from '../age'

describe('ageOn', () => {
  it('counts whole years on the birthday', () => {
    expect(ageOn('2000-01-15', '2020-01-15')).toBe(20)
  })

  it('is one day short of the next birthday the day before', () => {
    expect(ageOn('2000-01-15', '2020-01-14')).toBe(19)
  })

  it('does not round up across a year boundary when the birthday has not occurred', () => {
    expect(ageOn('2000-12-31', '2020-01-01')).toBe(19)
  })

  it('handles a Feb-29 birthday against a non-leap reference year', () => {
    expect(ageOn('2000-02-29', '2021-02-28')).toBe(20)
    expect(ageOn('2000-02-29', '2021-03-01')).toBe(21)
  })

  it('throws on malformed input', () => {
    expect(() => ageOn('nope', '2020-01-01')).toThrow()
  })
})

describe('resolveAsOf', () => {
  it('uses the tournament start date when set (the real "tournament-start" anchor)', () => {
    expect(resolveAsOf('2025-06-01T00:00:00Z', '2025-06-15T10:00:00Z')).toBe('2025-06-01')
  })

  it('falls back to the team match date when the tournament has no start date', () => {
    expect(resolveAsOf(null, '2025-06-15T10:00:00Z')).toBe('2025-06-15')
  })

  it('returns just the yyyy-mm-dd even if inputs carry time components', () => {
    expect(resolveAsOf('2025-06-01T09:30:00+08:00', '2025-06-15T10:00:00Z')).toBe('2025-06-01')
  })
})
