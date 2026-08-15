// Pure assembly of the Matches dashboard (spec §5): one row per team match —
// not per lineup — with each team's lineup status in the fixture's own
// vocabulary: Submitted / Not submitted / Missed cutoff (a lineup still
// missing past the cutoff), plus the Needs attention marker for a submitted
// lineup a confirmed format edit broke. Reuses buildAdminLineupRows for the
// per-lineup re-validation. Pure: no UI, no network.

import { buildAdminLineupRows, type AdminLineupRow, type BuildAdminLineupRowsArgs } from './adminView'
import { computeCutoff, isLocked } from './cutoff'
import type { LineupStatus } from './types'

export type BuildMatchRowsArgs = BuildAdminLineupRowsArgs

/** A team's lineup status for one team match, in the on-screen vocabulary. */
export type SideStatus = 'submitted' | 'not-submitted' | 'missed-cutoff'

export interface MatchSide {
  teamId: string
  teamName: string
  status: SideStatus
  /** A submitted lineup the current structure has broken (reads Not submitted + marker). */
  needsAttention: boolean
  /** Player display names per match, aligned to the format; null = no lineup saved. */
  players: (string[] | null)[] | null
  submittedAt: string | null
}

export interface MatchRow {
  tieId: string
  scheduledStart: string
  /** Seed-sourced metadata, shown where available (undefined when absent). */
  table?: string
  group?: string
  round?: string
  /** Aligned to the tie's teamIds. */
  sides: [MatchSide, MatchSide]
  cutoff: string
  locked: boolean
}

export type MatchFilter = 'all' | 'not-submitted' | 'submitted' | 'past-cutoff'

/** The dashboard's status derivation: submitted stays, everything else is Not
 *  submitted — or Missed cutoff once the team match is past its cutoff. */
export function deriveSideStatus(effective: LineupStatus | null, locked: boolean): SideStatus {
  if (effective === 'submitted') return 'submitted'
  return locked ? 'missed-cutoff' : 'not-submitted'
}

/** True when either team's lineup is still missing past the cutoff (red row). */
export function matchMissesCutoff(match: MatchRow): boolean {
  return match.sides.some((s) => s.status === 'missed-cutoff')
}

export function matchMatchesFilter(match: MatchRow, filter: MatchFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'submitted':
      return match.sides.every((s) => s.status === 'submitted')
    case 'not-submitted':
      return match.sides.some((s) => s.status !== 'submitted')
    case 'past-cutoff':
      return match.locked
  }
}

/** Ascending by scheduled time, then table number (numeric where both are;
 *  no table sorts after a present one). */
export function compareMatchRows(a: MatchRow, b: MatchRow): number {
  const byTime =
    new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
  if (byTime !== 0) return byTime
  if (a.table === b.table) return a.tieId.localeCompare(b.tieId)
  if (a.table == null) return 1
  if (b.table == null) return -1
  const na = Number(a.table)
  const nb = Number(b.table)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.table.localeCompare(b.table)
}

export function buildMatchRows(args: BuildMatchRowsArgs): MatchRow[] {
  const { ties, teamNameById, rosterByTeam } = args
  const lineups = args.lineups.filter((l) => ties.some((t) => t.tieId === l.tieId))
  const validated: AdminLineupRow[] = buildAdminLineupRows({ ...args, lineups })
  const rowByTeam = new Map(validated.map((r) => [`${r.tieId}:${r.teamId}`, r]))

  const matches: MatchRow[] = ties.map((tie) => {
    // Every side of a tie shares its cutoff/locked state — computed here so a
    // tie with no lineups at all still filters and chips correctly.
    const lead = args.leadTimeByCategory.get(tie.categoryId) ?? 30
    const cutoff = computeCutoff(tie.scheduledStart, lead)
    const locked = isLocked(cutoff, args.now)
    const sides = tie.teamIds.map(
      (teamId): MatchSide => {
        const row = rowByTeam.get(`${tie.tieId}:${teamId}`)
        const effective = row?.effectiveStatus ?? null
        const roster = rosterByTeam.get(teamId) ?? []
        const nameById = new Map(roster.map((p) => [p.id, p.name]))
        return {
          teamId,
          teamName: teamNameById.get(teamId) ?? teamId,
          status: deriveSideStatus(effective, locked),
          needsAttention: effective === 'invalidated',
          players:
            row != null
              ? row.playerIds.map((slot) =>
                  slot == null ? null : slot.map((id) => nameById.get(id) ?? id)
                )
              : null,
          submittedAt: row?.submittedAt ?? null
        }
      }
    )
    return {
      tieId: tie.tieId,
      scheduledStart: tie.scheduledStart,
      table: tie.table,
      group: tie.group,
      round: tie.round,
      sides: [sides[0], sides[1]],
      cutoff,
      locked
    }
  })

  return matches.sort(compareMatchRows)
}
