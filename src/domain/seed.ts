import type { Gender } from './types'
import { ParseError, array, object, string } from './parse-helpers'

// Back-compat alias: existing callers/tests import SeedParseError.
export { ParseError as SeedParseError } from './parse-helpers'

/** A Team category present in the seed (the Tie Format is authored later, Ticket 4). */
export interface SeedCategory {
  id: string
  name: string
  shortName: string
}

export interface SeedTeam {
  id: string
  name: string
  club?: string
}

export interface SeedPlayer {
  id: string
  teamId: string
  name: string
  gender: Gender
  dateOfBirth: string // yyyy-mm-dd
}

export interface SeedTie {
  id: string
  categoryId: string
  /** ISO date-time, tournament-local, of the scheduled start. */
  scheduledStart: string
  table?: string
  /** Exactly two team ids: [teamA, teamB]. */
  teamIds: [string, string]
}

/**
 * The seed-file contract: a one-time export from tournament-manager that
 * initialises the lineup system's structure. Carries categories, teams,
 * rosters, and scheduled ties — NOT rubbers/constraints/lead-time (those are
 * authored in-product) and NOT managers (provisioned in a later slice).
 */
export interface SeedFile {
  tournamentName: string
  categories: SeedCategory[]
  teams: SeedTeam[]
  players: SeedPlayer[]
  ties: SeedTie[]
}

/**
 * Parse and validate an untrusted seed document into a {@link SeedFile}.
 * Throws {@link ParseError} on any structural or referential violation.
 * Pure: no UI, no network.
 */
export function parseSeed(input: unknown): SeedFile {
  const root = object(input, 'seed')
  const categories = array(root.categories, 'categories').map((c, i) => parseCategory(c, i))
  const teams = array(root.teams, 'teams').map((t, i) => parseTeam(t, i))
  const players = array(root.players, 'players').map((p, i) => parsePlayer(p, i))
  const ties = array(root.ties, 'ties').map((t, i) => parseTie(t, i))

  // Referential integrity + id uniqueness.
  const categoryIds = assertUnique(categories.map((c) => c.id), 'category')
  const teamIds = assertUnique(teams.map((t) => t.id), 'team')
  for (const p of players) {
    if (!teamIds.has(p.teamId)) {
      throw new ParseError(`players: teamId "${p.teamId}" does not match any team.`)
    }
  }
  assertUnique(players.map((p) => p.id), 'player')
  const tieIds = new Set<string>()
  for (const t of ties) {
    if (tieIds.has(t.id)) throw new ParseError(`Duplicate tie id "${t.id}".`)
    tieIds.add(t.id)
    if (!categoryIds.has(t.categoryId)) {
      throw new ParseError(`ties: categoryId "${t.categoryId}" does not match any category.`)
    }
    for (const tid of t.teamIds) {
      if (!teamIds.has(tid)) {
        throw new ParseError(`ties: teamId "${tid}" does not match any team.`)
      }
    }
  }

  return {
    tournamentName: string(root.tournamentName, 'tournamentName'),
    categories,
    teams,
    players,
    ties
  }
}

function assertUnique(ids: string[], what: string): Set<string> {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) throw new ParseError(`Duplicate ${what} id "${id}".`)
    seen.add(id)
  }
  return seen
}

function parseCategory(input: unknown, index: number): SeedCategory {
  const o = object(input, `categories[${index}]`)
  return {
    id: string(o.id, `categories[${index}].id`),
    name: string(o.name, `categories[${index}].name`),
    shortName: string(o.shortName, `categories[${index}].shortName`)
  }
}

function parseTeam(input: unknown, index: number): SeedTeam {
  const o = object(input, `teams[${index}]`)
  const team: SeedTeam = {
    id: string(o.id, `teams[${index}].id`),
    name: string(o.name, `teams[${index}].name`)
  }
  if (o.club !== undefined) team.club = string(o.club, `teams[${index}].club`)
  return team
}

function parsePlayer(input: unknown, index: number): SeedPlayer {
  const o = object(input, `players[${index}]`)
  return {
    id: string(o.id, `players[${index}].id`),
    teamId: string(o.teamId, `players[${index}].teamId`),
    name: string(o.name, `players[${index}].name`),
    gender: string(o.gender, `players[${index}].gender`),
    dateOfBirth: string(o.dateOfBirth, `players[${index}].dateOfBirth`)
  }
}

function parseTie(input: unknown, index: number): SeedTie {
  const o = object(input, `ties[${index}]`)
  const teamIds = array(o.teamIds, `ties[${index}].teamIds`)
  if (teamIds.length !== 2) {
    throw new ParseError(`ties[${index}].teamIds must contain exactly 2 team ids (got ${teamIds.length}).`)
  }
  const tie: SeedTie = {
    id: string(o.id, `ties[${index}].id`),
    categoryId: string(o.categoryId, `ties[${index}].categoryId`),
    scheduledStart: string(o.scheduledStart, `ties[${index}].scheduledStart`),
    teamIds: [
      string(teamIds[0], `ties[${index}].teamIds[0]`),
      string(teamIds[1], `ties[${index}].teamIds[1]`)
    ]
  }
  if (o.table !== undefined) tie.table = string(o.table, `ties[${index}].table`)
  return tie
}
