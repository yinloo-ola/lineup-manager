// Pure assembly of the umpire's tie list: the group ties of the tournament
// they umpire, each with its entry gate (both sides' lineups submitted) and
// entry state. Slice 1 R2 renders locked/open; the entry state vocabulary
// grows with results display (partial/decided) in R5. Pure: no UI, no network.

import { sideDisplayName } from './teamNames'
import type { Lineup } from './types'

export interface UmpireTieInput {
  tieId: string
  scheduledStart: string | null
  table?: string
  teamIds: [string | null, string | null]
  /** Knockout ties are outside slice 1's entry surface. */
  isKnockout?: boolean
}

export interface UmpireLineupInput {
  tieId: string
  teamId: string
  status: Lineup['status']
}

export interface UmpireTieRow {
  tieId: string
  teamAName: string
  teamBName: string
  scheduledStart: string | null
  table?: string
  /** True when both sides have a submitted lineup — the entry gate. */
  entryOpen: boolean
  state: 'locked' | 'not-entered'
}

/** The reason shown on a locked row. */
export const LOCKED_REASON = 'lineup not submitted'

export function buildUmpireTieRows(args: {
  ties: UmpireTieInput[]
  lineups: UmpireLineupInput[]
  teamNameById: Map<string, string>
}): UmpireTieRow[] {
  const submitted = new Set(
    args.lineups.filter((l) => l.status === 'submitted').map((l) => `${l.tieId}:${l.teamId}`)
  )
  return args.ties
    .filter((t) => !t.isKnockout && t.teamIds[0] !== null && t.teamIds[1] !== null)
    .map((t) => {
      const teamIds = t.teamIds as [string, string]
      const entryOpen =
        submitted.has(`${t.tieId}:${teamIds[0]}`) && submitted.has(`${t.tieId}:${teamIds[1]}`)
      return {
        tieId: t.tieId,
        teamAName: sideDisplayName(teamIds[0], args.teamNameById),
        teamBName: sideDisplayName(teamIds[1], args.teamNameById),
        scheduledStart: t.scheduledStart,
        table: t.table,
        entryOpen,
        state: entryOpen ? 'not-entered' : 'locked'
      }
    })
}
