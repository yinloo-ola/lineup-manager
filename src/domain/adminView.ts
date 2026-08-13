// Pure assembly of the administrator's all-lineups dashboard rows. Mirrors
// buildManagerTieRows but across every team's lineups, with the opponent + the
// tie's cutoff/locked state for each. Pure: no UI, no network.

import { computeCutoff, isLocked } from './cutoff'
import type { LineupStatus } from './types'

export interface AdminLineupInput {
  tieId: string
  teamId: string
  status: LineupStatus
  updatedAt: string
  updatedBy: string | null
}

export interface AdminTieInput {
  tieId: string
  categoryId: string
  scheduledStart: string
  teamIds: [string, string]
}

export interface AdminLineupRow extends AdminLineupInput {
  teamName: string
  opponentName: string
  categoryName: string
  scheduledStart: string
  cutoff: string
  locked: boolean
}

export interface BuildAdminLineupRowsArgs {
  lineups: AdminLineupInput[]
  ties: AdminTieInput[]
  teamNameById: Map<string, string>
  categoryNameById: Map<string, string>
  leadTimeByCategory: Map<string, number>
  /** ISO instant at which "locked" is evaluated. */
  now: string
}

export function buildAdminLineupRows(args: BuildAdminLineupRowsArgs): AdminLineupRow[] {
  const { lineups, ties, teamNameById, categoryNameById, leadTimeByCategory, now } = args
  const tieById = new Map(ties.map((t) => [t.tieId, t]))
  const rows: AdminLineupRow[] = []

  for (const l of lineups) {
    const tie = tieById.get(l.tieId)
    if (!tie) continue // stale lineup for a deleted tie
    const opponentId = tie.teamIds[0] === l.teamId ? tie.teamIds[1] : tie.teamIds[0]
    const lead = leadTimeByCategory.get(tie.categoryId) ?? 30
    const cutoff = computeCutoff(tie.scheduledStart, lead)
    rows.push({
      ...l,
      teamName: teamNameById.get(l.teamId) ?? l.teamId,
      opponentName: teamNameById.get(opponentId) ?? opponentId,
      categoryName: categoryNameById.get(tie.categoryId) ?? tie.categoryId,
      scheduledStart: tie.scheduledStart,
      cutoff,
      locked: isLocked(cutoff, now)
    })
  }
  return rows
}
