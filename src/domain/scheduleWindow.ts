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
  for (const t of timed) {
    const last = slots[slots.length - 1]
    const gapMin = last ? (t.start.getTime() - last.start.getTime()) / 60_000 : Infinity
    if (last && gapMin <= SLOT_GAP_MINUTES) {
      last.tieIds.push(t.tieId)
    } else {
      slots.push({ label: hhmm(t.start), start: t.start, tieIds: [t.tieId] })
    }
  }
  return slots
}

/**
 * The working window (venue-ux R3): the current slot is the latest one whose
 * start is at or before `now`; the window is that slot plus the next two.
 * Before the first slot, the first slot is current (nothing is live yet); the
 * window never extends past the last slot. Pure.
 */
export function computeWindow(
  slots: ScheduleSlot[],
  now: Date,
  lookahead = 2
): { first: number; last: number } {
  if (slots.length === 0) return { first: -1, last: -1 }
  let current = slots.findIndex((s) => s.start.getTime() > now.getTime()) - 1
  if (current < 0) current = slots.length - 1 // before the first slot, or after the last
  return { first: current, last: Math.min(current + lookahead, slots.length - 1) }
}

/**
 * Classification of the schedule against the window: which slot indexes are in
 * the window (rendered up top) and which are shelved (collapsible panel).
 * Pure.
 */
export function classifySlots(
  slots: ScheduleSlot[],
  window: { first: number; last: number }
): { windowed: number[]; shelved: number[] } {
  const windowed: number[] = []
  const shelved: number[] = []
  slots.forEach((_, i) => {
    if (window.first === -1 || (i >= window.first && i <= window.last)) windowed.push(i)
    else shelved.push(i)
  })
  return { windowed, shelved }
}
