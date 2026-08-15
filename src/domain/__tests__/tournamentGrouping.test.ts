import { describe, it, expect } from 'vitest'
import { groupTournaments } from '../tournamentGrouping'

// "Today" fixed so the grouping under test is deterministic.
const TODAY = '2026-08-15'

const T = (id: string, name: string, startDate: string | null, lastStart: string | null) => ({
  id,
  name,
  startDate,
  lastStart
})

const LIST = [
  T('a', 'Spring League 2026', '2026-08-14', '2026-08-16'), // running (started, ends tomorrow)
  T('b', 'Autumn Open 2026', '2026-10-03', '2026-10-04'), // upcoming
  T('c', 'Spring League 2025', '2025-08-16', '2025-08-17'), // past
  T('d', 'Autumn Open 2025', '2025-10-05', '2025-10-05'), // past (last match exactly a year ago)
  T('e', 'Winter Cup', null, null) // no dates at all — can't be past
]

describe('groupTournaments — default (no query)', () => {
  it('keeps a running tournament (started yesterday, ends tomorrow) live', () => {
    const { live } = groupTournaments(LIST, { today: TODAY })
    expect(live.map((t) => t.id)).toContain('a')
  })

  it('splits Active & upcoming from Past by the LAST team match, newest-first', () => {
    const { live, past } = groupTournaments(LIST, { today: TODAY })
    expect(live.map((t) => t.id)).toEqual(['b', 'a', 'e'])
    expect(past.map((t) => t.id)).toEqual(['d', 'c'])
  })

  it('treats a last team match of today as live (still playing)', () => {
    const { live } = groupTournaments([T('x', 'X', '2026-08-01', TODAY)], { today: TODAY })
    expect(live).toHaveLength(1)
  })

  it('places tournaments without a start date at the end of live', () => {
    const { live } = groupTournaments(LIST, { today: TODAY })
    expect(live.at(-1)?.id).toBe('e')
  })
})

describe('groupTournaments — searching', () => {
  it('matches names case-insensitively and surfaces past tournaments under search', () => {
    const { live, past } = groupTournaments(LIST, { today: TODAY, query: 'spring league' })
    expect(live.map((t) => t.id)).toEqual(['a'])
    expect(past.map((t) => t.id)).toEqual(['c'])
  })

  it('matches start dates too (year search)', () => {
    const { live, past } = groupTournaments(LIST, { today: TODAY, query: '2025' })
    expect(live).toEqual([])
    expect(past.map((t) => t.id)).toEqual(['d', 'c'])
  })

  it('ignores surrounding whitespace in the query', () => {
    const { live } = groupTournaments(LIST, { today: TODAY, query: '  autumn  ' })
    expect(live.map((t) => t.id)).toEqual(['b'])
  })

  it('returns empty groups when nothing matches', () => {
    const { live, past } = groupTournaments(LIST, { today: TODAY, query: 'nope' })
    expect(live).toEqual([])
    expect(past).toEqual([])
  })
})
