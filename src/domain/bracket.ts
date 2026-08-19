// Pure knockout-bracket logic (ko-import spec §6) — the bracket module's
// brain. Operates on tie rows of one category: entry-round slots (teams
// entered by the admin, schedule bound by placement), the imported pool
// (scheduled, unplaced), and later-round slots (scheduled, fed). Later-round
// sides are DERIVED, never stored: a fed side shows its feeder's winner team,
// so every bracket action is a single-row update and the bracket can never
// drift out of sync with itself. Pure: no UI, no network.

/** One tie row, snake_case-free, as loaded for a category. */
export interface BracketTieRow {
  id: string
  categoryId: string
  scheduledStart: string | null
  tableLabel: string | null
  roundLabel: string | null
  groupLabel: string | null
  teamA: string | null
  teamB: string | null
  fedByA: string | null
  fedByB: string | null
  winnerSide: 'a' | 'b' | null
  placedMatchId: string | null
  isKnockout: boolean
}

/** A lineup reference for guard/cascade decisions (status kept for context). */
export interface BracketLineupRow {
  tieId: string
  teamId: string
  status: string
}

export interface BracketSlotView {
  id: string
  roundLabel: string | null
  /** Entry-round slots are filled manually; later rounds are fed. */
  isEntryRound: boolean
  /** Stored on entry slots; derived from feeder winners on later rounds. */
  teams: [string | null, string | null]
  /** The winner team (winner_side resolved through the derived sides). */
  winnerTeam: string | null
  /** Own schedule (later rounds, pool) or the placed pool match's (entry). */
  schedule: { start: string; table: string } | null
  fedBy: [string | null, string | null]
  placedMatchId: string | null
  /** An entry slot holding exactly one team (its advance is a bye). */
  bye: boolean
}

export interface BracketPoolMatchView {
  id: string
  start: string
  table: string
  placedOnSlotId: string | null
}

export interface BracketSnapshot {
  /** Knockout slots in bracket order (largest round first). */
  slots: BracketSlotView[]
  pool: BracketPoolMatchView[]
  /** Teams of this category, derived from its group ties. */
  teamIdsInCategory: Set<string>
  lineupsByTie: Map<string, BracketLineupRow[]>
  rowsById: Map<string, BracketTieRow>
}

/** Round-label rank for bracket order (R256 first … F last). */
const ROUND_RANK: Record<string, number> = {
  R256: 0, R128: 1, R64: 2, R32: 3, R16: 4, QF: 5, SF: 6, F: 7
}

function isLaterRound(row: BracketTieRow): boolean {
  return row.fedByA !== null || row.fedByB !== null
}

