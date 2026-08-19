import { describe, it, expect } from 'vitest'
import {
  buildBracketSnapshot,
  byeAdvances,
  canClearTeam,
  canEnterTeam,
  clearTeamPatch,
  canPlaceMatch,
  canToggleWinner,
  isBalanced,
  downstreamTouched,
  planCascade,
  type BracketLineupRow,
  type BracketTieRow
} from '../bracket'

// The ko-import worked example (spec §2/§6): Men's Team, 6 qualifiers, draw of 8.
// Group ties put tA..tF in the category; QF1..QF4 are entry slots (2 byes will
// emerge), p1/p2 the imported pool matches, SF1/SF2/F the fed later rounds.
function rows(): BracketTieRow[] {
  return [
    // Group ties (category membership + irrelevant to the bracket itself)
    g('g1', 'tA', 'tB'), g('g2', 'tC', 'tD'), g('g3', 'tE', 'tF'),
    // Entry slots: no schedule, no feeds, no teams
    slot('s-qf1'), slot('s-qf2'), slot('s-qf3'), slot('s-qf4'),
    // Pool: scheduled, unplaced
    pool('p1', '2026-09-13T14:00', 'T2'), pool('p2', '2026-09-13T14:00', 'T3'),
    // Later rounds: scheduled + fed
    slot('s-sf1', { start: '2026-09-13T16:00', table: 'T2', fedBy: ['s-qf1', 's-qf2'] }),
    slot('s-sf2', { start: '2026-09-13T16:00', table: 'T3', fedBy: ['s-qf3', 's-qf4'] }),
    slot('s-f1', { start: '2026-09-13T18:00', table: 'T1', fedBy: ['s-sf1', 's-sf2'] })
  ]
}

function g(id: string, a: string, b: string): BracketTieRow {
  return { ...blank(id), isKnockout: false, scheduledStart: '2026-09-13T09:00', teamA: a, teamB: b, groupLabel: 'A' }
}
function slot(
  id: string,
  extra: Partial<BracketTieRow> & { fedBy?: [string, string] } = {}
): BracketTieRow {
  const { fedBy, ...rest } = extra
  return {
    ...blank(id),
    isKnockout: true,
    ...(fedBy ? { fedByA: fedBy[0], fedByB: fedBy[1] } : {}),
    ...rest
  }
}
function pool(id: string, start: string, table: string): BracketTieRow {
  return { ...blank(id), isKnockout: true, scheduledStart: start, tableLabel: table }
}
function blank(id: string): BracketTieRow {
  return {
    id, categoryId: 'MT', scheduledStart: null, tableLabel: null,
    roundLabel: null, groupLabel: null, teamA: null, teamB: null,
    fedByA: null, fedByB: null, winnerSide: null, placedMatchId: null, isKnockout: false
  }
}
function lineup(tieId: string, teamId: string): BracketLineupRow {
  return { tieId, teamId, status: 'submitted' }
}

describe('buildBracketSnapshot — derivation', () => {
  it('classifies slots vs pool and derives fed sides from feeder winners', () => {
    const rs = rows()
    // QF1 decided for tA; SF1's side 1 derives tA, side 2 stays TBD.
    rs.find((r) => r.id === 's-qf1')!.winnerSide = null // no winner yet
    let snap = buildBracketSnapshot(rs, [])
    const sf1 = snap.slots.find((s) => s.id === 's-sf1')!
    expect(sf1.teams).toEqual([null, null])

    const qf1 = rs.find((r) => r.id === 's-qf1')!
    qf1.teamA = 'tA'; qf1.teamB = 'tB'; qf1.winnerSide = 'a'
    snap = buildBracketSnapshot(rs, [])
    expect(snap.slots.find((s) => s.id === 's-sf1')!.teams).toEqual(['tA', null])
    // Derivation is a pure function of the rows: rebuild to see later picks.
    const sf2r = rs.find((r) => r.id === 's-sf2')!
    sf2r.winnerSide = 'a'
    snap = buildBracketSnapshot(rs, [])
    // F side 1 waits on SF2's winner-team — SF2's feeders are undecided, so TBD.
    expect(snap.slots.find((s) => s.id === 's-f1')!.teams).toEqual([null, null])
    const sf1r = rs.find((r) => r.id === 's-sf1')!
    sf1r.winnerSide = 'a'
    snap = buildBracketSnapshot(rs, [])
    expect(snap.slots.find((s) => s.id === 's-f1')!.teams).toEqual(['tA', null])
  })

  it('derives an entry slot schedule from its placed pool match', () => {
    const rs = rows()
    const qf2 = rs.find((r) => r.id === 's-qf2')!
    qf2.teamA = 'tC'; qf2.teamB = 'tD'; qf2.placedMatchId = 'p1'
    const snap = buildBracketSnapshot(rs, [])
    const slotView = snap.slots.find((s) => s.id === 's-qf2')!
    expect(slotView.schedule).toEqual({ start: '2026-09-13T14:00', table: 'T2' })
    expect(snap.slots.find((s) => s.id === 's-qf1')!.schedule).toBeNull()
    expect(snap.pool.find((p) => p.id === 'p1')!.placedOnSlotId).toBe('s-qf2')
  })

  it('collects the category team set from group ties and orders rounds largest-first', () => {
    const snap = buildBracketSnapshot(rows(), [])
    expect([...snap.teamIdsInCategory].sort()).toEqual(['tA', 'tB', 'tC', 'tD', 'tE', 'tF'])
    expect(snap.slots.map((s) => s.id)).toEqual([
      's-qf1', 's-qf2', 's-qf3', 's-qf4', 's-sf1', 's-sf2', 's-f1'
    ])
    expect(snap.slots.every((s) => s.isEntryRound === !s.fedBy[0])).toBe(true)
  })
})

