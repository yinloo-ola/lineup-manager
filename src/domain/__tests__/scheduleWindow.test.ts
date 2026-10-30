import { describe, it, expect } from 'vitest'
import { deriveSlots } from '../scheduleWindow'

const DAY = '2030-03-14'
const at = (hhmm: string, day = DAY): string => `${day}T${hhmm}:00+00:00`
const tie = (id: string, start: string) => ({ tieId: id, scheduledStart: start })

describe('deriveSlots', () => {
  it('clusters a referee time shift into one slot labelled by the earliest start', () => {
    const slots = deriveSlots([tie('a', at('09:00')), tie('b', at('09:20'))])
    expect(slots).toHaveLength(1)
    expect(slots[0].label).toBe('09:00')
    expect(slots[0].tieIds).toEqual(['a', 'b'])
  })

  it('separates mixed slot grids (1h and 2.5h)', () => {
    const slots = deriveSlots([
      tie('a', at('10:00')),
      tie('b', at('12:00')),
      tie('c', at('14:30'))
    ])
    expect(slots.map((s) => s.label)).toEqual(['10:00', '12:00', '14:30'])
    expect(slots[0].tieIds).toEqual(['a'])
  })

  it('clusters offset parallel events into one slot', () => {
    const slots = deriveSlots([tie('a', at('09:00')), tie('b', at('09:30'))])
    expect(slots).toHaveLength(1)
    expect(slots[0].tieIds).toEqual(['a', 'b'])
  })

  it('keeps other days as their own slots', () => {
    const slots = deriveSlots([tie('a', at('09:00')), tie('b', at('09:00', '2030-03-15'))])
    expect(slots).toHaveLength(2)
    expect(slots[0].start).toEqual(new Date(at('09:00')))
    expect(slots[1].start).toEqual(new Date(at('09:00', '2030-03-15')))
  })

  it('sorts unsorted input and tolerates null starts by ignoring them', () => {
    const slots = deriveSlots([
      tie('late', at('16:00')),
      { tieId: 'unscheduled', scheduledStart: null },
      tie('early', at('09:00'))
    ])
    expect(slots.map((s) => s.label)).toEqual(['09:00', '16:00'])
    expect(slots[1].tieIds).toEqual(['late'])
  })

  it('exactly-30-minute gaps cluster; 31-minute gaps separate', () => {
    expect(deriveSlots([tie('a', at('09:00')), tie('b', at('09:30'))])).toHaveLength(1)
    expect(deriveSlots([tie('a', at('09:00')), tie('b', at('09:31'))])).toHaveLength(2)
  })
})
