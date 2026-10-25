// Pure results domain for team matches — derivation and validation over stored
// rubber results. Nothing here touches Supabase; services map rows in/out.

import { ParseError } from './parse-helpers'
import type { LineupStatus } from './types'

/**
 * Validate a tie's best-of-games setting: a positive odd integer (5 is the
 * default every tie imports with; the admin may override per tie).
 * Returns the parsed number; throws {@link ParseError} on any violation.
 * Pure.
 */
export function parseBestOf(input: unknown): number {
  const raw = typeof input === 'string' ? input.trim() : input
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (
    typeof n !== 'number' ||
    !Number.isInteger(n) ||
    n <= 0 ||
    n % 2 !== 1
  ) {
    throw new ParseError('Best of must be a positive odd number of games (1, 3, 5, …).')
  }
  return n
}

/**
 * The entry gate: results can be entered for a tie only once BOTH of its sides
 * have a submitted lineup (a TBD side can never satisfy the gate). Pure.
 */
export function bothLineupsSubmitted(
  lineups: { teamId: string; status: LineupStatus }[],
  teamIds: [string | null, string | null]
): boolean {
  const [a, b] = teamIds
  if (a === null || b === null) return false
  const submitted = new Set(
    lineups.filter((l) => l.status === 'submitted').map((l) => l.teamId)
  )
  return submitted.has(a) && submitted.has(b)
}
