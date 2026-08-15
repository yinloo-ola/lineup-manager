import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'

// The active tournament scope. The Administrator picks from all tournaments; a
// Team Manager sees only their own (via the Ticket #13 manager-own-tournament
// policy) and never switches. The admin's choice is persisted to local storage.

export interface Tournament {
  id: string
  name: string
  startDate: string | null
  /** Date part of the tournament's last scheduled team match; null when none. */
  lastStart: string | null
}

const LS_KEY = 'lineup.activeTournamentId'

interface TournamentRow {
  id: string
  name: string
  start_date: string | null
  ties: { scheduled_start: string }[] | null
}

export const useTournamentStore = defineStore('tournament', () => {
  const tournaments = ref<Tournament[]>([])
  // Seed from storage so a reload keeps the admin in the same tournament.
  const activeId = ref<string | null>(localStorage.getItem(LS_KEY))
  const loaded = ref(false)

  const active = computed(() => tournaments.value.find((t) => t.id === activeId.value) ?? null)

  /** Persist + commit a new active tournament (Administrator only). */
  function setActive(id: string): void {
    activeId.value = id
    localStorage.setItem(LS_KEY, id)
  }

  /**
   * Load the tournaments visible to the caller — all of them for an admin
   * (admin RLS), just their own for a manager (manager-own-tournament policy).
   * Resolves the active id: keep the persisted choice if still valid, else the
   * first available; clears it when there are none. The nested ties select
   * carries only each tournament's LAST scheduled team match (the selector's
   * past-tournament rule — a start date alone can't tell running from past),
   * bounded so history doesn't grow the payload.
   */
  async function load(): Promise<void> {
    const { data, error } = await supabase
      .from('tournaments')
      .select('id, name, start_date, ties(scheduled_start)')
      .order('name')
      // Per-embedded modifiers: only each tournament's LAST team match (desc,
      // limit 1) travels — bounded as history grows.
      .order('scheduled_start', { referencedTable: 'ties', ascending: false })
      .limit(1, { referencedTable: 'ties' })
    if (error) throw error
    tournaments.value = ((data as TournamentRow[] | null) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      startDate: r.start_date,
      lastStart: r.ties?.[0]?.scheduled_start.slice(0, 10) ?? null
    }))

    const ids = new Set(tournaments.value.map((t) => t.id))
    if (activeId.value && ids.has(activeId.value)) return
    if (tournaments.value[0]) {
      setActive(tournaments.value[0].id)
    } else {
      activeId.value = null
      localStorage.removeItem(LS_KEY)
    }
  }

  /** Reset on sign-out so a different user starts fresh. */
  function clear(): void {
    tournaments.value = []
    activeId.value = null
    localStorage.removeItem(LS_KEY)
    loaded.value = false
  }

  return { tournaments, activeId, active, loaded, load, setActive, clear }
})
