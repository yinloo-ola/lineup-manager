// Shared domain types for lineup-manager — the canonical vocabulary for the
// team-lineup-submission product. See CONTEXT.md for the ubiquitous language.
//
// This module is the only place these domain types are defined; later tickets
// (validation engine, schema, UI) all build on these shapes.

/** A male/female marker. Kept as a plain string so roster values are honoured as-is. */
export type Gender = string

/** How two already-eligible players may combine in a doubles Rubber. */
export type PairRule = 'any' | 'same-gender' | 'mixed'

/** A Rubber's format. */
export type RubberFormat = 'singles' | 'doubles'

/**
 * Eligibility applied to each player in a Rubber.
 * - `allowedGenders`: permitted gender strings; omitted = any.
 * - `ageMin` / `ageMax`: inclusive years, evaluated as of `asOf`.
 * - `asOf`: reference date for age; defaults to the tournament start.
 */
export interface Constraint {
  allowedGenders?: Gender[]
  ageMin?: number
  ageMax?: number
  asOf?: string // ISO yyyy-mm-dd, or the literal 'tournament-start'
}

/** One game inside a Tie. */
export interface Rubber {
  format: RubberFormat
  constraint: Constraint
  /** Required for doubles; ignored for singles. */
  pairRule?: PairRule
}

/** Category-level template: every Tie in a Team category expands from this. */
export interface TieFormat {
  rubbers: Rubber[]
  /** Max rubbers a single player may play within one Tie. Default 1 (at-most-once). */
  maxRubbersPerPlayer?: number
}

/** A player on a team roster. */
export interface Player {
  id: string
  name: string
  gender: Gender
  dateOfBirth: string // yyyy-mm-dd
}

/** A team-vs-team fixture (corresponds to a scheduled team match). */
export interface Tie {
  id: string
  /** ISO date-time, tournament-local, of the scheduled start. */
  scheduledStart: string
  table?: string
  teamIds: [string, string]
}

export type LineupStatus = 'not-started' | 'draft' | 'submitted' | 'invalidated'

/** A team's assignment of roster players to each Rubber of a specific Tie. */
export interface Lineup {
  tieId: string
  teamId: string
  /** Player ids per Rubber, aligned to the Tie Format order. Singles: 1; doubles: 2. */
  playerIds: (string[] | null)[]
  status: LineupStatus
  submittedAt?: string
  updatedAt: string
}
