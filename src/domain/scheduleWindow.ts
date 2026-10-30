// Pure venue-schedule shaping (venue-ux R2/R3): timeslots derived from the
// team matches' scheduled starts, and the working window (current slot plus
// the next two) that decides what stays on screen versus what shelves.
//
// Slot reality: durations vary by event (1h, 2h, 2.5h), parallel events run
// offset grids, and referee edits shift individual matches by minutes. So a
// slot is NOT an hour bucket — it is a cluster of distinct start times where a
// gap of more than SLOT_GAP_MINUTES between consecutive starts opens a new
// slot. No schema involvement; the input is whatever the views already load.

/** A gap longer than this between consecutive starts opens a new slot. */
export const SLOT_GAP_MINUTES = 30

export interface SchedulableTie {
  tieId: string
  /** ISO date-time, tournament-local; null = unscheduled (never slotted). */
  scheduledStart: string | null
}

export interface ScheduleSlot {
  /** 'HH:MM' of the slot's earliest start — the on-screen label. */
  label: string
  /** The slot's earliest start. */
  start: Date
  /** Ties belonging to the slot, in given order. */
  tieIds: string[]
}

/** 'HH:MM' in UTC for a slot start (scheduled starts are tournament-local ISO). */
function hhmm(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/**
 * Derive timeslots: distinct scheduled starts sorted ascending, clustered so a
 * gap of more than {@link SLOT_GAP_MINUTES} opens a new slot. Unscheduled ties
 * (null starts — knockout slots) never join a slot. Pure.
 */
export function deriveSlots(ties: SchedulableTie[]): ScheduleSlot[] {
  const timed = ties
    .filter((t): t is SchedulableTie & { scheduledStart: string } => t.scheduledStart !== null)
    .map((t) => ({ tieId: t.tieId, start: new Date(t.scheduledStart) }))
    .filter((t) => !Number.isNaN(t.start.getTime()))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  const slots: ScheduleSlot[] = []
  let prevStart: number | null = null
  for (const t of timed) {
    const gapMin = prevStart === null ? Infinity : (t.start.getTime() - prevStart) / 60_000
    const last = slots[slots.length - 1]
    if (last && gapMin <= SLOT_GAP_MINUTES) {
      last.tieIds.push(t.tieId)
    } else {
      slots.push({ label: hhmm(t.start), start: t.start, tieIds: [t.tieId] })
    }
    prevStart = t.start.getTime()
  }
  return slots
}

/** UTC midnight of a slot start — slots never window across a day boundary. */
function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/**
 * The working window (venue-ux R3): the current slot is the latest one whose
 * start is at or before `now` (before the first slot, the first slot is
 * current); the window is that slot plus the next two — but never across a
 * day boundary, so day-two matches always shelve on day one. Pure.
 */
export function computeWindow(
  slots: ScheduleSlot[],
  now: Date,
  lookahead = 2
): { first: number; last: number } {
  if (slots.length === 0) return { first: -1, last: -1 }
  const t = now.getTime()
  let current: number
  if (t < slots[0].start.getTime()) {
    current = 0
  } else {
    current = slots.length - 1
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i].start.getTime() > t) {
        current = i - 1
        break
      }
    }
  }
  const day = startOfUtcDay(slots[current].start)
  let last = current
  for (let i = current + 1; i < slots.length && i <= current + lookahead; i += 1) {
    if (startOfUtcDay(slots[i].start) !== day) break
    last = i
  }
  return { first: current, last }
}

/**
 * In-slot ordering: by actual scheduled start, then table (venue-ux R4's
 * time-then-table rule inside a clustered slot — referee shifts make the
 * starts differ within one slot). Pure.
 */
export function sortSlotTies<T extends { scheduledStart: string | null; table?: string }>(
  rows: T[]
): T[] {
  const tableOf = (t: T): number => (t.table != null && Number.isFinite(Number(t.table)) ? Number(t.table) : Number.POSITIVE_INFINITY)
  return [...rows].sort((a, b) => {
    const ta = a.scheduledStart ?? ''
    const tb = b.scheduledStart ?? ''
    if (ta !== tb) return ta < tb ? -1 : 1
    return tableOf(a) - tableOf(b)
  })
}

/**
 * Classification of the schedule against the window: which slot indexes are in
 * the window (rendered up top) and which are shelved (collapsible panel).
 * The show-all escape is the view's decision — it skips classification
 * entirely rather than passing a "full" window. Pure.
 */
export function classifySlots(
  slots: ScheduleSlot[],
  window: { first: number; last: number }
): { windowed: number[]; shelved: number[] } {
  const windowed: number[] = []
  const shelved: number[] = []
  slots.forEach((_, i) => {
    if (i >= window.first && i <= window.last) windowed.push(i)
    else shelved.push(i)
  })
  return { windowed, shelved }
}