describe('entry guards (spec §6)', () => {
  it('accepts a category team on an empty entry side', () => {
    const snap = buildBracketSnapshot(rows(), [])
    expect(canEnterTeam(snap, 's-qf1', 0, 'tA')).toEqual({ ok: true })
  })

  it('rejects a team from outside the category', () => {
    const snap = buildBracketSnapshot(rows(), [])
    expect(canEnterTeam(snap, 's-qf1', 0, 'tZ')).toEqual({
      ok: false, reason: 'not-in-category'
    })
  })

  it('rejects a team already holding a KO slot in the category', () => {
    const rs = rows()
    rs.find((r) => r.id === 's-qf1')!.teamA = 'tA'
    const snap = buildBracketSnapshot(rs, [])
    expect(canEnterTeam(snap, 's-qf3', 0, 'tA')).toEqual({
      ok: false, reason: 'already-slotted'
    })
  })

  it('rejects an occupied side, a decided slot, and a later-round slot', () => {
    const rs = rows()
    const qf1 = rs.find((r) => r.id === 's-qf1')!
    qf1.teamA = 'tA'
    const snap = buildBracketSnapshot(rs, [])
    expect(canEnterTeam(snap, 's-qf1', 0, 'tB')).toEqual({ ok: false, reason: 'side-occupied' })
    qf1.teamB = 'tB'; qf1.winnerSide = 'a'
    expect(canEnterTeam(snap, 's-qf1', 1, 'tC')).toEqual({ ok: false, reason: 'slot-decided' })
    expect(canEnterTeam(snap, 's-sf1', 0, 'tC')).toEqual({ ok: false, reason: 'not-entry-round' })
  })

  it('rejects the imported pool as an entry slot — pool matches take no teams or position', () => {
    const snap = buildBracketSnapshot(rows(), [])
    expect(canEnterTeam(snap, 'p1', 0, 'tA')).toEqual({ ok: false, reason: 'not-entry-round' })
    expect(canPlaceMatch(snap, 'p1', 'p2')).toEqual({ ok: false, reason: 'not-entry-round' })
  })

  it('clears an entry only on an undecided slot', () => {
    const rs = rows()
    const qf1 = rs.find((r) => r.id === 's-qf1')!
    qf1.teamA = 'tA'
    const snap = buildBracketSnapshot(rs, [])
    expect(canClearTeam(snap, 's-qf1', 0)).toEqual({ ok: true })
    qf1.winnerSide = 'a'
    const snap2 = buildBracketSnapshot(rs, [])
    expect(canClearTeam(snap2, 's-qf1', 0)).toEqual({ ok: false, reason: 'slot-decided' })
  })
})

