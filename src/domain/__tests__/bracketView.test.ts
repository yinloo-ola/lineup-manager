import { describe, it, expect } from 'vitest'
import { buildBracketSnapshot, type BracketTieRow } from '../bracket'
import { buildBracketView, poolMatchLabel } from '../bracketView'

const NAMES = new Map([
  ['tA', 'Alpha'], ['tB', 'Bravo'], ['tC', 'Charlie'], ['tD', 'Delta'],
  ['tE', 'Echo'], ['tF', 'Foxtrot']
])

function rows(): BracketTieRow[] {
  const blank = (id: string): BracketTieRow => ({ id, categoryId: 'MT', scheduledStart: null, tableLabel: null, roundLabel: null, groupLabel: null, teamA: null, teamB: null, fedByA: null, fedByB: null, winnerSide: null, placedMatchId: null, isKnockout: false })
  const slot = (id: string, label: string, extra: Partial<BracketTieRow> = {}): BracketTieRow => ({ ...blank(id), isKnockout: true, roundLabel: label, ...extra })
  return [
    { ...blank('g1'), teamA: 'tA', teamB: 'tB' },
    { ...blank('g2'), teamA: 'tC', teamB: 'tD' },
    { ...blank('g3'), teamA: 'tE', teamB: 'tF' },
    slot('qf1', 'QF'), slot('qf2', 'QF'), slot('qf3', 'QF'), slot('qf4', 'QF'),
    { ...blank('p1'), isKnockout: true, roundLabel: 'QF', scheduledStart: '2026-09-13T14:00', tableLabel: 'T2' },
    { ...blank('p2'), isKnockout: true, roundLabel: 'QF', scheduledStart: '2026-09-13T14:00', tableLabel: 'T3' },
    slot('sf1', 'SF', { scheduledStart: '2026-09-13T16:00', tableLabel: 'T2', fedByA: 'qf1', fedByB: 'qf2' }),
    slot('sf2', 'SF', { scheduledStart: '2026-09-13T16:00', tableLabel: 'T3', fedByA: 'qf3', fedByB: 'qf4' }),
    slot('f1', 'F', { scheduledStart: '2026-09-13T18:00', tableLabel: 'T1', fedByA: 'sf1', fedByB: 'sf2' })
  ]
}

describe('buildBracketView', () => {
  it('groups rows by round with pool chips and balance status', () => {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 'qf2')!, { teamA: 'tC', teamB: 'tD', placedMatchId: 'p1' })
    const view = buildBracketView(buildBracketSnapshot(rs, []), NAMES)
    expect(view.rounds.map((r) => r.label)).toEqual(['QF', 'SF', 'F'])
    expect(view.rounds[0].rows).toHaveLength(4)
    expect(view.poolCount).toBe(2)
    expect(view.twoTeamSlots).toBe(1)
    expect(view.balanced).toBe(false)
    expect(view.pool.find((p) => p.id === 'p1')!.placedOnSlotId).toBe('qf2')
    expect(view.pool.find((p) => p.id === 'p2')!.placedOnSlotId).toBeNull()
  })

  it('exposes TBD names, enterability, placement options, and winner state per row', () => {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 'qf2')!, { teamA: 'tC', teamB: 'tD', placedMatchId: 'p1' })
    const view = buildBracketView(buildBracketSnapshot(rs, []), NAMES)
    const qf1 = view.rounds[0].rows[0]
    expect(qf1.sideA.name).toBe('TBD')
    expect(qf1.sideA.canEnter).toBe(true)
    expect(qf1.needsPlacement).toBe(false) // not two teams yet
    expect(qf1.schedule).toBeNull()
    expect(qf1.bye).toBe(false)
    const qf2 = view.rounds[0].rows[1]
    expect(qf2.sideA.name).toBe('Charlie')
    expect(qf2.sideA.canClear).toBe(true)
    expect(qf2.needsPlacement).toBe(false) // already placed
    expect(qf2.placedPoolLabel).toBe(poolMatchLabel({ start: '2026-09-13T14:00', table: 'T2' }))
    expect(qf2.canPickA).toBe(true) // two teams + placed
    // An unplaced two-team slot offers the remaining pool match only.
    Object.assign(rs.find((r) => r.id === 'qf3')!, { teamA: 'tE', teamB: 'tF' })
    const view2 = buildBracketView(buildBracketSnapshot(rs, []), NAMES)
    const qf3 = view2.rounds[0].rows[2]
    expect(qf3.needsPlacement).toBe(true)
    expect(qf3.unplacedPool.map((p) => p.id)).toEqual(['p2'])
    expect(qf3.canPickA).toBe(false) // winner needs a placement first
  })

  it('counts byes to advance once balanced', () => {
    const rs = rows()
    Object.assign(rs.find((r) => r.id === 'qf1')!, { teamA: 'tA' })
    Object.assign(rs.find((r) => r.id === 'qf2')!, { teamA: 'tC', teamB: 'tD', placedMatchId: 'p1' })
    Object.assign(rs.find((r) => r.id === 'qf3')!, { teamA: 'tE', teamB: 'tF', placedMatchId: 'p2' })
    Object.assign(rs.find((r) => r.id === 'qf4')!, { teamA: 'tB' })
    const view = buildBracketView(buildBracketSnapshot(rs, []), NAMES)
    expect(view.balanced).toBe(true)
    expect(view.byesToAdvance).toBe(2)
    expect(view.rounds[0].rows[0].bye).toBe(true)
  })
})
