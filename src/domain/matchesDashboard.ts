// Pure assembly of the Matches dashboard (spec §5): one row per team match —
// not per lineup — with each team's lineup status in the fixture's own
// vocabulary: Submitted / Not submitted / Missed cutoff (a lineup still
// missing past the cutoff), plus the Needs attention marker for a submitted
// lineup a confirmed format edit broke. Reuses buildAdminLineupRows for the
// per-lineup re-validation. Pure: no UI, no network.

import {
  buildAdminLineupRows,
  type AdminLineupRow,
  type AdminTieInput,
  type BuildAdminLineupRowsArgs
} from './adminView'
import { computeCutoff, isLocked } from './cutoff'
import type { LineupStatus } from './types'
import { sideDisplayName } from './teamNames'

export type BuildMatchRowsArgs = BuildAdminLineupRowsArgs

/** A team's lineup status for one team match, in the on-screen vocabulary. */
export type SideStatus = 'submitted' | 'not-submitted' | 'missed-cutoff'

export interface MatchSide {
  /** Null = TBD (knockout side not yet filled). */
  teamId: string | null
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
  categoryId: string
  /** True for knockout rows — the dashboard links them into the bracket view. */
  isKnockout: boolean
  /** Null = an unscheduled knockout slot (never locks). */
  scheduledStart: string | null
  /** Seed-sourced metadata, shown where available (undefined when absent). */
  table?: string
  group?: string
  round?: string
  /** Aligned to the tie's teamIds. */
  sides: [MatchSide, MatchSide]
  cutoff: string | null
  locked: boolean
}

export type MatchFilter = 'all' | 'not-submitted' | 'submitted' | 'past-cutoff'

/** The dashboard's status derivation: submitted stays; an invalidated lineup
 *  reads Not submitted + Needs attention (it exists, it is broken — it is not
 *  "missing", so it never reads Missed cutoff); anything else is Not submitted,
 *  or Missed cutoff once the team match is past its cutoff. */
export function deriveSideStatus(effective: LineupStatus | null, locked: boolean): SideStatus {
  if (effective === 'submitted') return 'submitted'
  if (effective === 'invalidated') return 'not-submitted'
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
 *  no table sorts after a present one; no schedule sorts after everything). */
export function compareMatchRows(a: MatchRow, b: MatchRow): number {
  const ta = a.scheduledStart === null ? Number.POSITIVE_INFINITY : new Date(a.scheduledStart).getTime()
  const tb = b.scheduledStart === null ? Number.POSITIVE_INFINITY : new Date(b.scheduledStart).getTime()
  const byTime = ta - tb
  if (byTime !== 0) return byTime
  if (a.table === b.table) return a.tieId.localeCompare(b.tieId)
  if (a.table == null) return 1
  if (b.table == null) return -1
  const na = Number(a.table)
  const nb = Number(b.table)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.table.localeCompare(b.table)
}

/** Knockout rows as the dashboard renders them (spec §7): a placed entry slot
 *  adopts its pool match's schedule; pool matches bound to a slot are dropped
 *  (the slot renders); unplaced pool entries stay as generic TBD rows; byes —
 *  unscheduled, unplaced slots — never appear. Pure. */
export function mergeKnockoutForDashboard(ties: AdminTieInput[]): AdminTieInput[] {
  const byId = new Map(ties.map((t) => [t.tieId, t]))
  const placedPoolIds = new Set(
    ties.filter((t) => t.isKnockout && t.placedMatchId).map((t) => t.placedMatchId as string)
  )
  return ties.flatMap((t) => {
    if (!t.isKnockout) return [t]
    if (t.placedMatchId) {
      const pool = byId.get(t.placedMatchId)
      return pool
        ? [{ ...t, scheduledStart: pool.scheduledStart, table: pool.table ?? t.table }]
        : [t]
    }
    if (placedPoolIds.has(t.tieId)) return [] // bound pool — its slot renders
    if (t.scheduledStart !== null) return [t] // unplaced pool entry / later round
    return [] // bye — never shown on the dashboard
  })
}

export function buildMatchRows(args: BuildMatchRowsArgs): MatchRow[] {
  const { teamNameById, rosterByTeam } = args
  const ties = mergeKnockoutForDashboard(args.ties)
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
        if (teamId === null) {
          // A TBD side has no team, no lineup, nothing to miss — it can never
          // read Missed cutoff (the per-side cutoff rule).
          return {
            teamId: null,
            teamName: 'TBD',
            status: 'not-submitted',
            needsAttention: false,
            players: null,
            submittedAt: null
          }
        }
        const row = rowByTeam.get(`${tie.tieId}:${teamId}`)
        const effective = row?.effectiveStatus ?? null
        const roster = rosterByTeam.get(teamId) ?? []
        const nameById = new Map(roster.map((p) => [p.id, p.name]))
        return {
          teamId,
          teamName: sideDisplayName(teamId, teamNameById),
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
      categoryId: tie.categoryId,
      isKnockout: tie.isKnockout ?? false,
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
