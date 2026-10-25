// Pure results domain for team matches — derivation and validation over stored
// rubber results. Nothing here touches Supabase; services map rows in/out.

import { ParseError } from './parse-helpers'
import type { LineupStatus, Violation } from './types'

/** One played game: points for side A and side B. */
export interface GameScore {
  a: number
  b: number
}

export type Side = 'a' | 'b'

/** The best-of every tie imports with; the admin may override per tie. */
export const DEFAULT_BEST_OF = 5

/** Majority of a best-of-N: the first side to reach it wins. */
export function bestOfMajority(bestOf: number): number {
  return Math.ceil(bestOf / 2)
}

/**
 * The winner of one rubber: the first side to the best-of majority of games.
 * A walkover is decided immediately — but only when its side is recorded: a
 * side-less walkover is UNDECIDED, never a silent default win. Pure.
 */
export function rubberWinner(
  games: GameScore[],
  bestOf: number,
  walkover = false,
  walkoverSide?: Side | null
): Side | null {
  if (walkover) return walkoverSide ?? null
  let a = 0
  let b = 0
  const majority = bestOfMajority(bestOf)
  for (const g of games) {
    if (g.a > g.b) a += 1
    else if (g.b > g.a) b += 1
    if (a >= majority) return 'a'
    if (b >= majority) return 'b'
  }
  return null
}

/** The derived state of one tie's results — never stored, computed per read. */
export interface TieResultState {
  state: 'partial' | 'decided'
  winnerSide?: Side
}

/**
 * The single derivation of a tie's result from its stored rubber results,
 * shared by the umpire console and the Matches dashboard so the winner
 * semantics can never drift between the two surfaces. `results` must carry the
 * tie's entered rubbers; unplayed rubbers count for neither side. Pure.
 */
export function deriveTieResult(
  results: { rubberIndex: number; games: GameScore[]; walkover: boolean; walkoverSide?: Side | null }[],
  bestOf: number,
  rubberCount: number
): TieResultState {
  if (rubberCount <= 0 || results.length === 0) return { state: 'partial' }
  const entered = [...results].sort((x, y) => x.rubberIndex - y.rubberIndex)
  const winners = entered.map((r) => rubberWinner(r.games, bestOf, r.walkover, r.walkoverSide))
  const winner = tieWinner(winners, rubberCount)
  return winner === null ? { state: 'partial' } : { state: 'decided', winnerSide: winner }
}

/**
 * Entry-time validation of one rubber's games against the tie's best-of:
 * non-negative integer scores; a walkover carries no games and needs a side;
 * games entered after the majority is reached are an entry error. Pure.
 */
export function validateGames(
  games: GameScore[],
  bestOf: number,
  walkover = false,
  walkoverSide?: Side
): Violation[] {
  const violations: Violation[] = []
  if (walkover) {
    if (games.length > 0) {
      violations.push({
        kind: 'walkover-with-games',
        message: 'A walkover cannot carry game scores.'
      })
    }
    if (walkoverSide === undefined) {
      violations.push({ kind: 'walkover-no-side', message: 'Choose which side won the walkover.' })
    }
    return violations
  }
  const majority = bestOfMajority(bestOf)
  let a = 0
  let b = 0
  for (const [i, g] of games.entries()) {
    if (!Number.isInteger(g.a) || !Number.isInteger(g.b) || g.a < 0 || g.b < 0) {
      violations.push({
        kind: 'bad-score',
        message: `Game ${i + 1}: scores must be whole non-negative numbers.`,
        rubberIndex: i
      })
      continue
    }
    if (a >= majority || b >= majority) {
      violations.push({
        kind: 'best-of-overflow',
        message: `The rubber was decided at game ${i} — best of ${bestOf} ends at ${majority} game wins.`,
        rubberIndex: i
      })
      continue
    }
    if (g.a > g.b) a += 1
    else if (g.b > g.a) b += 1
  }
  return violations
}

/**
 * The winner of the tie: the first side to the majority of RUBBERS won.
 * Unplayed rubbers count for neither side; walkovers count as their side's
 * win (each entry of `walkoverSides` marks a rubber won by walkover).
 * Undecided → null. Pure.
 */
export function tieWinner(
  rubberWinners: (Side | null)[],
  rubberCount: number,
  walkoverSides: (Side | null)[] = []
): Side | null {
  const majority = Math.ceil(rubberCount / 2)
  let a = 0
  let b = 0
  for (const [i, w] of rubberWinners.entries()) {
    const winner = w ?? walkoverSides[i] ?? null
    if (winner === 'a') a += 1
    else if (winner === 'b') b += 1
    if (a >= majority) return 'a'
    if (b >= majority) return 'b'
  }
  return null
}

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
