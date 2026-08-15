// PROTOTYPE — shared helpers for the Matches-dashboard variants (ticket 07).
// Throwaway. Do not commit.
import { teamMatches, type MockTeamMatch } from '../mock'

export type DashFilter = 'all' | 'not-submitted' | 'submitted' | 'past-cutoff'

export const FILTERS: { key: DashFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'not-submitted', label: 'Not submitted' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'past-cutoff', label: 'Past cutoff' }
]

export type LineupStatus = 'submitted' | 'not-submitted' | 'missed-cutoff'

// Submitted / Not submitted per the settled vocabulary; a lineup still missing
// once the cutoff passed is the urgent, actionable case — Missed cutoff.
export function statusOf(m: MockTeamMatch, side: 'a' | 'b'): LineupStatus {
  const submitted = side === 'a' ? m.aSubmitted : m.bSubmitted
  if (submitted) return 'submitted'
  return m.cutoffPassed ? 'missed-cutoff' : 'not-submitted'
}

export const STATUS_META: Record<LineupStatus, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'success' },
  'not-submitted': { label: 'Not submitted', color: 'error' },
  'missed-cutoff': { label: 'Missed cutoff', color: 'error' }
}

// Sorted ascending by scheduled time, then table number (walkthrough decision).
export function matchesFor(filter: DashFilter): MockTeamMatch[] {
  return [...teamMatches]
    .sort((x, y) => x.sortKey - y.sortKey)
    .filter((m) => {
      if (filter === 'all') return true
      if (filter === 'past-cutoff') return m.cutoffPassed
      const allIn = m.aSubmitted && m.bSubmitted
      return filter === 'submitted' ? allIn : !allIn
    })
}

export function metaLine(m: MockTeamMatch): string {
  return `Group ${m.group} · Round ${m.round} · Table ${m.table} · ${m.scheduled}`
}

const players: Record<string, string[]> = Object.fromEntries(
  ['Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Delta', 'Team Echo', 'Team Foxtrot'].map(
    (t) => [t, [`${t.split(' ')[1]} #1`, `${t.split(' ')[1]} #2`, `${t.split(' ')[1]} #3`, `${t.split(' ')[1]} #4`]]
  )
)

export function lineupOf(team: string): string[] {
  return players[team] ?? []
}