/** Build the derived read-model of one category's bracket. Pure. */
export function buildBracketSnapshot(
  rows: BracketTieRow[],
  lineups: BracketLineupRow[]
): BracketSnapshot {
  const rowsById = new Map(rows.map((r) => [r.id, r]))

  // Derivation, memoized per tie: an entry side is its stored team; a fed
  // side is its feeder's winner team (null while the feeder is undecided).
  const teamsMemo = new Map<string, [string | null, string | null]>()
  const resolveTeams = (row: BracketTieRow): [string | null, string | null] => {
    const memoed = teamsMemo.get(row.id)
    if (memoed) return memoed
    const pair: [string | null, string | null] = [null, null]
    // Seed the memo BEFORE recursing so feeds (which strictly narrow) can't loop.
    teamsMemo.set(row.id, pair)
    pair[0] = sideTeam(row, 0, resolveTeams)
    pair[1] = sideTeam(row, 1, resolveTeams)
    return pair
  }
  const sideTeam = (
    row: BracketTieRow,
    side: 0 | 1,
    resolve: (r: BracketTieRow) => [string | null, string | null]
  ): string | null => {
    const fed = side === 0 ? row.fedByA : row.fedByB
    if (fed === null) return side === 0 ? row.teamA : row.teamB
    const feeder = rowsById.get(fed)
    if (feeder === undefined || feeder.winnerSide === null) return null
    return resolve(feeder)[feeder.winnerSide === 'a' ? 0 : 1]
  }

  const koRows = rows.filter((r) => r.isKnockout)
  const indexed = koRows.map((r, i) => ({ r, i }))
  // KO rows split: slots (unscheduled entry rows + scheduled fed rows) vs the
  // imported pool (scheduled, unfed, entry-round).
  const slotEntries = indexed.filter(({ r }) => r.scheduledStart === null || isLaterRound(r))
  const poolEntries = indexed.filter(({ r }) => r.scheduledStart !== null && !isLaterRound(r))

  const poolById = new Map(
    poolEntries.map(({ r }) => [r.id, r] as const)
  )
  const placedByPool = new Map<string, string>()
  for (const { r } of slotEntries) {
    if (r.placedMatchId !== null) placedByPool.set(r.placedMatchId, r.id)
  }

  const slotViews: BracketSlotView[] = slotEntries
    .sort((a, b) => {
      const ra = a.r.roundLabel ? ROUND_RANK[a.r.roundLabel] ?? 99 : 99
      const rb = b.r.roundLabel ? ROUND_RANK[b.r.roundLabel] ?? 99 : 99
      return ra !== rb ? ra - rb : a.i - b.i
    })
    .map(({ r }) => {
      const teams = resolveTeams(r)
      const placedPool = r.placedMatchId !== null ? poolById.get(r.placedMatchId) : undefined
      const fedBy: [string | null, string | null] = [r.fedByA, r.fedByB]
      const isEntry = !isLaterRound(r)
      return {
        id: r.id,
        roundLabel: r.roundLabel,
        isEntryRound: isEntry,
        teams,
        winnerTeam: r.winnerSide === null ? null : teams[r.winnerSide === 'a' ? 0 : 1],
        schedule:
          placedPool !== undefined
            ? { start: placedPool.scheduledStart ?? '', table: placedPool.tableLabel ?? '' }
            : r.scheduledStart !== null
              ? { start: r.scheduledStart, table: r.tableLabel ?? '' }
              : null,
        fedBy,
        placedMatchId: r.placedMatchId,
        bye: isEntry && (r.teamA !== null) !== (r.teamB !== null)
      }
    })

  const lineupsByTie = new Map<string, BracketLineupRow[]>()
  for (const l of lineups) {
    const arr = lineupsByTie.get(l.tieId) ?? []
    arr.push(l)
    lineupsByTie.set(l.tieId, arr)
  }

  const teamIdsInCategory = new Set<string>()
  for (const r of rows) {
    if (!r.isKnockout) {
      if (r.teamA !== null) teamIdsInCategory.add(r.teamA)
      if (r.teamB !== null) teamIdsInCategory.add(r.teamB)
    }
  }

  return {
    slots: slotViews,
    pool: poolEntries.map(({ r }) => ({
      id: r.id,
      start: r.scheduledStart ?? '',
      table: r.tableLabel ?? '',
      placedOnSlotId: placedByPool.get(r.id) ?? null
    })),
    teamIdsInCategory,
    lineupsByTie,
    rowsById
  }
}

// ---------------------------------------------------------------------------
// Guards — every action funnels through one; reasons are stable strings the
// UI (ticket 14) can phrase.
// ---------------------------------------------------------------------------

export type Guard = { ok: true } | { ok: false; reason: string }

export type WinnerToggleGuard =
  | { ok: true; action: 'pick' | 'un-pick' }
  | { ok: false; reason: string }
  | { ok: false; reason: 'needs-cascade'; cascade: CascadePlan }

function entryRow(snap: BracketSnapshot, slotId: string): BracketTieRow | { error: Guard } {
  const row = snap.rowsById.get(slotId)
  // Entry slots are unscheduled by construction (their schedule arrives with
  // placement) — scheduled unfed KO rows are the imported POOL, which never
  // takes teams or a position.
  if (
    row === undefined ||
    !row.isKnockout ||
    isLaterRound(row) ||
    row.scheduledStart !== null
  ) {
    return { error: { ok: false, reason: 'not-entry-round' } }
  }
  return row
}

