import { describe, it, expect } from 'vitest'
import { parseBestOf } from '../results'

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
