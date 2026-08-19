import type { Gender } from './types'
import { ParseError, array, nonNegInt, object, string } from './parse-helpers'

// Back-compat alias: existing callers/tests import SeedParseError.
export { ParseError as SeedParseError } from './parse-helpers'

/** The seed version this parser accepts (ko-import spec §3; v2 only — v1 is
 *  rejected with a re-export hint; the organizer tool always can). */
export const SUPPORTED_SEED_VERSION = 2

/** The fixed knockout round-label set, keyed off slot size by the producer. */
const KO_ROUND_LABELS = new Set(['R256', 'R128', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'])

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

/** Group-stage tie: both teams known at export; group + round labels required. */
export interface GroupSeedTie {
  id: string
  categoryId: string
  /** ISO date-time, tournament-local, of the scheduled start. */
  scheduledStart: string
  table?: string
  group: string
  round: string
  teamIds: [string, string]
}

/** Knockout entry-round tie — an unplaced pool match (table + time, no
 *  position, no teams): the admin decides placement in the bracket view. */
export interface KnockoutPoolTie {
  id: string
  categoryId: string
  scheduledStart: string
  table: string
  round: string
}

/** Knockout later-round tie — positional, both sides fed. */
export interface KnockoutFedTie {
  id: string
  categoryId: string
  scheduledStart: string
  table: string
  round: string
  /** The feeder slot ids for side 1 and side 2. */
  fedBy: [string, string]
}

export type SeedTie = GroupSeedTie | KnockoutPoolTie | KnockoutFedTie

/** One knockout category's bracket structure: every round's slot count plus,
 *  from the second round on, which earlier slots feed each side. */
export interface SeedBracketRound {
  label: string
  slots: number
  fedBy?: [string, string][]
}

export interface SeedBracket {
  categoryId: string
  rounds: SeedBracketRound[]
}

/**
 * The seed-file contract: a one-time export from tournament-manager that
 * initialises the lineup system's structure. Carries categories, teams (with
 * their manager emails), rosters, group-stage ties, and the knockout stage as
 * structure (brackets[]) + scheduled matches (entry-round pool + fed later
 * rounds) — NOT rubbers/constraints/lead-time (those are authored in-product).
 * See docs/seed-contract.md.
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
  /** Knockout bracket structure per category — omitted when no category has a
   *  knockout stage. */
  brackets?: SeedBracket[]
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
    if ('teamIds' in t) {
      for (const tid of t.teamIds) {
        if (!teamIds.has(tid)) {
          throw new ParseError(`ties: teamId "${tid}" does not match any team.`)
        }
      }
    }
  }

  const shortNameByCategoryId = new Map(categories.map((c) => [c.id, c.shortName] as const))
  const brackets =
    root.brackets !== undefined
      ? array(root.brackets, 'brackets').map((b, i) => parseBracket(b, i))
      : undefined

  const seed: SeedFile = {
    seedVersion,
    tournamentName: string(root.tournamentName, 'tournamentName'),
    categories,
    teams,
    players,
    ties
  }
  if (brackets !== undefined) {
    validateBrackets(brackets, ties, categoryIds, shortNameByCategoryId)
    seed.brackets = brackets
  } else {
    // No structure declared: knockout ties (pool or fed) cannot exist.
    const koTie = ties.find((t) => !('teamIds' in t))
    if (koTie) {
      throw new ParseError(
        `ties: knockout tie "${koTie.id}" has no bracket structure — brackets[] is required when any knockout ties exist.`
      )
    }
  }
  if (root.startDate !== undefined) {
    seed.startDate = isoDate(string(root.startDate, 'startDate'), 'startDate')
  }
  return seed
}

