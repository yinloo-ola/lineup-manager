// Pure view-model for the bracket view (ko-import spec §7, prototype variant
// C — the grouped table): rounds as group headers, one row per bracket slot,
// with everything the template needs precomputed from the snapshot + guards:
// side cells (name / enter / clear), the winner/assignment cell (pick state,
// placement options), meta, pool chips, and the balance/advance status.
// Pure: no UI, no network.

import {
  byeAdvances,
  canClearTeam,
  canEnterTeam,
  canToggleWinner,
  isBalanced,
  type BracketSnapshot
} from './bracket'

export interface BracketSideVm {
  teamId: string | null
  /** "TBD" for unfilled sides (the on-screen vocabulary, spec §7). */
  name: string
  canEnter: boolean
  canClear: boolean
}

export interface BracketRowVm {
  slotId: string
  sideA: BracketSideVm
  sideB: BracketSideVm
  winnerSide: 'a' | 'b' | null
  winnerName: string | null
  /** Winner buttons enabled (undecided, sides set, placement rules met). */
  canPickA: boolean
  canPickB: boolean
  /** The slot's own or placed-pool schedule; null = bye / unscheduled. */
  schedule: { start: string; table: string } | null
  /** Entry round, two teams, not yet placed — the assign select shows. */
  needsPlacement: boolean
  /** Unplaced pool matches this slot may take. */
  unplacedPool: Array<{ id: string; label: string }>
  placedPoolLabel: string | null
  bye: boolean
}

export interface BracketRoundVm {
  label: string
  rows: BracketRowVm[]
}

export interface BracketView {
  rounds: BracketRoundVm[]
  pool: Array<{ id: string; label: string; placedOnSlotId: string | null }>
  /** Category teams not holding a KO slot — the entry pickers' options. */
  enterableTeams: Array<{ id: string; name: string }>
  balanced: boolean
  poolCount: number
  twoTeamSlots: number
  /** Byes waiting to advance once balanced (the action's badge). */
  byesToAdvance: number
  entryRoundLabel: string | null
}

/** A display label for a pool match chip / assign option — tournament-local
 *  time (the seed's offset-less form), not the raw stored instant. */
export function poolMatchLabel(p: { start: string; table: string }): string {
  return `${p.table} · ${p.start.slice(0, 16).replace('T', ' ')}`
}

export function buildBracketView(
  snapshot: BracketSnapshot,
  teamNameById: Map<string, string>
): BracketView {
  const nameOf = (teamId: string | null): string =>
    teamId === null ? 'TBD' : teamNameById.get(teamId) ?? teamId

  const unplacedPool = snapshot.pool
    .filter((p) => p.placedOnSlotId === null)
    .map((p) => ({ id: p.id, label: poolMatchLabel(p) }))

  const rounds: BracketRoundVm[] = []
  let current: BracketRoundVm | null = null
  for (const slot of snapshot.slots) {
    const label = slot.roundLabel ?? '—'
    if (current === null || current.label !== label) {
      current = { label, rows: [] }
      rounds.push(current)
    }
    const pickA = canToggleWinner(snapshot, slot.id, 0)
    const pickB = canToggleWinner(snapshot, slot.id, 1)
    const placedPool =
      slot.placedMatchId !== null
        ? snapshot.pool.find((p) => p.id === slot.placedMatchId) ?? null
        : null
    current.rows.push({
      slotId: slot.id,
      sideA: {
        teamId: slot.teams[0],
        name: nameOf(slot.teams[0]),
        canEnter: false, // probed per-side below (enterability is team-dependent)
        canClear: canClearTeam(snapshot, slot.id, 0).ok
      },
      sideB: {
        teamId: slot.teams[1],
        name: nameOf(slot.teams[1]),
        canEnter: false,
        canClear: canClearTeam(snapshot, slot.id, 1).ok
      },
      winnerSide: snapshot.rowsById.get(slot.id)!.winnerSide,
      winnerName: slot.winnerTeam === null ? null : nameOf(slot.winnerTeam),
      canPickA: pickA.ok && pickA.action === 'pick',
      canPickB: pickB.ok && pickB.action === 'pick',
      schedule: slot.schedule,
      needsPlacement: slot.isEntryRound && slot.teams[0] !== null && slot.teams[1] !== null && slot.placedMatchId === null,
      unplacedPool,
      placedPoolLabel: placedPool !== null ? poolMatchLabel(placedPool) : null,
      bye: slot.bye
    })
  }

  // Side enterability is team-dependent (category + one-slot rules); the
  // template's picker offers only legal teams, so the VM marks a side enterable
  // when ANY category team is enterable on it.
  for (const round of rounds) {
    for (const row of round.rows) {
      const slot = snapshot.slots.find((s) => s.id === row.slotId)!
      row.sideA.canEnter = [...snapshot.teamIdsInCategory].some(
        (t) => canEnterTeam(snapshot, slot.id, 0, t).ok
      )
      row.sideB.canEnter = [...snapshot.teamIdsInCategory].some(
        (t) => canEnterTeam(snapshot, slot.id, 1, t).ok
      )
    }
  }
  const entrySlots = snapshot.slots.filter((s) => s.isEntryRound)
  const used = new Set(
    snapshot.slots.flatMap((s) => s.teams).filter((t): t is string => t !== null)
  )
  return {
    rounds,
    enterableTeams: [...snapshot.teamIdsInCategory]
      .filter((t) => !used.has(t))
      .map((t) => ({ id: t, name: nameOf(t) })),
    pool: snapshot.pool.map((p) => ({
      id: p.id,
      label: poolMatchLabel(p),
      placedOnSlotId: p.placedOnSlotId
    })),
    balanced: isBalanced(snapshot),
    poolCount: snapshot.pool.length,
    twoTeamSlots: entrySlots.filter((s) => s.teams[0] !== null && s.teams[1] !== null).length,
    byesToAdvance: byeAdvances(snapshot).length,
    entryRoundLabel: snapshot.slots.find((s) => s.isEntryRound)?.roundLabel ?? null
  }
}
