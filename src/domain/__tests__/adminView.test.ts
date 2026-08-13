import { describe, it, expect } from 'vitest'
import { buildAdminLineupRows, type AdminLineupInput, type AdminTieInput } from '../adminView'

const NOW = '2026-06-01T12:00:00Z'

function lineup(tieId: string, teamId: string, status: AdminLineupInput['status']): AdminLineupInput {
  return { tieId, teamId, status, updatedAt: '2026-01-01T00:00Z', updatedBy: 'admin@lineup.local' }
}

describe('buildAdminLineupRows', () => {
  it('maps each lineup to team + opponent + category + cutoff + status', () => {
    const rows = buildAdminLineupRows({
      lineups: [lineup('t1', 'Alpha', 'submitted')],
      ties: [
        {
          tieId: 't1',
          categoryId: 'cat',
          scheduledStart: '2099-01-01T10:00:00Z',
          teamIds: ['Alpha', 'Bravo']
        }
      ],
      teamNameById: new Map([
        ['Alpha', 'Alpha'],
        ['Bravo', 'Bravo']
      ]),
      categoryNameById: new Map([['cat', "Men's Team"]]),
      leadTimeByCategory: new Map([['cat', 30]]),
      now: NOW
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      teamName: 'Alpha',
      opponentName: 'Bravo',
      categoryName: "Men's Team",
      status: 'submitted',
      updatedBy: 'admin@lineup.local',
      locked: false
    })
  })

  it('picks the opponent as the other team in the tie', () => {
    const rows = buildAdminLineupRows({
      lineups: [lineup('t1', 'Bravo', 'draft')],
      ties: [
        { tieId: 't1', categoryId: 'c', scheduledStart: '2099-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] }
      ],
      teamNameById: new Map([
        ['Alpha', 'Alpha'],
        ['Bravo', 'Bravo']
      ]),
      categoryNameById: new Map([['c', 'C']]),
      leadTimeByCategory: new Map([['c', 30]]),
      now: NOW
    })
    expect(rows[0].opponentName).toBe('Alpha')
  })

  it('flags a past-cutoff tie as locked', () => {
    const rows = buildAdminLineupRows({
      lineups: [lineup('t1', 'Alpha', 'draft')],
      ties: [
        { tieId: 't1', categoryId: 'c', scheduledStart: '2000-01-01T10:00:00Z', teamIds: ['Alpha', 'Bravo'] }
      ],
      teamNameById: new Map([
        ['Alpha', 'Alpha'],
        ['Bravo', 'Bravo']
      ]),
      categoryNameById: new Map([['c', 'C']]),
      leadTimeByCategory: new Map([['c', 30]]),
      now: NOW
    })
    expect(rows[0].locked).toBe(true)
  })

  it('skips lineups whose tie is missing', () => {
    const rows = buildAdminLineupRows({
      lineups: [lineup('orphan', 'Alpha', 'draft')],
      ties: [] as AdminTieInput[],
      teamNameById: new Map(),
      categoryNameById: new Map(),
      leadTimeByCategory: new Map(),
      now: NOW
    })
    expect(rows).toEqual([])
  })
})