/** A team's manager email must look like one and belong to exactly one team. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Shared email-shape check (the seed parser and the provisioning page agree). */
export function isEmailShape(email: string): boolean {
  return EMAIL_SHAPE.test(email)
}

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
 * Validate an already-ISO `yyyy-mm-dd` date — a real calendar date, not just the
 * right shape. Shared by `startDate` and player `dateOfBirth`.
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
  const id = string(o.id, `ties[${index}].id`)
  const categoryId = string(o.categoryId, `ties[${index}].categoryId`)
  const scheduledStart = string(o.scheduledStart, `ties[${index}].scheduledStart`)

  if (o.teamIds !== undefined) {
    if (o.fedBy !== undefined) {
      throw new ParseError(
        `ties[${index}] ("${id}"): a team tie cannot also carry fedBy — knockout ties never carry teamIds.`
      )
    }
    const teamIds = array(o.teamIds, `ties[${index}].teamIds`)
    if (teamIds.length !== 2) {
      throw new ParseError(`ties[${index}].teamIds must contain exactly 2 team ids (got ${teamIds.length}).`)
    }
    if (o.group === undefined) {
      throw new ParseError(`ties[${index}] ("${id}"): team ties require a group label.`)
    }
    if (o.round === undefined) {
      throw new ParseError(`ties[${index}] ("${id}"): team ties require a round label.`)
    }
    const tie: GroupSeedTie = {
      id,
      categoryId,
      scheduledStart,
      group: string(o.group, `ties[${index}].group`),
      round: string(o.round, `ties[${index}].round`),
      teamIds: [
        string(teamIds[0], `ties[${index}].teamIds[0]`),
        string(teamIds[1], `ties[${index}].teamIds[1]`)
      ]
    }
    if (o.table !== undefined) tie.table = string(o.table, `ties[${index}].table`)
    return tie
  }

  // Knockout tie — pool (no fedBy) or fed (fedBy). Never a group label.
  if (o.group !== undefined) {
    throw new ParseError(`ties[${index}] ("${id}"): knockout ties never carry a group.`)
  }
  const round = string(o.round, `ties[${index}].round`)
  if (!KO_ROUND_LABELS.has(round)) {
    throw new ParseError(
      `ties[${index}] ("${id}"): round "${round}" is not a knockout round label (expected one of R256, R128, R64, R32, R16, QF, SF, F).`
    )
  }
  if (o.table === undefined) {
    throw new ParseError(`ties[${index}] ("${id}"): knockout ties require a table.`)
  }
  const table = string(o.table, `ties[${index}].table`)
  if (o.fedBy === undefined) {
    const pool: KnockoutPoolTie = { id, categoryId, scheduledStart, table, round }
    return pool
  }
  const fedBy = array(o.fedBy, `ties[${index}].fedBy`)
  if (fedBy.length !== 2) {
    throw new ParseError(`ties[${index}] ("${id}").fedBy must name exactly 2 feeder slots.`)
  }
  const fed: KnockoutFedTie = {
    id,
    categoryId,
    scheduledStart,
    table,
    round,
    fedBy: [
      string(fedBy[0], `ties[${index}].fedBy[0]`),
      string(fedBy[1], `ties[${index}].fedBy[1]`)
    ]
  }
  return fed
}

function parseBracket(input: unknown, index: number): SeedBracket {
  const o = object(input, `brackets[${index}]`)
  const rounds = array(o.rounds, `brackets[${index}].rounds`).map((r, i) =>
    parseBracketRound(r, `brackets[${index}].rounds[${i}]`)
  )
  if (rounds.length === 0) {
    throw new ParseError(`brackets[${index}]: a bracket needs at least one round.`)
  }
  return {
    categoryId: string(o.categoryId, `brackets[${index}].categoryId`),
    rounds
  }
}

function parseBracketRound(input: unknown, path: string): SeedBracketRound {
  const o = object(input, path)
  const label = string(o.label, `${path}.label`)
  if (!KO_ROUND_LABELS.has(label)) {
    throw new ParseError(
      `${path}: label "${label}" is not a knockout round label (expected one of R256, R128, R64, R32, R16, QF, SF, F).`
    )
  }
  const slots = nonNegInt(o.slots, `${path}.slots`)
  if (slots < 1 || slots > 128 || (slots & (slots - 1)) !== 0) {
    throw new ParseError(`${path}: slots must be a power of two between 1 and 128 (got ${slots}).`)
  }
  const round: SeedBracketRound = { label, slots }
  if (o.fedBy !== undefined) {
    const fedBy = array(o.fedBy, `${path}.fedBy`)
    if (fedBy.length !== slots) {
      throw new ParseError(`${path}: fedBy must wire every slot (got ${fedBy.length} of ${slots}).`)
    }
    round.fedBy = fedBy.map((pair, i) => {
      const sides = array(pair, `${path}.fedBy[${i}]`)
      if (sides.length !== 2) {
        throw new ParseError(`${path}.fedBy[${i}] must name exactly 2 feeder slots.`)
      }
      return [
        string(sides[0], `${path}.fedBy[${i}][0]`),
        string(sides[1], `${path}.fedBy[${i}][1]`)
      ]
    })
  }
  return round
}

