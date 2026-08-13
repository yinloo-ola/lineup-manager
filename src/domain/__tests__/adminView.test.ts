import { describe, it, expect } from 'vitest'
import { buildAdminLineupRows, type AdminLineupInput, type AdminTieInput } from '../adminView'
import type { Player, TieFormat } from '../types'

const NOW = '2026-06-01T12:00:00Z'
const mensSingles: TieFormat = { rubbers: [{ format: 'singles', constraint: { allowedGenders: ['M'] } }] }
const male = (id: string): Player => ({ id, name: id, gender: 'M', dateOfBirth: '1990-01-01' })
const female = (id: string): Player => ({ id, name: id, gender: 'F', dateOfBirth: '1990-01-01' })

function lineup(
  tieId: string,
  teamId: string,
  status: AdminLineupInput['status'],
  playerIds: (string[] | null)[]
): AdminLineupInput {
  return { tieId, teamId, status, playerIds, updatedAt: '2026-01-01T00:00Z', updatedBy: 'admin@lineup.local' }
}

function args(extras: Partial<Parameters<typeof buildAdminLineupRows>[0]> = {}) {
  return {
    lineups: [lineup('t1', 'Alpha', 'submitted', [['pa']])],
    ties: [
      { tieId: 't1', categoryId: 'cat', scheduledStart: '2099-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] }
    ],
    teamNameById: new Map([
      ['Alpha', 'Alpha'],
      ['Bravo', 'Bravo']
    ]),
    categoryNameById: new Map([['cat', "Men's Team"]]),
    leadTimeByCategory: new Map([['cat', 30]]),
    rosterByTeam: new Map([['Alpha', [male('pa')]]]),
    formatByCategory: new Map([['cat', mensSingles]]),
    now: NOW,
    ...extras
  }
}

describe('buildAdminLineupRows', () => {
  it('maps each lineup to team + opponent + category + cutoff + status', () => {
    const rows = buildAdminLineupRows(args())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      teamName: 'Alpha',
      opponentName: 'Bravo',
      categoryName: "Men's Team",
      locked: false,
      effectiveStatus: 'submitted'
    })
  })

  it('picks the opponent as the other team in the tie', () => {
    const rows = buildAdminLineupRows(
      args({
        lineups: [lineup('t1', 'Bravo', 'draft', [['pb']])],
        rosterByTeam: new Map([
          ['Alpha', [male('pa')]],
          ['Bravo', [male('pb')]]
        ])
      })
    )
    expect(rows[0].opponentName).toBe('Alpha')
  })

  it('flags a past-cutoff tie as locked', () => {
    const rows = buildAdminLineupRows(
      args({ ties: [{ tieId: 't1', categoryId: 'cat', scheduledStart: '2000-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] }] })
    )
    expect(rows[0].locked).toBe(true)
  })

  it('skips lineups whose tie is missing', () => {
    const rows = buildAdminLineupRows(args({ lineups: [lineup('orphan', 'Alpha', 'draft', [['pa']])], ties: [] as AdminTieInput[] }))
    expect(rows).toEqual([])
  })

  it('invalidates a submitted lineup the current structure makes illegal', () => {
    // Submitted a woman into men's singles (the format was tightened / or she was
    // mis-assigned): the row is flagged invalidated, but the data is retained.
    const rows = buildAdminLineupRows(
      args({
        lineups: [lineup('t1', 'Alpha', 'submitted', [['pf']])],
        rosterByTeam: new Map([['Alpha', [female('pf')]]])
      })
    )
    expect(rows[0].effectiveStatus).toBe('invalidated')
    expect(rows[0].playerIds).toEqual([['pf']]) // data retained
    expect(rows[0].status).toBe('submitted') // stored status unchanged
  })

  it('does not invalidate drafts (still being edited)', () => {
    const rows = buildAdminLineupRows(
      args({
        lineups: [lineup('t1', 'Alpha', 'draft', [['pf']])],
        rosterByTeam: new Map([['Alpha', [female('pf')]]])
      })
    )
    expect(rows[0].effectiveStatus).toBe('draft')
  })

  it('invalidates submitted lineups that a reschedule clashes (cross-slot)', () => {
    // Two Alpha ties now share a slot, both fielding pa — a reschedule clash.
    const slot = '2026-02-01T10:00:00Z'
    const rows = buildAdminLineupRows(
      args({
        lineups: [
          lineup('t1', 'Alpha', 'submitted', [['pa']]),
          lineup('t2', 'Alpha', 'submitted', [['pa']])
        ],
        ties: [
          { tieId: 't1', categoryId: 'cat', scheduledStart: slot, teamIds: ['Alpha', 'Bravo'] },
          { tieId: 't2', categoryId: 'cat', scheduledStart: slot, teamIds: ['Alpha', 'Bravo'] }
        ]
      })
    )
    expect(rows.map((r) => r.effectiveStatus)).toEqual(['invalidated', 'invalidated'])
  })
})
