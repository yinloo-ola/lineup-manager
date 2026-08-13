import { computeCutoff, isLocked } from './cutoff'
import type { LineupStatus } from './types'

/** A tie as seen by the manager view (carries the category for cutoff lookup). */
export interface ManagerTieInput {
  id: string
  categoryId: string
  scheduledStart: string
  teamIds: [string, string]
}

export interface ManagerTieRow {
  tieId: string
  opponentTeamId: string
  opponentName: string
  scheduledStart: string
  cutoff: string
  locked: boolean
  status: LineupStatus
}

export interface BuildManagerTieRowsArgs {
  ties: ManagerTieInput[]
  myTeamId: string
  teamNameById: Map<string, string>
  leadTimeByCategory: Map<string, number>
  statusByTie: Map<string, LineupStatus>
  /** ISO instant at which "locked" is evaluated. */
  now: string
}

/**
 * Build the per-tie rows a manager sees: only their own ties, with opponent
 * name, cutoff (start - category lead time), locked flag, and lineup status.
 * Pure — the data is fetched elsewhere and passed in.
 */
export function buildManagerTieRows(args: BuildManagerTieRowsArgs): ManagerTieRow[] {
  const { ties, myTeamId, teamNameById, leadTimeByCategory, statusByTie, now } = args
  const rows: ManagerTieRow[] = []

  for (const tie of ties) {
    const isA = tie.teamIds[0] === myTeamId
    const isB = tie.teamIds[1] === myTeamId
    if (!isA && !isB) continue

    const opponentTeamId = isA ? tie.teamIds[1] : tie.teamIds[0]
    const lead = leadTimeByCategory.get(tie.categoryId) ?? 30
    const cutoff = computeCutoff(tie.scheduledStart, lead)

    rows.push({
      tieId: tie.id,
      opponentTeamId,
      opponentName: teamNameById.get(opponentTeamId) ?? opponentTeamId,
      scheduledStart: tie.scheduledStart,
      cutoff,
      locked: isLocked(cutoff, now),
      status: statusByTie.get(tie.id) ?? 'not-started'
    })
  }

  return rows
}
