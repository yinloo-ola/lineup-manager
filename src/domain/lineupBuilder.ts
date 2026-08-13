// Lineup builder pure logic — the interactive hard-block decision backed by the
// Ticket 2 validation engine. A manager adds/removes roster players per Rubber;
// illegal picks (ineligible gender/age, pair-rule, within-tie overuse, over-fill,
// cross-slot clash) are refused with a clear reason, while partial lineups save
// freely as drafts. Pure: no UI, no network.

import { expectedSlots, findDoubleBookings, validateLineup } from './validate'
import type { Lineup, Player, Tie, TieFormat, Violation } from './types'

/** Shared context for validating a lineup against its tie + team fixtures. */
export interface LineupViolationsContext {
  tieFormat: TieFormat
  tie: Tie
  roster: Player[]
  asOf: string
  /** The team's other ties + their current lineups, for cross-slot clash checks.
   *  Should NOT include the tie being validated (it is represented by `lineup`). */
  teamTies: Tie[]
  teamLineups: Lineup[]
}

/** All violations for a lineup: within-tie (eligibility/pair/usage/completeness) + cross-slot. */
export function lineupViolations(lineup: Lineup, ctx: LineupViolationsContext): Violation[] {
  const within = validateLineup(ctx.tieFormat, ctx.tie, lineup, ctx.roster, { asOf: ctx.asOf })
  const otherLineups = ctx.teamLineups.filter((l) => l.tieId !== ctx.tie.id)
  const across = findDoubleBookings([ctx.tie, ...ctx.teamTies], [lineup, ...otherLineups])
  return [...within, ...across]
}

export interface TryAssignArgs {
  tieFormat: TieFormat
  tie: Tie
  roster: Player[]
  /** yyyy-mm-dd at which ages are evaluated. */
  asOf: string
  /** Current working lineup for this tie. */
  lineup: Lineup
  /** Rubber to assign into. */
  rubberIndex: number
  /** Player to assign. */
  playerId: string
  /** The team's other ties + their current lineups, for cross-slot clash checks.
   *  Should NOT include the tie being edited (it is represented by `lineup`). */
  teamTies: Tie[]
  teamLineups: Lineup[]
}

export type TryAssignResult = { ok: true; lineup: Lineup } | { ok: false; reason: string }

/**
 * Decide whether a player may be added to a rubber of the working lineup.
 * Returns the resulting lineup on success, or the first blocking reason on
 * refusal. "Incomplete rubber" is never blocking — partial drafts are allowed.
 */
export function tryAssign(args: TryAssignArgs): TryAssignResult {
  const { tieFormat, tie, roster, asOf, lineup, rubberIndex, playerId, teamTies, teamLineups } = args

  if (rubberIndex < 0 || rubberIndex >= tieFormat.rubbers.length) {
    return { ok: false, reason: `Rubber ${rubberIndex} does not exist in this Tie Format.` }
  }
  if (!roster.some((p) => p.id === playerId)) {
    return { ok: false, reason: `Player ${playerId} is not on your roster.` }
  }

  const current = lineup.playerIds[rubberIndex] ?? []
  const candidate: Lineup = {
    ...lineup,
    playerIds: lineup.playerIds.map((slots, i) =>
      i === rubberIndex ? [...current, playerId] : slots
    )
  }

  const blocking = lineupViolations(candidate, { tieFormat, tie, roster, asOf, teamTies, teamLineups }).find((v) => {
    if (v.kind === 'incomplete-rubber') return false // partial drafts are allowed
    if (v.rubberIndex === rubberIndex) return true
    return !!v.playerIds?.includes(playerId)
  })

  if (blocking) {
    return { ok: false, reason: blocking.message }
  }
  return { ok: true, lineup: candidate }
}

/** Remove a player from a rubber. Always legal (moves toward a partial/empty draft). */
export function removePlayer(lineup: Lineup, rubberIndex: number, playerId: string): Lineup {
  const current = lineup.playerIds[rubberIndex]
  if (!current) return lineup
  const next = current.filter((p) => p !== playerId)
  return {
    ...lineup,
    playerIds: lineup.playerIds.map((slots, i) =>
      i === rubberIndex ? (next.length === 0 ? null : next) : slots
    )
  }
}

/**
 * Resolve a rubber constraint's `asOf` to a concrete yyyy-mm-dd. Re-exported
 * from the validation engine (which honours it per-rubber) for callers that
 * need the same resolution.
 */
export { resolveAsOf } from './validate'

export interface CanSubmitArgs {
  tieFormat: TieFormat
  tie: Tie
  roster: Player[]
  asOf: string
  lineup: Lineup
  /** The team's other ties + their current lineups, for cross-slot clash checks. */
  teamTies: Tie[]
  teamLineups: Lineup[]
}

export type CanSubmitResult = { ok: true } | { ok: false; reasons: string[] }

/**
 * May this lineup be SUBMITTED? Requires a complete lineup with no violations
 * (eligibility, pair-rule, usage, AND cross-slot double-booking). Returns the
 * blocking reasons when not. Pure.
 */
export function canSubmit(args: CanSubmitArgs): CanSubmitResult {
  const { tieFormat, tie, roster, asOf, lineup, teamTies, teamLineups } = args
  if (!isLineupComplete(tieFormat, lineup)) {
    return { ok: false, reasons: ['Lineup is not complete — every rubber must be filled.'] }
  }
  const violations = lineupViolations(lineup, { tieFormat, tie, roster, asOf, teamTies, teamLineups })
  if (violations.length) {
    return { ok: false, reasons: violations.map((v) => v.message) }
  }
  return { ok: true }
}

/** True when every rubber is filled to its expected size. */
export function isLineupComplete(tieFormat: TieFormat, lineup: Lineup): boolean {
  if (lineup.playerIds.length !== tieFormat.rubbers.length) return false
  return tieFormat.rubbers.every((rubber, i) => {
    const slots = lineup.playerIds[i]
    return !!slots && slots.length === expectedSlots(rubber)
  })
}

/** A fresh, all-null, not-started lineup sized to a Tie Format. */
export function emptyLineupFor(
  tieFormat: TieFormat,
  tieId: string,
  teamId: string
): Lineup {
  return {
    tieId,
    teamId,
    playerIds: tieFormat.rubbers.map(() => null),
    status: 'not-started',
    updatedAt: new Date(0).toISOString()
  }
}
