// Tournament selector grouping (spec §4): the default menu shows Active &
// upcoming only, newest-first; past tournaments surface only while searching.
// Pure — the selector component feeds it the store list plus today's date.

export interface GroupableTournament {
  id: string
  name: string
  /** yyyy-mm-dd, or null when unset. Sorts the live group; never decides pastness. */
  startDate: string | null
  /** Date part of the tournament's last scheduled team match; null when it has none. */
  lastStart: string | null
}

export interface TournamentGroups {
  /** Still current: no last team match in the past. Newest start date first, nulls last. */
  live: GroupableTournament[]
  /** Every team match already played (last one before today). Newest first. */
  past: GroupableTournament[]
}

function matches(t: GroupableTournament, q: string): boolean {
  return t.name.toLowerCase().includes(q) || (t.startDate ?? '').includes(q)
}

/** Newest-first; a null start date sorts last (it can't be ordered by date). */
function byDateDesc(a: GroupableTournament, b: GroupableTournament): number {
  if (a.startDate === null) return 1
  if (b.startDate === null) return -1
  return b.startDate.localeCompare(a.startDate)
}

export function groupTournaments(
  list: GroupableTournament[],
  opts: { today: string; query?: string }
): TournamentGroups {
  const q = (opts.query ?? '').trim().toLowerCase()
  const filtered = list.filter((t) => !q || matches(t, q))
  // "Past" needs the schedule, not the start date: a tournament that started
  // yesterday is still running. It is past once its LAST team match is before
  // today (spec §8 — no end dates exist in the organizer model).
  const live = filtered.filter((t) => t.lastStart === null || t.lastStart >= opts.today)
  const past = filtered.filter((t) => t.lastStart !== null && t.lastStart < opts.today)
  return { live: live.sort(byDateDesc), past: past.sort(byDateDesc) }
}
