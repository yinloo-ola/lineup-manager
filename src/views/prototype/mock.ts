// PROTOTYPE — throwaway mock data for the shell variants (wayfinder ticket 06).
// In-memory only, no persistence. Do not commit.
import { computed, ref } from 'vue'

export type MockPhase = 'none' | 'before' | 'started'
export type Section = 'oversight' | 'tournaments' | 'formats' | 'provision'

export const phase = ref<MockPhase>('before')
export const activeSection = ref<Section>('oversight')

export interface MockTournament {
  name: string
  starts: string
  status: 'active' | 'upcoming' | 'past'
}

// Deliberately long — the selector must survive a growing archive of past
// tournaments (lineups stay viewable, so the list never shrinks).
export const tournaments: MockTournament[] = [
  { name: 'Spring League 2026', starts: '2026-08-14', status: 'active' },
  { name: 'Autumn Open 2026', starts: '2026-10-03', status: 'upcoming' },
  { name: 'Winter Cup 2026', starts: '2026-01-18', status: 'past' },
  { name: 'Autumn Open 2025', starts: '2025-10-05', status: 'past' },
  { name: 'Spring League 2025', starts: '2025-08-16', status: 'past' },
  { name: 'Winter Cup 2025', starts: '2025-01-19', status: 'past' },
  { name: 'Autumn Open 2024', starts: '2024-10-06', status: 'past' },
  { name: 'Spring League 2024', starts: '2024-08-17', status: 'past' },
  { name: 'Winter Cup 2024', starts: '2024-01-21', status: 'past' }
]
export const activeTournament = computed(() =>
  phase.value === 'none' ? null : tournaments[0].name
)

// Landing is setup-aware (walkthrough decision): oversight when a tournament
// exists, the empty/create state when none does. Import lives in the selector.
export function land(): void {
  activeSection.value = phase.value === 'none' ? 'tournaments' : 'oversight'
}

export interface MockTeamMatch {
  table: string
  group: string
  round: string
  teamA: string
  teamB: string
  aSubmitted: boolean
  bSubmitted: boolean
  cutoffPassed: boolean
  bNeedsAttention: boolean
  scheduled: string
  sortKey: number
}

// Sorted ascending by scheduled time, then table number (walkthrough decision).
export const teamMatches: MockTeamMatch[] = [
  { table: '1', group: 'A', round: '1', teamA: 'Team Alpha', teamB: 'Team Bravo', aSubmitted: true, bSubmitted: true, cutoffPassed: true, bNeedsAttention: false, scheduled: 'Sat 10:00', sortKey: 1 },
  { table: '2', group: 'A', round: '1', teamA: 'Team Charlie', teamB: 'Team Delta', aSubmitted: true, bSubmitted: false, cutoffPassed: false, bNeedsAttention: false, scheduled: 'Sat 10:00', sortKey: 2 },
  { table: '1', group: 'A', round: '2', teamA: 'Team Alpha', teamB: 'Team Charlie', aSubmitted: false, bSubmitted: false, cutoffPassed: true, bNeedsAttention: false, scheduled: 'Sat 11:30', sortKey: 3 },
  { table: '3', group: 'B', round: '1', teamA: 'Team Echo', teamB: 'Team Foxtrot', aSubmitted: true, bSubmitted: false, cutoffPassed: false, bNeedsAttention: true, scheduled: 'Sat 12:00', sortKey: 4 },
  { table: '2', group: 'B', round: '2', teamA: 'Team Delta', teamB: 'Team Echo', aSubmitted: true, bSubmitted: true, cutoffPassed: false, bNeedsAttention: false, scheduled: 'Sun 10:00', sortKey: 5 },
  { table: '4', group: 'B', round: '2', teamA: 'Team Bravo', teamB: 'Team Foxtrot', aSubmitted: false, bSubmitted: false, cutoffPassed: false, bNeedsAttention: false, scheduled: 'Sun 11:00', sortKey: 6 }
]
