import { describe, it, expect } from 'vitest'
import { computeCutoff, isLocked } from '../cutoff'

describe('computeCutoff', () => {
  it('subtracts the lead time from the tie start, as a UTC instant', () => {
    expect(computeCutoff('2026-08-13T14:30:00Z', 30)).toBe('2026-08-13T14:00:00.000Z')
  })

  it('honours a zero lead time', () => {
    expect(computeCutoff('2026-08-13T14:30:00Z', 0)).toBe('2026-08-13T14:30:00.000Z')
  })

  it('crosses hour and day boundaries correctly', () => {
    expect(computeCutoff('2026-08-13T00:45:00Z', 90)).toBe('2026-08-12T23:15:00.000Z')
  })

  it('rejects an invalid tie-start instant', () => {
    expect(() => computeCutoff('not-a-date', 30)).toThrow()
  })

  it('rejects a negative lead time', () => {
    expect(() => computeCutoff('2026-08-13T14:30:00Z', -5)).toThrow()
  })
})

describe('isLocked', () => {
  const cutoff = '2026-08-13T14:00:00.000Z'

  it('is locked exactly at the cutoff', () => {
    expect(isLocked(cutoff, '2026-08-13T14:00:00.000Z')).toBe(true)
  })

  it('is unlocked one millisecond before the cutoff', () => {
    expect(isLocked(cutoff, '2026-08-13T13:59:59.999Z')).toBe(false)
  })

  it('is locked one millisecond after the cutoff', () => {
    expect(isLocked(cutoff, '2026-08-13T14:00:00.001Z')).toBe(true)
  })
})

describe('knockout null schedule (ko-import #12)', () => {
  it('computeCutoff yields null for an unscheduled slot', () => {
    expect(computeCutoff(null, 30)).toBeNull()
  })

  it('isLocked is false for a null cutoff — an unscheduled slot never locks', () => {
    expect(isLocked(null, '2099-01-01T00:00:00Z')).toBe(false)
  })
})
