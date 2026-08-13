import type {
  Constraint,
  Lineup,
  Player,
  Rubber,
  Tie,
  TieFormat,
  UsagePolicy,
  Violation
} from './types'
import { ageOn } from './age'

export interface ValidateOptions {
  /** Reference date (yyyy-mm-dd) at which ages are evaluated (tournament start). */
  asOf: string
}

/** Players a rubber fields: 1 for singles, 2 for doubles. */
export function expectedSlots(rubber: Rubber): number {
  return rubber.format === 'singles' ? 1 : 2
}

/**
 * Resolve a rubber constraint's `asOf` to a concrete yyyy-mm-dd. The literal
 * `'tournament-start'` and an omitted value both fall back to `fallback`
 * (the tournament/tie date); a concrete date wins.
 */
export function resolveAsOf(constraint: Constraint, fallback: string): string {
  if (constraint.asOf && constraint.asOf !== 'tournament-start') return constraint.asOf
  return fallback
}

/**
 * Validate a single Tie's Lineup against its Tie Format: per-player eligibility
 * (gender + age), doubles Pair Rule, within-Tie player usage, and completeness.
 * Does NOT check cross-slot double-booking — see {@link findDoubleBookings}.
 *
 * Pure: no UI, no network.
 */
export function validateLineup(
  tieFormat: TieFormat,
  _tie: Tie,
  lineup: Lineup,
  roster: Player[],
  opts: ValidateOptions
): Violation[] {
  const byId = new Map(roster.map((p) => [p.id, p]))
  const violations: Violation[] = []

  if (lineup.playerIds.length !== tieFormat.rubbers.length) {
    violations.push({
      kind: 'malformed',
      message: `Lineup has ${lineup.playerIds.length} rubber slot(s); the Tie Format has ${tieFormat.rubbers.length}.`
    })
    return violations
  }

  tieFormat.rubbers.forEach((rubber, rubberIndex) => {
    const slots = lineup.playerIds[rubberIndex]
    const expected = expectedSlots(rubber)
    // Age is evaluated per-rubber: honour an explicit constraint.asOf, else the
    // tournament/tie date passed as opts.asOf.
    const asOf = resolveAsOf(rubber.constraint, opts.asOf)

    if (slots == null) {
      violations.push({
        kind: 'incomplete-rubber',
        message: `Rubber ${rubberIndex} (${rubber.format}) is unfilled.`,
        rubberIndex
      })
      return
    }
    if (slots.length > expected) {
      violations.push({
        kind: 'malformed',
        message: `Rubber ${rubberIndex} (${rubber.format}) is over-filled with ${slots.length} players.`,
        rubberIndex,
        playerIds: [...slots]
      })
      return
    }

    for (const pid of slots) {
      const p = byId.get(pid)
      if (!p) {
        violations.push({
          kind: 'malformed',
          message: `Player ${pid} is not on the roster (rubber ${rubberIndex}).`,
          rubberIndex,
          playerIds: [pid]
        })
        continue
      }
      checkEligibility(p, rubber, asOf, rubberIndex, violations)
    }

    if (slots.length < expected) {
      violations.push({
        kind: 'incomplete-rubber',
        message: `Rubber ${rubberIndex} (${rubber.format}) is under-filled (${slots.length}/${expected}).`,
        rubberIndex,
        playerIds: [...slots]
      })
      return
    }

    if (rubber.format === 'doubles') {
      checkDoublesPair(rubber, slots, byId, rubberIndex, violations)
    }
  })

  checkUsage(tieFormat, lineup, byId, violations)

  return violations
}

function checkEligibility(
  p: Player,
  rubber: Rubber,
  asOf: string,
  rubberIndex: number,
  out: Violation[]
): void {
  const c = rubber.constraint
  if (c.allowedGenders && !c.allowedGenders.includes(p.gender)) {
    out.push({
      kind: 'ineligible-gender',
      message: `Player ${p.id} (gender ${p.gender}) is not permitted for rubber ${rubberIndex}.`,
      rubberIndex,
      playerIds: [p.id]
    })
  }
  if (c.ageMin !== undefined || c.ageMax !== undefined) {
    const age = ageOn(p.dateOfBirth, asOf)
    const tooYoung = c.ageMin !== undefined && age < c.ageMin
    const tooOld = c.ageMax !== undefined && age > c.ageMax
    if (tooYoung || tooOld) {
      out.push({
        kind: 'ineligible-age',
        message: `Player ${p.id} is ${age} on ${asOf}; rubber ${rubberIndex} requires age min ${
          c.ageMin ?? 'none'
        }, max ${c.ageMax ?? 'none'}.`,
        rubberIndex,
        playerIds: [p.id]
      })
    }
  }
}