describe('placement + balance + byes (spec §6)', () => {
  function filled(rs: BracketTieRow[]): BracketTieRow[] {
    // Byes at QF1/QF4 (lone teams), real matches at QF2/QF3 (placed).
    set(rs, 's-qf1', { teamA: 'tA' })
    set(rs, 's-qf2', { teamA: 'tC', teamB: 'tD', placedMatchId: 'p1' })
    set(rs, 's-qf3', { teamA: 'tE', teamB: 'tF', placedMatchId: 'p2' })
    set(rs, 's-qf4', { teamA: 'tB' })
    return rs
  }
  function set(rs: BracketTieRow[], id: string, patch: Partial<BracketTieRow>): void {
    Object.assign(rs.find((r) => r.id === id)!, patch)
  }

  it('releases the placement whenever a placed slot loses a team (single patch)', () => {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 's-qf2')!, {
      teamA: 'tC', teamB: 'tD', placedMatchId: 'p1'
    })
    const snap = buildBracketSnapshot(rs, [])
    // A placed slot holds two teams by construction — ANY clear drops it below
    // two, so the patch always releases the pool match back to the pool.
    expect(clearTeamPatch(snap, 's-qf2', 1)).toEqual({ team_b: null, placed_match_id: null })
    const unplaced = buildBracketSnapshot(rows(), [])
    expect(clearTeamPatch(unplaced, 's-qf1', 0)).toEqual({ team_a: null })
  })

  it('places only unplaced pool matches onto two-team entry slots', () => {
    const rs = filled(rows())
    let snap = buildBracketSnapshot(rs, [])
    expect(canPlaceMatch(snap, 's-qf2', 'p1')).toEqual({ ok: false, reason: 'already-placed' })
    expect(canPlaceMatch(snap, 's-qf1', 'p1')).toEqual({ ok: false, reason: 'slot-not-two-teams' })
    expect(canPlaceMatch(snap, 's-sf1', 'p1')).toEqual({ ok: false, reason: 'not-entry-round' })
    // Re-bind after release is fine.
    set(rs, 's-qf2', { placedMatchId: null })
    snap = buildBracketSnapshot(rs, [])
    expect(canPlaceMatch(snap, 's-qf2', 'p1')).toEqual({ ok: true })
  })

  it('balances only when every pool match is placed, two-team slots match the pool count, and every slot has a team', () => {
    const rs = filled(rows())
    expect(isBalanced(buildBracketSnapshot(rs, []))).toBe(true)
    // An unplaced pool match breaks it.
    set(rs, 's-qf3', { placedMatchId: null })
    expect(isBalanced(buildBracketSnapshot(rs, []))).toBe(false)
    // An empty slot breaks it.
    const rs2 = filled(rows())
    set(rs2, 's-qf4', { teamA: null })
    expect(isBalanced(buildBracketSnapshot(rs2, []))).toBe(false)
  })

  it('advances the lone teams of bye slots once balanced', () => {
    const rs = filled(rows())
    const advances = byeAdvances(buildBracketSnapshot(rs, []))
    expect(advances).toEqual([
      { slotId: 's-qf1', winnerSide: 'a', teamId: 'tA' },
      { slotId: 's-qf4', winnerSide: 'a', teamId: 'tB' }
    ])
    // Not balanced → nothing advances.
    set(rs, 's-qf3', { placedMatchId: null })
    expect(byeAdvances(buildBracketSnapshot(rs, []))).toEqual([])
  })
})

describe('winner toggle (spec §6)', () => {
  function decided(): BracketTieRow[] {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 's-qf2')!, {
      teamA: 'tC', teamB: 'tD', placedMatchId: 'p1', winnerSide: 'a'
    })
    return rs
  }

  it('requires both sides and, in the entry round, a placement', () => {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 's-qf2')!, { teamA: 'tC', teamB: 'tD' })
    let snap = buildBracketSnapshot(rs, [])
    expect(canToggleWinner(snap, 's-qf2', 0)).toEqual({ ok: false, reason: 'not-placed' })
    Object.assign(rs.find((r) => r.id === 's-qf2')!, { placedMatchId: 'p1' })
    snap = buildBracketSnapshot(rs, [])
    expect(canToggleWinner(snap, 's-qf2', 0)).toEqual({ ok: true, action: 'pick' })
    // Later rounds need no placement (their schedule is their own): give SF1
    // both sides via its feeders' winners, then toggle.
    Object.assign(rs.find((r) => r.id === 's-qf1')!, { teamA: 'tA', teamB: 'tB', winnerSide: 'a' })
    Object.assign(rs.find((r) => r.id === 's-qf2')!, { winnerSide: 'a' })
    expect(canToggleWinner(buildBracketSnapshot(rs, []), 's-sf1', 0)).toEqual({ ok: true, action: 'pick' })
  })

  it('un-picks via the selected side only — the other side is refused', () => {
    const snap = buildBracketSnapshot(decided(), [])
    expect(canToggleWinner(snap, 's-qf2', 0)).toEqual({ ok: true, action: 'un-pick' })
    expect(canToggleWinner(snap, 's-qf2', 1)).toEqual({ ok: false, reason: 'winner-is-other-side' })
  })
})

