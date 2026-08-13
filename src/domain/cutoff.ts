/**
 * Cutoff = scheduled start minus a lead time, returned as a UTC ISO instant.
 * `tieStartInstant` must be an absolute instant (ISO 8601 with offset/`Z`);
 * the caller is responsible for resolving "tournament-local" to an instant.
 * Pure.
 */
export function computeCutoff(tieStartInstant: string, leadTimeMinutes: number): string {
  const start = new Date(tieStartInstant)
  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid tie-start instant: ${tieStartInstant}`)
  }
  if (!Number.isFinite(leadTimeMinutes) || leadTimeMinutes < 0) {
    throw new Error(`Invalid lead time (minutes): ${leadTimeMinutes}`)
  }
  return new Date(start.getTime() - leadTimeMinutes * 60_000).toISOString()
}

/** True when `nowInstant` is at or after `cutoffInstant`. Both are UTC ISO instants. Pure. */
export function isLocked(cutoffInstant: string, nowInstant: string): boolean {
  return new Date(nowInstant).getTime() >= new Date(cutoffInstant).getTime()
}
