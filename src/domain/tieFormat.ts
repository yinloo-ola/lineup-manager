import type { Constraint, PairRule, Rubber, RubberFormat, TieFormat, UsagePolicy } from './types'
import { ParseError, array, nonNegInt, object, string } from './parse-helpers'

export { ParseError as TieFormatParseError } from './parse-helpers'

const FORMATS: RubberFormat[] = ['singles', 'doubles']
const PAIR_RULES: PairRule[] = ['any', 'same-gender', 'mixed']

/**
 * Parse/validate an authored (or jsonb-stored) Tie Format into a typed
 * {@link TieFormat}. Throws {@link ParseError} on any violation.
 * `leadTimeMinutes` defaults to 30 when absent. Pure.
 */
export function parseTieFormat(input: unknown): TieFormat {
  const o = object(input, 'tieFormat')
  const fmt: TieFormat = {
    rubbers: array(o.rubbers, 'rubbers').map((r, i) => parseRubber(r, i)),
    leadTimeMinutes:
      o.leadTimeMinutes === undefined ? 30 : nonNegInt(o.leadTimeMinutes, 'leadTimeMinutes')
  }
  if (o.usagePolicy !== undefined) fmt.usagePolicy = parseUsagePolicy(o.usagePolicy)
  return fmt
}

function parseRubber(input: unknown, index: number): Rubber {
  const o = object(input, `rubbers[${index}]`)
  const format = string(o.format, `rubbers[${index}].format`)
  if (!FORMATS.includes(format as RubberFormat)) {
    throw new ParseError(`rubbers[${index}].format must be 'singles' or 'doubles'.`)
  }
  const rubber: Rubber = {
    format: format as RubberFormat,
    constraint: parseConstraint(o.constraint, index)
  }
  if (o.pairRule !== undefined) {
    const pr = string(o.pairRule, `rubbers[${index}].pairRule`)
    if (!PAIR_RULES.includes(pr as PairRule)) {
      throw new ParseError(`rubbers[${index}].pairRule must be one of: any|same-gender|mixed.`)
    }
    rubber.pairRule = pr as PairRule
  }
  return rubber
}

function parseConstraint(input: unknown, index: number): Constraint {
  const o = object(input, `rubbers[${index}].constraint`)
  const c: Constraint = {}
  if (o.allowedGenders !== undefined) {
    c.allowedGenders = array(o.allowedGenders, `rubbers[${index}].constraint.allowedGenders`).map(
      (g, j) => string(g, `rubbers[${index}].constraint.allowedGenders[${j}]`)
    )
  }
  if (o.ageMin !== undefined) c.ageMin = nonNegInt(o.ageMin, `rubbers[${index}].constraint.ageMin`)
  if (o.ageMax !== undefined) c.ageMax = nonNegInt(o.ageMax, `rubbers[${index}].constraint.ageMax`)
  if (o.asOf !== undefined) c.asOf = string(o.asOf, `rubbers[${index}].constraint.asOf`)
  return c
}

function parseUsagePolicy(input: unknown): UsagePolicy {
  const o = object(input, 'usagePolicy')
  const kind = string(o.kind, 'usagePolicy.kind')
  switch (kind) {
    case 'at-most-once':
      return { kind }
    case 'max-rubbers':
      return { kind, max: nonNegInt(o.max, 'usagePolicy.max') }
    case 'singles-plus-doubles':
      return {
        kind,
        maxSingles: nonNegInt(o.maxSingles, 'usagePolicy.maxSingles'),
        maxDoubles: nonNegInt(o.maxDoubles, 'usagePolicy.maxDoubles')
      }
    default:
      throw new ParseError(
        'usagePolicy.kind must be one of: at-most-once|max-rubbers|singles-plus-doubles.'
      )
  }
}