/**
 * Cross-check the declared structure against the knockout ties: every category
 * with knockout ties has a bracket; rounds halve; the entry round declares no
 * feeds; pool ties belong to the entry round; every fed tie sits at its
 * positional slot id and its wiring matches the bracket's.
 */
function validateBrackets(
  brackets: SeedBracket[],
  ties: SeedTie[],
  categoryIds: Set<string>,
  shortNameByCategoryId: Map<string, string>
): void {
  const bracketByCategory = new Map<string, SeedBracket>()
  for (const b of brackets) {
    if (!categoryIds.has(b.categoryId)) {
      throw new ParseError(`brackets: categoryId "${b.categoryId}" does not match any category.`)
    }
    if (bracketByCategory.has(b.categoryId)) {
      throw new ParseError(`brackets: duplicate bracket for category "${b.categoryId}".`)
    }
    bracketByCategory.set(b.categoryId, b)
  }

  for (const b of brackets) {
    const shortName = shortNameByCategoryId.get(b.categoryId)!
    const labels = new Set<string>()
    b.rounds.forEach((round, i) => {
      if (labels.has(round.label)) {
        throw new ParseError(`brackets (category ${shortName}): duplicate round label "${round.label}".`)
      }
      labels.add(round.label)
      if (i === 0) {
        if (round.fedBy !== undefined) {
          throw new ParseError(
            `brackets (category ${shortName}): the entry round ("${round.label}") declares no feeds — its slots are filled manually.`
          )
        }
      } else {
        const prev = b.rounds[i - 1]
        if (prev.slots !== round.slots * 2) {
          throw new ParseError(
            `brackets (category ${shortName}): rounds do not halve — "${round.label}" has ${round.slots} slots after ${prev.slots}.`
          )
        }
        // Every feed target must be a real slot of the previous round.
        const prevPrefix = `${shortName}|ko|${prev.label}|`
        for (const [slot, pair] of round.fedBy!.entries()) {
          for (const target of pair) {
            const n = target.startsWith(prevPrefix) ? Number(target.slice(prevPrefix.length)) : NaN
            if (!Number.isInteger(n) || n < 1 || n > prev.slots) {
              throw new ParseError(
                `brackets (category ${shortName}): "${round.label}" feed target "${target}" is not a slot of "${prev.label}" (${prevPrefix}1..${prev.slots}).`
              )
            }
          }
        }
      }
    })
  }

  for (const tie of ties) {
    if ('teamIds' in tie) continue
    const bracket = bracketByCategory.get(tie.categoryId)
    if (bracket === undefined) {
      throw new ParseError(
        `ties: knockout tie "${tie.id}" belongs to a category with no bracket structure.`
      )
    }
    const shortName = shortNameByCategoryId.get(tie.categoryId)!
    if (!('fedBy' in tie)) {
      if (tie.round !== bracket.rounds[0].label) {
        throw new ParseError(
          `ties: pool tie "${tie.id}" carries round "${tie.round}" — pool ties belong to the entry round "${bracket.rounds[0].label}".`
        )
      }
      continue
    }
    // Fed tie: must sit at its positional slot id and match the declared wiring.
    const expectedPrefix = `${shortName}|ko|${tie.round}|`
    const slotNumber = tie.id.startsWith(expectedPrefix)
      ? Number(tie.id.slice(expectedPrefix.length))
      : NaN
    const roundIndex = bracket.rounds.findIndex((r) => r.label === tie.round)
    const round = roundIndex >= 0 ? bracket.rounds[roundIndex] : undefined
    if (
      roundIndex < 1 ||
      round === undefined ||
      !Number.isInteger(slotNumber) ||
      slotNumber < 1 ||
      slotNumber > round.slots
    ) {
      throw new ParseError(
        `ties: fed tie "${tie.id}" is not a positional slot id of round ${expectedPrefix}1..${round?.slots ?? '?'}.`
      )
    }
    const declared = round.fedBy?.[slotNumber - 1]
    if (declared === undefined || declared[0] !== tie.fedBy[0] || declared[1] !== tie.fedBy[1]) {
      throw new ParseError(
        `ties: fed tie "${tie.id}" wiring [${tie.fedBy.join(', ')}] disagrees with the bracket structure.`
      )
    }
  }
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