describe('cascade (spec §6: corrections cascade-clear behind a confirmation)', () => {
  function progressed(): BracketTieRow[] {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 's-qf2')!, {
      teamA: 'tC', teamB: 'tD', placedMatchId: 'p1', winnerSide: 'a'
    })
    Object.assign(rs.find((r) => r.id === 's-qf3')!, {
      teamA: 'tE', teamB: 'tF', placedMatchId: 'p2', winnerSide: 'a'
    })
    Object.assign(rs.find((r) => r.id === 's-sf1')!, { winnerSide: 'a' })
    Object.assign(rs.find((r) => r.id === 's-f1')!, { winnerSide: 'b' })
    return rs
  }

  it('a winner with nothing downstream un-picks instantly', () => {
    const rs = progressed()
    // Complete the bracket to the Final (byes advanced, SFs decided), then
    // consider picking on the Final — nothing sits downstream of it.
    Object.assign(rs.find((r) => r.id === 's-qf1')!, { teamA: 'tA', winnerSide: 'a' })
    Object.assign(rs.find((r) => r.id === 's-qf4')!, { teamA: 'tB', winnerSide: 'a' })
    Object.assign(rs.find((r) => r.id === 's-sf1')!, { winnerSide: 'a' }) // SF1 [tA, tC] -> tA
    Object.assign(rs.find((r) => r.id === 's-sf2')!, { winnerSide: 'a' }) // SF2 [tE, tB] -> tE
    Object.assign(rs.find((r) => r.id === 's-f1')!, { winnerSide: null })
    const snap = buildBracketSnapshot(rs, [])
    expect(snap.slots.find((x) => x.id === 's-f1')!.teams).toEqual(['tA', 'tE'])
    expect(downstreamTouched(snap, 's-f1')).toBe(false)
    expect(canToggleWinner(snap, 's-f1', 0)).toEqual({ ok: true, action: 'pick' })
  })

  it('any downstream winner or lineup makes the un-pick a cascade', () => {
    const snap = buildBracketSnapshot(progressed(), [])
    expect(downstreamTouched(snap, 's-qf2')).toBe(true)
    expect(canToggleWinner(snap, 's-qf2', 0)).toEqual({
      ok: false, reason: 'needs-cascade', cascade: planCascade(snap, 's-qf2')
    })
  })

  it('enumerates the blast radius: downstream winners clear, departed sides lose lineups, origin teams keep theirs', () => {
    const rs = progressed()
    const lineups = [
      lineup('s-qf2', 'tC'), // origin tie: team stays (winner cleared, sides stay) — stands
      lineup('s-sf1', 'tC'), // downstream: tC departs when the chain clears — removed
      lineup('s-sf1', 'tE')  // downstream: tE also departs (SF1 winner cleared) — removed
    ]
    const plan = planCascade(buildBracketSnapshot(rs, lineups), 's-qf2')
    expect(plan.clearedWinners.sort()).toEqual(['s-f1', 's-qf2', 's-sf1'])
    expect(plan.removedLineups).toEqual([
      { tieId: 's-sf1', teamId: 'tC' },
      { tieId: 's-sf1', teamId: 'tE' }
    ])
  })

  it('keeps a downstream lineup whose team survives the correction', () => {
    const rs = progressed()
    // SF2 is untouched by the QF2 cascade; its lineup stands.
    Object.assign(rs.find((r) => r.id === 's-sf2')!, { winnerSide: 'a' })
    const lineups = [lineup('s-sf2', 'tE'), lineup('s-sf1', 'tC'), lineup('s-sf1', 'tE')]
    const plan = planCascade(buildBracketSnapshot(rs, lineups), 's-qf2')
    expect(plan.removedLineups).toEqual([
      { tieId: 's-sf1', teamId: 'tC' },
      { tieId: 's-sf1', teamId: 'tE' }
    ])
  })
})
