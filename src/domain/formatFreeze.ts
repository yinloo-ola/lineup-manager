// The two Team Match Format rules of spec §6 (ticket #16), pure:
//
// - **Freeze** — formats cannot be amended once the tournament has started,
//   anchored on `tournaments.start_date` (null start date = not started, so a
//   pre-v1 tournament without one stays editable).
// - **Guarded pre-start edit** — a proposed format that would break submitted
//   lineups must first clear an impact preview; this module detects the
//   breakage by re-validating every submitted lineup with the proposed format
//   in place of the stored one. Confirmed breaks surface downstream as
//   Needs attention (the Matches dashboard's invalidated marker).
//
// Pure: no UI, no network.

import { buildAdminLineupRows, type BuildAdminLineupRowsArgs } from './adminView'
import type { TieFormat } from './types'

/** True once the tournament's start date is on or before `today` (yyyy-mm-dd).
 *  `today` defaults to the current calendar date.
 *  A null start date (or none at all) means not started. */
export function isFormatFrozen(
  startDate: string | null,
  today: string = new Date().toISOString().slice(0, 10)
): boolean {
  return startDate != null && startDate <= today
}

/**
 * The freeze's anchor rule: a STARTED tournament must stay started — clearing
 * the start date or moving it into the future would silently lift the freeze
 * its formats are frozen against. Returns the error message when the proposed
 * edit would do that, else null.
 */
export function startDateEditError(
  startDate: string | null,
  nextStartDate: string,
  today: string = new Date().toISOString().slice(0, 10)
): string | null {
  if (!isFormatFrozen(startDate, today)) return null
  if (isFormatFrozen(nextStartDate === '' ? null : nextStartDate, today)) return null
  return 'A started tournament must keep a start date in the past — its Team Match Formats are frozen against it'
}

/** One submitted lineup the proposed format would break, with its team match. */
export interface FormatBreak {
  teamName: string
  opponentName: string
  scheduledStart: string | null
}

/**
 * Every submitted lineup that becomes illegal under the format(s) in
 * `args.formatByCategory` — the caller substitutes the PROPOSED format for the
 * category being edited, keeping the stored formats for the rest. Drafts are
 * never breakage (drafting nuance is builder-internal); only submitted lineups
 * guard a format save.
 */
export function breakingLineups(args: BuildAdminLineupRowsArgs): FormatBreak[] {
  return buildAdminLineupRows(args)
    .filter((r) => r.status === 'submitted' && r.effectiveStatus === 'invalidated')
    .map((r) => ({
      teamName: r.teamName,
      opponentName: r.opponentName,
      scheduledStart: r.scheduledStart
    }))
}

/** Convenience for the common single-category case: one proposed format. */
export function withProposedFormat(
  args: BuildAdminLineupRowsArgs,
  categoryId: string,
  proposed: TieFormat
): BuildAdminLineupRowsArgs {
  return { ...args, formatByCategory: new Map(args.formatByCategory).set(categoryId, proposed) }
}
