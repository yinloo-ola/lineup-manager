// Pure assembly of the administrator's all-lineups dashboard rows. Mirrors
// buildManagerTieRows but across every team's lineups, with the opponent + the
// tie's cutoff/locked state, AND a re-validated `effectiveStatus` so a submitted
// lineup that the current structure has invalidated is flagged as such (data
// retained — only the displayed status changes). Pure: no UI, no network.

import { computeCutoff, isLocked } from './cutoff'
import { effectiveStatus } from './lineupBuilder'
import { validateLineup } from './validate'
import type { LineupStatus, Player, TieFormat } from './types'

export interface AdminLineupInput {
  tieId: string
  teamId: string
  status: LineupStatus
  playerIds: (string[] | null)[]
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
  /** Stored status re-validated against the current structure. */
  effectiveStatus: LineupStatus
}

export interface BuildAdminLineupRowsArgs {
  lineups: AdminLineupInput[]
  ties: AdminTieInput[]
  teamNameById: Map<string, string>
  categoryNameById: Map<string, string>
  leadTimeByCategory: Map<string, number>
  rosterByTeam: Map<string, Player[]>
  formatByCategory: Map<string, TieFormat>
  /** ISO instant at which "locked" is evaluated. */
  now: string
}

export function buildAdminLineupRows(args: BuildAdminLineupRowsArgs): AdminLineupRow[] {
  const { lineups, ties, teamNameById, categoryNameById, leadTimeByCategory, rosterByTeam, formatByCategory, now } = args
  const tieById = new Map(ties.map((t) => [t.tieId, t]))
  const rows: AdminLineupRow[] = []

  for (const l of lineups) {
    const tie = tieById.get(l.tieId)
    if (!tie) continue // stale lineup for a deleted tie
    const opponentId = tie.teamIds[0] === l.teamId ? tie.teamIds[1] : tie.teamIds[0]
    const lead = leadTimeByCategory.get(tie.categoryId) ?? 30
    const cutoff = computeCutoff(tie.scheduledStart, lead)

    // Re-validate within-tie against the CURRENT format + roster: a submitted
    // lineup that a structural edit (constraint/rubber change) has made illegal
    // shows as `invalidated` while keeping its data.
    const fmt = formatByCategory.get(tie.categoryId)
    const roster = rosterByTeam.get(l.teamId) ?? []
    const violations = fmt
      ? validateLineup(
          fmt,
          { id: tie.tieId, scheduledStart: tie.scheduledStart, teamIds: tie.teamIds },
          { tieId: l.tieId, teamId: l.teamId, playerIds: l.playerIds, status: l.status, updatedAt: l.updatedAt },
          roster,
          { asOf: tie.scheduledStart.slice(0, 10) }
        )
      : []

    rows.push({
      ...l,
      teamName: teamNameById.get(l.teamId) ?? l.teamId,
      opponentName: teamNameById.get(opponentId) ?? opponentId,
      categoryName: categoryNameById.get(tie.categoryId) ?? tie.categoryId,
      scheduledStart: tie.scheduledStart,
      cutoff,
      locked: isLocked(cutoff, now),
      effectiveStatus: effectiveStatus(l.status, violations)
    })
  }
  return rows
}
