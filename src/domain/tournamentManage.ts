// Ticket #15: pure helpers for the Manage-tournaments surface (rename / start
// date / delete). The one non-trivial rule is rename validation — the delete
// double-confirm is a literal name match and the start date is a plain string
// bind, both handled inline in the view.

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
