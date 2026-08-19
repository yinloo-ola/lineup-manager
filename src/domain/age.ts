/**
 * The "as of" date for evaluating a rubber's age constraint in a team match.
 *
 * Prefers the tournament's start date — the real anchor for a constraint whose
 * `asOf` is `'tournament-start'`. Falls back to the team match's own start date
 * when the tournament has no `start_date`, preserving the pre-tournament-dimension
 * behaviour. Both inputs are ISO date-times; returns a `yyyy-mm-dd` date.
 */
export function resolveAsOf(tournamentStart: string | null, tieStart?: string | null): string {
  // An empty anchor only arises with no tournament start AND an unscheduled
  // knockout slot — running tournaments always carry a start date, so this
  // never feeds a real age check in practice.
  return (tournamentStart ?? tieStart ?? '').slice(0, 10)
}

/**
 * Whole-year age of someone born on `dateOfBirth`, evaluated at `asOf`.
 * Both inputs are yyyy-mm-dd. Pure; a building block for the Ticket 2 validation engine.
 */
export function ageOn(dateOfBirth: string, asOf: string): number {
  const dob = new Date(dateOfBirth + 'T00:00:00Z')
  const ref = new Date(asOf + 'T00:00:00Z')
  if (Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime())) {
    throw new Error(`Invalid date(s): dateOfBirth="${dateOfBirth}", asOf="${asOf}"`)
  }
  let age = ref.getUTCFullYear() - dob.getUTCFullYear()
  const monthDiff = ref.getUTCMonth() - dob.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < dob.getUTCDate())) {
    age--
  }
  return age
}