/** Enter a team onto an entry-round side: same category, one KO slot per
 *  team, side free, slot undecided. */
export function canEnterTeam(
  snap: BracketSnapshot,
  slotId: string,
  side: 0 | 1,
  teamId: string
): Guard {
  const row = entryRow(snap, slotId)
  if ('error' in row) return row.error
  if (!snap.teamIdsInCategory.has(teamId)) return { ok: false, reason: 'not-in-category' }
  if (row.winnerSide !== null) return { ok: false, reason: 'slot-decided' }
  for (const slot of snap.slots) {
    if (!slot.isEntryRound || slot.id === slotId) continue
    if (slot.teams.includes(teamId)) return { ok: false, reason: 'already-slotted' }
  }
  const occupied = side === 0 ? row.teamA : row.teamB
  if (occupied !== null) return { ok: false, reason: 'side-occupied' }
  return { ok: true }
}

/** Remove an entered team (✕): only on an undecided slot. */
export function canClearTeam(snap: BracketSnapshot, slotId: string, side: 0 | 1): Guard {
  const row = entryRow(snap, slotId)
  if ('error' in row) return row.error
  if (row.winnerSide !== null) return { ok: false, reason: 'slot-decided' }
  const occupied = side === 0 ? row.teamA : row.teamB
  if (occupied === null) return { ok: false, reason: 'side-empty' }
  return { ok: true }
}

/** The row patch for a cleared entry: null the side and — because a placed
 *  slot holds two teams by construction, so any clear drops it below two —
 *  release the placement in the same single-row update. The pool match
 *  returns to the pool; the slot may degrade to bye-pending. */
export function clearTeamPatch(
  snap: BracketSnapshot,
  slotId: string,
  side: 0 | 1
): Record<string, null> {
  const slot = snap.slots.find((s) => s.id === slotId)!
  const patch: Record<string, null> = side === 0 ? { team_a: null } : { team_b: null }
  if (slot.placedMatchId !== null) patch.placed_match_id = null
  return patch
}

/** Place an unplaced pool match onto a two-team entry slot. */
export function canPlaceMatch(
  snap: BracketSnapshot,
  slotId: string,
  poolMatchId: string
): Guard {
  const row = entryRow(snap, slotId)
  if ('error' in row) return row.error
  if (row.teamA === null || row.teamB === null) return { ok: false, reason: 'slot-not-two-teams' }
  if (row.placedMatchId !== null) return { ok: false, reason: 'already-placed' }
  const pool = snap.pool.find((p) => p.id === poolMatchId)
  if (pool === undefined) return { ok: false, reason: 'no-pool-match' }
  if (pool.placedOnSlotId !== null) return { ok: false, reason: 'match-already-placed' }
  return { ok: true }
}

/** Balanced: every pool match placed, two-team entry slots equal the pool
 *  count, every entry slot holds at least one team. */
export function isBalanced(snap: BracketSnapshot): boolean {
  if (snap.pool.some((p) => p.placedOnSlotId === null)) return false
  const entry = snap.slots.filter((s) => s.isEntryRound)
  if (entry.some((s) => s.teams[0] === null && s.teams[1] === null)) return false
  const twoTeam = entry.filter((s) => s.teams[0] !== null && s.teams[1] !== null)
  return twoTeam.length === snap.pool.length
}

/** The byes to advance once balanced: each lone entry slot's team, written as
 *  its slot's winner. Empty when not balanced. */
export function byeAdvances(
  snap: BracketSnapshot
): Array<{ slotId: string; winnerSide: 'a' | 'b'; teamId: string }> {
  if (!isBalanced(snap)) return []
  const out: Array<{ slotId: string; winnerSide: 'a' | 'b'; teamId: string }> = []
  for (const slot of snap.slots) {
    if (!slot.isEntryRound || !slot.bye) continue
    const row = snap.rowsById.get(slot.id)!
    if (row.winnerSide !== null) continue
    out.push({
      slotId: slot.id,
      winnerSide: row.teamA !== null ? 'a' : 'b',
      teamId: row.teamA ?? row.teamB!
    })
  }
  return out
}

