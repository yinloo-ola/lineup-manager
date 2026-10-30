import { describe, it, expect } from 'vitest'
import { classifySlots, computeWindow, deriveSlots } from '../scheduleWindow'

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

describe('computeWindow', () => {
  const slots = deriveSlots([
    tie('a', at('09:00')),
    tie('b', at('10:30')),
    tie('c', at('13:30')),
    tie('d', at('16:00'))
  ])

  it('mid-morning: current slot plus the next two', () => {
    const w = computeWindow(slots, new Date(at('11:20')))
    expect(w).toEqual({ first: 1, last: 3 })
  })

  it('mid-slot: the slot is current from its start', () => {
    expect(computeWindow(slots, new Date(at('10:30')))).toEqual({ first: 1, last: 3 })
    expect(computeWindow(slots, new Date(at('10:29')))).toEqual({ first: 0, last: 2 })
  })

  it('before the first slot, the first slot is current', () => {
    expect(computeWindow(slots, new Date(at('07:00')))).toEqual({ first: 0, last: 2 })
  })

  it('after the last slot, the last slot is current', () => {
    expect(computeWindow(slots, new Date(at('20:00')))).toEqual({ first: 3, last: 3 })
  })

  it('never extends past the last slot', () => {
    const w = computeWindow(slots, new Date(at('15:00')))
    expect(w).toEqual({ first: 2, last: 3 })
  })

  it('returns an empty window for an empty schedule', () => {
    expect(computeWindow([], new Date(at('10:00')))).toEqual({ first: -1, last: -1 })
  })
})

describe('classifySlots', () => {
  const slots = deriveSlots([
    tie('a', at('09:00')),
    tie('b', at('10:30')),
    tie('c', at('13:30')),
    tie('d', at('16:00'))
  ])

  it('splits windowed from shelved in slot order', () => {
    const { windowed, shelved } = classifySlots(slots, { first: 1, last: 3 })
    expect(windowed).toEqual([1, 2, 3])
    expect(shelved).toEqual([0])
  })

  it('shelves everything when the window is empty', () => {
    const { windowed, shelved } = classifySlots(slots, { first: -1, last: -1 })
    expect(windowed).toEqual([])
    expect(shelved).toEqual([0, 1, 2, 3])
  })

  it('a full window shelves nothing', () => {
    const { windowed, shelved } = classifySlots(slots, { first: 0, last: 3 })
    expect(windowed).toEqual([0, 1, 2, 3])
    expect(shelved).toEqual([])
  })

  it('other-day slots are just later slots — they shelve when outside the window', () => {
    const multi = deriveSlots([
      tie('a', at('16:00')),
      tie('b', at('09:00', '2030-03-15')) // next day
    ])
    const w = computeWindow(multi, new Date(at('16:30')))
    expect(w).toEqual({ first: 0, last: 0 })
    const { windowed, shelved } = classifySlots(multi, w)
    expect(windowed).toEqual([0])
    expect(shelved).toEqual([1])
  })
})
