// Ticket #15: pure helpers for the Tournament settings surface (rename / start
// date / delete of the SELECTED tournament). The non-trivial rule is rename
// validation; the edit-save and delete dialog gates live here too so their
// state transitions are unit-tested.

/**
 * Case-folded tournament-name clash check. The DB enforces a case-sensitive
 * UNIQUE on `tournaments.name`; this is the stricter UX guard (shared with the
 * import path) so two names that differ only by case aren't allowed to seed
 * confusion. Pure.
 */
export function nameClashes(desiredName: string, existingNames: string[]): boolean {
  const want = desiredName.trim().toLowerCase()
  if (want === '') return false
  return existingNames.some((n) => n.trim().toLowerCase() === want)
}

/**
 * Validate a tournament's proposed new name. Returns an error message when the
 * name is empty/whitespace or case-insensitively clashes with another
 * tournament, otherwise `null`.
 *
 * `otherNames` are the names of every OTHER tournament — the caller excludes the
 * one being renamed, so keeping its current name is always allowed.
 */
export function renameError(desiredName: string, otherNames: string[]): string | null {
  const name = desiredName.trim()
  if (name === '') return 'Name is required'
  if (nameClashes(name, otherNames)) {
    return 'A tournament with that name already exists'
  }
  return null
}

/** A tournament as the settings page sees it: '' in `next.startDate` means "no start date". */
export interface TournamentEdit {
  name: string
  startDate: string
}

/**
 * True when a proposed edit changes nothing (name compared trimmed, empty date
 * meaning "no start date"). The Save action stays disabled while true.
 */
export function editUnchanged(
  current: { name: string; startDate: string | null },
  next: TournamentEdit
): boolean {
  return next.name.trim() === current.name && next.startDate === (current.startDate ?? '')
}

/**
 * The delete double-confirm gate: the acknowledgement checkbox is ticked AND
 * the typed confirmation is a literal (case-sensitive) match of the
 * tournament's name. Pure.
 */
export function deleteReady(typedName: string, acknowledged: boolean, tournamentName: string): boolean {
  return acknowledged && typedName === tournamentName
}
