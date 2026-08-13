import { describe, it, expect } from 'vitest'
import { ageOn } from '../age'

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
