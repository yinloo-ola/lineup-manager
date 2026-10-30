// Pure assembly of the umpire's tie list: the group ties of the tournament
// they umpire, each with its entry gate (both sides' lineups submitted) and
// entry state derived from the entered rubber results (not-entered / partial /
// decided, with the derived winner). Pure: no UI, no network.

import { DEFAULT_BEST_OF, deriveTieResult, type GameScore, type Side } from './results'
import { sideDisplayName } from './teamNames'
import type { Lineup } from './types'

export interface UmpireTieInput {
  tieId: string
  scheduledStart: string | null
  table?: string
  teamIds: [string | null, string | null]
  /** Knockout ties are outside slice 1's entry surface. */
  isKnockout?: boolean
  /** The team event's display name — every row names its event. */
  categoryName?: string
}

export interface UmpireLineupInput {
  tieId: string
  teamId: string
  status: Lineup['status']
}

/** One stored rubber result, as the umpire's list derives from it. */
export interface UmpireResultInput {
  tieId: string
  rubberIndex: number
  games: GameScore[]
  walkover: boolean
  /** Which side received the walkover (side a when absent). */
  walkoverSide?: Side
}

export interface UmpireTieRow {
  tieId: string
  teamAName: string
  teamBName: string
  scheduledStart: string | null
  table?: string
  /** The team event this match belongs to. */
  categoryName?: string
  /** True when both sides have a submitted lineup — the entry gate. */
  entryOpen: boolean
  state: 'locked' | 'not-entered' | 'partial' | 'decided'
  /** Present once decided — the derived winner (never stored). */
  winnerSide?: Side
  winnerName?: string
}

/** The reason shown on a locked row. */
export const LOCKED_REASON = 'lineup not submitted'

export function buildUmpireTieRows(args: {
  ties: UmpireTieInput[]
  lineups: UmpireLineupInput[]
  teamNameById: Map<string, string>
  /** Rubbers in the tie's format, keyed by tie (defaults: no results shown). */
  rubberCountByTie?: Map<string, number>
  /** The tie's best-of (defaults 5 — the import default). */
  bestOfByTie?: Map<string, number>
  results?: UmpireResultInput[]
}): UmpireTieRow[] {
  const submitted = new Set(
    args.lineups.filter((l) => l.status === 'submitted').map((l) => `${l.tieId}:${l.teamId}`)
  )
  const resultsByTie = new Map<string, UmpireResultInput[]>()
  for (const r of args.results ?? []) {
    const arr = resultsByTie.get(r.tieId) ?? []
    arr.push(r)
    resultsByTie.set(r.tieId, arr)
  }
  return args.ties
    .filter((t) => !t.isKnockout && t.teamIds[0] !== null && t.teamIds[1] !== null)
    .map((t) => {
      const teamIds = t.teamIds as [string, string]
      const entryOpen =
        submitted.has(`${t.tieId}:${teamIds[0]}`) && submitted.has(`${t.tieId}:${teamIds[1]}`)
      const teamAName = sideDisplayName(teamIds[0], args.teamNameById)
      const teamBName = sideDisplayName(teamIds[1], args.teamNameById)

      let state: UmpireTieRow['state'] = entryOpen ? 'not-entered' : 'locked'
      let winnerSide: Side | undefined
      let winnerName: string | undefined
      if (entryOpen) {
        const rubberCount = args.rubberCountByTie?.get(t.tieId)
        const bestOf = args.bestOfByTie?.get(t.tieId) ?? DEFAULT_BEST_OF
        const entered = (resultsByTie.get(t.tieId) ?? []).sort(
          (x, y) => x.rubberIndex - y.rubberIndex
        )
        if (rubberCount !== undefined && entered.length > 0) {
          const derived = deriveTieResult(entered, bestOf, rubberCount)
          if (derived.state === 'decided' && derived.winnerSide) {
            state = 'decided'
            winnerSide = derived.winnerSide
            winnerName = derived.winnerSide === 'a' ? teamAName : teamBName
          } else {
            state = 'partial'
          }
        }
      }

      return {
        tieId: t.tieId,
        teamAName,
        teamBName,
        scheduledStart: t.scheduledStart,
        table: t.table,
        categoryName: t.categoryName,
        entryOpen,
        state,
        ...(winnerSide !== undefined ? { winnerSide, winnerName } : {})
      }
    })
}
