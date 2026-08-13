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
