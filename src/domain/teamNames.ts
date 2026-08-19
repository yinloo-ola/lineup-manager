// The single source of the TBD-side display rule (ko-import spec §6/§7): a
// null side reads "TBD" everywhere — dashboard side columns, "vs …" strings in
// the builder and manager home. Pure.

/** A side's display name: "TBD" when the side is unfilled, else the team's
 *  name (falling back to its id when the name map lacks it). */
export function sideDisplayName(
  teamId: string | null,
  teamNameById: Map<string, string>
): string {
  return teamId === null ? 'TBD' : teamNameById.get(teamId) ?? teamId
}