/** The winner toggle: pick when undecided (both sides set; entry rounds also
 *  placed), un-pick by clicking the selected side again — instantly when
 *  nothing downstream moved, else as a cascade the caller must confirm. */
export function canToggleWinner(
  snap: BracketSnapshot,
  slotId: string,
  side: 0 | 1
): WinnerToggleGuard {
  const row = snap.rowsById.get(slotId)
  if (row === undefined || !row.isKnockout) return { ok: false, reason: 'not-a-slot' }
  const slot = snap.slots.find((s) => s.id === slotId)
  if (slot === undefined) return { ok: false, reason: 'not-a-slot' }
  if (slot.teams[0] === null || slot.teams[1] === null) {
    return { ok: false, reason: 'sides-not-set' }
  }
  if (slot.isEntryRound && slot.placedMatchId === null) {
    return { ok: false, reason: 'not-placed' }
  }
  if (row.winnerSide === null) return { ok: true, action: 'pick' }
  if ((row.winnerSide === 'a' ? 0 : 1) !== side) {
    return { ok: false, reason: 'winner-is-other-side' }
  }
  if (downstreamTouched(snap, slotId)) {
    return { ok: false, reason: 'needs-cascade', cascade: planCascade(snap, slotId) }
  }
  return { ok: true, action: 'un-pick' }
}

// ---------------------------------------------------------------------------
// Cascade (spec §6: corrections cascade-clear behind a confirmation that
// enumerates the blast radius; lineups stand while their team stays).
// ---------------------------------------------------------------------------

/** Slots fed (transitively) by this one. */
function downstreamOf(snap: BracketSnapshot, slotId: string): string[] {
  const feeders = new Map<string, string[]>()
  for (const row of snap.rowsById.values()) {
    const direct: string[] = []
    if (row.fedByA !== null) direct.push(row.fedByA)
    if (row.fedByB !== null) direct.push(row.fedByB)
    for (const f of direct) {
      feeders.set(f, [...(feeders.get(f) ?? []), row.id])
    }
  }
  const seen: string[] = []
  const walk = (id: string): void => {
    for (const next of feeders.get(id) ?? []) {
      if (!seen.includes(next)) {
        seen.push(next)
        walk(next)
      }
    }
  }
  walk(slotId)
  return seen
}

/** True when any downstream slot has a decided winner or any lineup sits on a
 *  downstream tie — the un-pick then needs the cascade confirmation. */
export function downstreamTouched(snap: BracketSnapshot, slotId: string): boolean {
  for (const id of downstreamOf(snap, slotId)) {
    const row = snap.rowsById.get(id)!
    if (row.winnerSide !== null) return true
    if ((snap.lineupsByTie.get(id) ?? []).length > 0) return true
  }
  return false
}

export interface CascadePlan {
  /** Winners to clear: the origin plus every downstream slot it feeds. */
  clearedWinners: string[]
  /** Lineups to remove: submitted for a downstream side that departs when the
   *  chain clears (teams that survive keep theirs). */
  removedLineups: Array<{ tieId: string; teamId: string }>
}

export function planCascade(snap: BracketSnapshot, slotId: string): CascadePlan {
  const origin = snap.rowsById.get(slotId)!
  const downstream = downstreamOf(snap, slotId)
  const cleared = new Set<string>(downstream)
  if (origin.winnerSide !== null) cleared.add(origin.id)

  // Re-derive with the winners cleared to see which sides actually depart.
  const rows = [...snap.rowsById.values()].map((r) =>
    cleared.has(r.id) ? { ...r, winnerSide: null } : { ...r }
  )
  const after = buildBracketSnapshot(rows, [])

  const removedLineups: Array<{ tieId: string; teamId: string }> = []
  for (const id of downstream) {
    const surviving = after.slots.find((s) => s.id === id)?.teams ?? [null, null]
    for (const l of snap.lineupsByTie.get(id) ?? []) {
      if (!surviving.includes(l.teamId)) {
        removedLineups.push({ tieId: id, teamId: l.teamId })
      }
    }
  }
  return { clearedWinners: [...cleared], removedLineups }
}
