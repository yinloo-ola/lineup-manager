import type { Gender } from './types'
import { ParseError, array, nonNegInt, object, string } from './parse-helpers'

// Back-compat alias: existing callers/tests import SeedParseError.
export { ParseError as SeedParseError } from './parse-helpers'

/** The seed version this parser accepts (spec §8, seed contract v1). */
export const SUPPORTED_SEED_VERSION = 1

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
  /** The team's manager login email — one manager per team, unique across the seed. */
  managerEmail: string
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
  /** Human-label group/round ("A", "2") where the schedule has them; knockout ties have no group. */
  group?: string
  round?: string
  /** Exactly two team ids: [teamA, teamB]. */
  teamIds: [string, string]
}

/**
 * The seed-file contract: a one-time export from tournament-manager that
 * initialises the lineup system's structure. Carries categories, teams (with
 * their manager emails), rosters, and scheduled ties — NOT rubbers/constraints/
 * lead-time (those are authored in-product). See docs/seed-contract.md.
 */
export interface SeedFile {
  seedVersion: number
  tournamentName: string
  /** Optional yyyy-mm-dd; when absent the import derives it from the earliest tie. */
  startDate?: string
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
  if (root.seedVersion === undefined) {
    throw new ParseError(
      'seedVersion is missing — this looks like a pre-v1 seed. Re-export it from the organizer tool.'
    )
  }
  const seedVersion = nonNegInt(root.seedVersion, 'seedVersion')
  if (seedVersion !== SUPPORTED_SEED_VERSION) {
    throw new ParseError(
      `Unsupported seed version ${seedVersion} — this app supports version ${SUPPORTED_SEED_VERSION}. Re-export the seed from the organizer tool.`
    )
  }
  const categories = array(root.categories, 'categories').map((c, i) => parseCategory(c, i))
  const teams = array(root.teams, 'teams').map((t, i) => parseTeam(t, i))
  const players = array(root.players, 'players').map((p, i) => parsePlayer(p, i))
  const ties = array(root.ties, 'ties').map((t, i) => parseTie(t, i))

  // Referential integrity + id uniqueness.
  const categoryIds = assertUnique(categories.map((c) => c.id), 'category')
  const teamIds = assertUnique(teams.map((t) => t.id), 'team')
  assertUniqueManagerEmails(teams)
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

  const seed: SeedFile = {
    seedVersion,
    tournamentName: string(root.tournamentName, 'tournamentName'),
    categories,
    teams,
    players,
    ties
  }
  if (root.startDate !== undefined) {
    seed.startDate = isoDate(string(root.startDate, 'startDate'), 'startDate')
  }
  return seed
}

/** A team's manager email must look like one and belong to exactly one team. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertUniqueManagerEmails(teams: SeedTeam[]): void {
  const byEmail = new Map<string, SeedTeam>()
  for (const t of teams) {
    const key = t.managerEmail.toLowerCase()
    const other = byEmail.get(key)
    if (other) {
      throw new ParseError(
        `teams: managerEmail "${t.managerEmail}" is shared by "${other.name}" and "${t.name}" — each team needs its own manager.`
      )
    }
    byEmail.set(key, t)
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
  const name = string(o.name, `teams[${index}].name`)
  if (o.managerEmail === undefined) {
    throw new ParseError(
      `teams[${index}] ("${name}"): managerEmail is missing — every team must carry its manager's email.`
    )
  }
  const managerEmail = string(o.managerEmail, `teams[${index}].managerEmail`)
  if (!EMAIL_SHAPE.test(managerEmail)) {
    throw new ParseError(
      `teams[${index}] ("${name}"): managerEmail "${managerEmail}" is not a valid email.`
    )
  }
  const team: SeedTeam = {
    id: string(o.id, `teams[${index}].id`),
    name,
    managerEmail
  }
  if (o.club !== undefined) team.club = string(o.club, `teams[${index}].club`)
  return team
}

/** Milliseconds per day (UTC). */
const MS_PER_DAY = 86_400_000
/**
 * Excel's serial-day epoch, anchored at 1899-12-30. That anchor absorbs Excel's
 * famous phantom 1900-02-29, so for serial >= 60 (1900-03-01 onward — i.e. every
 * realistic birth date) `epoch + serial days` is the exact calendar date.
 */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)

/**
 * Validate an already-ISO `yyyy-mm-dd` date — a real calendar date, not just
 * the right shape. Shared by `startDate` and player `dateOfBirth`.
 */
function isoDate(raw: string, path: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ParseError(`${path} must be a yyyy-mm-dd date (got "${raw}").`)
  }
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new ParseError(`${path} is not a valid calendar date ("${raw}").`)
  }
  return raw
}

/**
 * Normalize a seed dateOfBirth to ISO `yyyy-mm-dd`.
 *
 * Accepts either an already-ISO date (kept as-is) or an Excel serial-day number
 * (the format tournament-manager exports — e.g. 36893 -> 2001-01-02). Throws
 * ParseError on anything else, so a bad date fails at parse time with a clear
 * message instead of reaching Postgres as `invalid input syntax for type date`.
 */
function normalizeDateOfBirth(raw: string, path: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return isoDate(raw, path)
  }
  if (/^\d+$/.test(raw)) {
    const serial = Number(raw)
    if (serial >= 60) {
      return new Date(EXCEL_EPOCH_UTC + serial * MS_PER_DAY).toISOString().slice(0, 10)
    }
  }
  throw new ParseError(
    `${path} must be a yyyy-mm-dd date or an Excel serial number (got "${raw}").`
  )
}

function parsePlayer(input: unknown, index: number): SeedPlayer {
  const o = object(input, `players[${index}]`)
  return {
    id: string(o.id, `players[${index}].id`),
    teamId: string(o.teamId, `players[${index}].teamId`),
    name: string(o.name, `players[${index}].name`),
    gender: string(o.gender, `players[${index}].gender`),
    dateOfBirth: normalizeDateOfBirth(
      string(o.dateOfBirth, `players[${index}].dateOfBirth`),
      `players[${index}].dateOfBirth`
    )
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
  if (o.group !== undefined) tie.group = string(o.group, `ties[${index}].group`)
  if (o.round !== undefined) tie.round = string(o.round, `ties[${index}].round`)
  return tie
}

/**
 * The tournament's start date: the seed's own `startDate` when it carries one,
 * otherwise the calendar day of the earliest scheduled team match (spec §8 —
 * the tournament starts when its first team match does). Null only for a seed
 * with no team matches and no start date (nothing to derive from).
 */
export function resolveStartDate(seed: SeedFile): string | null {
  if (seed.startDate !== undefined) return seed.startDate
  return seed.ties.length === 0
    ? null
    : [...seed.ties]
        .map((t) => t.scheduledStart.slice(0, 10))
        .sort()[0]
}