function checkDoublesPair(
  rubber: Rubber,
  slots: string[],
  byId: Map<string, Player>,
  rubberIndex: number,
  out: Violation[]
): void {
  const [aId, bId] = slots
  if (aId === bId) {
    out.push({
      kind: 'malformed',
      message: `Player ${aId} cannot be paired with themself in rubber ${rubberIndex}.`,
      rubberIndex,
      playerIds: [aId]
    })
    return
  }
  const a = byId.get(aId)
  const b = byId.get(bId)
  if (!a || !b) return // unknown player is reported elsewhere
  const rule = rubber.pairRule
  if (rule === 'same-gender' && a.gender !== b.gender) {
    out.push({
      kind: 'pair-rule',
      message: `Rubber ${rubberIndex} (same-gender): ${aId} (${a.gender}) and ${bId} (${b.gender}) differ.`,
      rubberIndex,
      playerIds: [aId, bId]
    })
  } else if (rule === 'mixed' && a.gender === b.gender) {
    out.push({
      kind: 'pair-rule',
      message: `Rubber ${rubberIndex} (mixed): ${aId} and ${bId} are both ${a.gender}.`,
      rubberIndex,
      playerIds: [aId, bId]
    })
  }
}

function checkUsage(
  tieFormat: TieFormat,
  lineup: Lineup,
  byId: Map<string, Player>,
  out: Violation[]
): void {
  const policy: UsagePolicy = tieFormat.usagePolicy ?? { kind: 'at-most-once' }
  const singles = new Map<string, number>()
  const doubles = new Map<string, number>()
  const total = new Map<string, number>()

  tieFormat.rubbers.forEach((rubber, rubberIndex) => {
    const slots = lineup.playerIds[rubberIndex]
    if (!slots) return
    // A rubber counts once per player (dedupe self-pair, which is flagged elsewhere).
    for (const pid of new Set(slots)) {
      if (!byId.has(pid)) continue
      total.set(pid, (total.get(pid) ?? 0) + 1)
      if (rubber.format === 'singles') singles.set(pid, (singles.get(pid) ?? 0) + 1)
      else doubles.set(pid, (doubles.get(pid) ?? 0) + 1)
    }
  })

  for (const pid of total.keys()) {
    const s = singles.get(pid) ?? 0
    const d = doubles.get(pid) ?? 0
    const t = total.get(pid) ?? 0
    const over =
      policy.kind === 'at-most-once'
        ? t > 1
        : policy.kind === 'max-rubbers'
          ? t > policy.max
          : s > policy.maxSingles || d > policy.maxDoubles
    if (over) {
      out.push({
        kind: 'within-tie-overuse',
        message: usageMessage(pid, policy, s, d, t),
        playerIds: [pid]
      })
    }
  }
}

function usageMessage(pid: string, policy: UsagePolicy, s: number, d: number, t: number): string {
  if (policy.kind === 'singles-plus-doubles') {
    return `Player ${pid} plays ${s} singles / ${d} doubles; policy allows max ${policy.maxSingles} singles / ${policy.maxDoubles} doubles.`
  }
  const cap = policy.kind === 'max-rubbers' ? policy.max : 1
  return `Player ${pid} plays ${t} rubbers; policy allows max ${cap}.`
}

/**
 * Find players fielded in two or more Ties that share a scheduled-start time
 * slot (same `scheduledStart`). `ties` and `lineups` should cover one team's
 * fixtures. Pure.
 */
export function findDoubleBookings(ties: Tie[], lineups: Lineup[]): Violation[] {
  const startByTieId = new Map(ties.map((t) => [t.id, t.scheduledStart]))

  // slot (scheduledStart) -> playerId -> tieIds where the player is fielded
  const slotPlayerTies = new Map<string, Map<string, string[]>>()
  for (const lineup of lineups) {
    const slot = startByTieId.get(lineup.tieId)
    if (slot === undefined) continue
    let playerTies = slotPlayerTies.get(slot)
    if (!playerTies) {
      playerTies = new Map()
      slotPlayerTies.set(slot, playerTies)
    }
    const fielded = new Set<string>()
    for (const ids of lineup.playerIds) {
      if (!ids) continue
      for (const pid of ids) fielded.add(pid)
    }
    for (const pid of fielded) {
      const arr = playerTies.get(pid) ?? []
      arr.push(lineup.tieId)
      playerTies.set(pid, arr)
    }
  }

  const violations: Violation[] = []
  for (const [slot, playerTies] of slotPlayerTies) {
    for (const [pid, tieIds] of playerTies) {
      if (tieIds.length >= 2) {
        violations.push({
          kind: 'cross-slot-double-book',
          message: `Player ${pid} is fielded in ${tieIds.length} ties sharing time slot ${slot}: ${tieIds.join(', ')}.`,
          playerIds: [pid],
          tieIds: [...tieIds]
        })
      }
    }
  }
  return violations
}
