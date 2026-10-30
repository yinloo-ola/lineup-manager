<script setup lang="ts">
// The umpire console (results slice R5): the group ties of the tournament this
// account umpires, each with its entry gate and derived entry state. Entry
// happens one tie at a time through UmpireEntryDialog; the save path is the
// upsert_umpire_result RPC (the gate is re-enforced server-side).
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  buildUmpireTieRows,
  type UmpireLineupInput,
  type UmpireTieRow
} from '@/domain/umpireView'
import {
  classifySlots,
  computeWindow,
  deriveSlots,
  type ScheduleSlot
} from '@/domain/scheduleWindow'
import type { GameScore, Side } from '@/domain/results'
import UmpireEntryDialog from '@/components/UmpireEntryDialog.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import MatchCard, { type MatchCardTie } from '@/components/MatchCard.vue'
import SlotSection from '@/components/SlotSection.vue'
import ShelvedPanel from '@/components/ShelvedPanel.vue'

const auth = useAuthStore()
const rows = ref<UmpireTieRow[]>([])
const tournamentName = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(true)

// The team event filter (null = all events): at a big venue an umpire scores
// one event at a time — the column keeps the context, the filter cuts noise.
const categories = ref<{ id: string; name: string }[]>([])
const eventFilter = ref<string | null>(null)

const eventOptions = computed(() => [
  { id: null, name: 'All team events' },
  ...categories.value
])

function matchesEvent(r: UmpireTieRow): boolean {
  if (eventFilter.value === null) return true
  return r.categoryName === categories.value.find((c) => c.id === eventFilter.value)?.name
}

// --- the timeslot working window (venue-ux R3/R4) ---
const showAll = ref(false)
const searchQuery = ref('')

const filteredRows = computed(() =>
  rows.value.filter((r) => {
    if (!matchesEvent(r)) return false
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return true
    return `${r.teamAName} ${r.teamBName} ${r.categoryName ?? ''}`.toLowerCase().includes(q)
  })
)

interface SlotRows {
  slotIdx: number
  label: string
  day: string
  isCurrent: boolean
  rows: UmpireTieRow[]
}

function dayPrefix(start: Date): string {
  const today = new Date()
  const sameDay =
    start.getUTCFullYear() === today.getUTCFullYear() &&
    start.getUTCMonth() === today.getUTCMonth() &&
    start.getUTCDate() === today.getUTCDate()
  if (sameDay) return ''
  return start.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' }) + ' · '
}

const slotRows = computed(() => {
  const slots = deriveSlots(
    filteredRows.value.map((r) => ({ tieId: r.tieId, scheduledStart: r.scheduledStart }))
  )
  const byTie = new Map(filteredRows.value.map((r) => [r.tieId, r]))
  const windowIdx = computeWindow(slots, new Date())
  const classified = showAll.value
    ? { windowed: slots.map((_, i) => i), shelved: [] as number[] }
    : classifySlots(slots, windowIdx)

  const section = (slotIdx: number, isCurrent: boolean): SlotRows => {
    const slot: ScheduleSlot = slots[slotIdx]
    const tableOf = (id: string): number => Number(byTie.get(id)?.table) || 9999
    return {
      slotIdx,
      label: slot.label,
      day: dayPrefix(slot.start),
      isCurrent,
      rows: slot.tieIds
        .map((id) => byTie.get(id))
        .filter((r): r is UmpireTieRow => r !== undefined)
        .sort((a, b) => tableOf(a.tieId) - tableOf(b.tieId))
    }
  }

  return {
    windowed: classified.windowed.map((i) => section(i, i === windowIdx.first)),
    shelved: classified.shelved.map((i) => section(i, false)),
    shelvedCount: classified.shelved.reduce(
      (n, i) => n + (slots[i]?.tieIds.length ?? 0),
      0
    )
  }
})

/** Map a console row onto the card's display state. */
function cardTie(r: UmpireTieRow): MatchCardTie {
  return {
    tieId: r.tieId,
    table: r.table,
    time: r.scheduledStart ? fmt(r.scheduledStart) : undefined,
    categoryName: r.categoryName,
    teamAName: r.teamAName,
    teamBName: r.teamBName,
    state: r.state === 'decided' ? 'decided' : r.entryOpen ? 'ready' : 'pending',
    tally: r.tally,
    winnerName: r.winnerName
  }
}

const data = reactive({
  tieTeamIds: new Map<string, [string, string]>(),
  lineups: [] as {
    tieId: string
    teamId: string
    status: UmpireLineupInput['status']
    playerIds: (string[] | null)[]
  }[],
  rosterNames: new Map<string, string>(),
  rubberCountByTie: new Map<string, number>(),
  bestOfByTie: new Map<string, number>(),
  storedByTie: new Map<
    string,
    ({ games: GameScore[]; walkover: boolean; walkoverSide: Side | null } | undefined)[]
    >()
  })

// --- the entry dialog ---
const entryOpen = ref(false)
const entryTie = ref<UmpireTieRow | null>(null)
const entryBestOf = ref(5)
const entryRubberCount = ref(0)
const entryPlayers = ref<[string[], string[]][]>([])
const entryStored = ref<{ games: GameScore[]; walkover: boolean; walkoverSide: Side | null }[]>([])

function fmt(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString()
}

async function load(): Promise<void> {
  errorMessage.value = null
  const tournamentId = auth.umpireTournamentId
  if (!tournamentId) {
    errorMessage.value = 'This account is not bound to a tournament.'
    loading.value = false
    return
  }
  try {
    const [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes, catsRes] =
      await Promise.all([
        supabase
          .from('ties')
          .select(
            'id, scheduled_start, table_label, team_a, team_b, is_knockout, category_id, best_of'
          )
          .eq('tournament_id', tournamentId)
          .order('scheduled_start'),
        supabase
          .from('lineups')
          .select('tie_id, team_id, status, player_ids')
          .eq('tournament_id', tournamentId),
        supabase.from('teams').select('id, name').eq('tournament_id', tournamentId),
        supabase.from('players').select('id, name').eq('tournament_id', tournamentId),
        supabase.from('tie_formats').select('category_id, rubbers').eq('tournament_id', tournamentId),
        supabase
          .from('rubber_results')
          .select('tie_id, rubber_index, games, walkover, walkover_side')
          .eq('tournament_id', tournamentId),
        supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle(),
        supabase.from('categories').select('id, name').eq('tournament_id', tournamentId).order('name')
      ])
    for (const r of [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes, catsRes]) {
      if (r.error) throw r.error
    }
    tournamentName.value = (tourRes.data as { name: string } | null)?.name ?? null
    const categoryNameById = new Map(
      ((catsRes.data as { id: string; name: string }[]) ?? []).map((c) => [c.id, c.name])
    )
    categories.value = (catsRes.data as { id: string; name: string }[]) ?? []

    const ties = (tiesRes.data as Record<string, unknown>[]) ?? []
    const rubberCountByCategory = new Map<string, number>()
    for (const f of (formatsRes.data as { category_id: string; rubbers: unknown }[]) ?? []) {
      if (Array.isArray(f.rubbers)) rubberCountByCategory.set(f.category_id, f.rubbers.length)
    }
    const rubberCountByTie = new Map<string, number>()
    const bestOfByTie = new Map<string, number>()
    data.tieTeamIds.clear()
    for (const t of ties) {
      rubberCountByTie.set(t.id as string, rubberCountByCategory.get(t.category_id as string) ?? 0)
      bestOfByTie.set(t.id as string, (t.best_of as number | null) ?? 5)
      data.tieTeamIds.set(t.id as string, [t.team_a as string, t.team_b as string])
    }

    const lineups = ((lineupsRes.data as Record<string, unknown>[]) ?? []).map((l) => ({
      tieId: l.tie_id as string,
      teamId: l.team_id as string,
      status: l.status as UmpireLineupInput['status'],
      playerIds: (l.player_ids as (string[] | null)[]) ?? []
    }))
    data.lineups = lineups
    data.rosterNames = new Map(
      ((playersRes.data as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name])
    )
    data.rubberCountByTie = rubberCountByTie
    data.bestOfByTie = bestOfByTie
    data.storedByTie.clear()
    for (const r of (resultsRes.data as Record<string, unknown>[]) ?? []) {
      const tieId = r.tie_id as string
      const arr = data.storedByTie.get(tieId) ?? []
      arr[(r.rubber_index as number) - 1] = {
        games: (r.games as GameScore[]) ?? [],
        walkover: (r.walkover as boolean) ?? false,
        walkoverSide: (r.walkover_side as Side | null) ?? null
      }
      data.storedByTie.set(tieId, arr)
    }

    rows.value = buildUmpireTieRows({
      ties: ties.map((t) => ({
        tieId: t.id as string,
        scheduledStart: (t.scheduled_start as string | null) ?? null,
        table: (t.table_label as string | null) ?? undefined,
        teamIds: [t.team_a as string | null, t.team_b as string | null],
        isKnockout: (t.is_knockout as boolean | null) ?? false,
        categoryName: categoryNameById.get(t.category_id as string)
      })),
      lineups: lineups.map((l) => ({
        tieId: l.tieId,
        teamId: l.teamId,
        status: l.status
      })),
      teamNameById: new Map(
        ((teamsRes.data as { id: string; name: string }[]) ?? []).map((t) => [t.id, t.name])
      ),
      rubberCountByTie,
      bestOfByTie,
      results: ((resultsRes.data as Record<string, unknown>[]) ?? []).map((r) => ({
        tieId: r.tie_id as string,
        rubberIndex: r.rubber_index as number,
        games: (r.games as GameScore[]) ?? [],
        walkover: (r.walkover as boolean) ?? false,
        walkoverSide: (r.walkover_side as Side | null) ?? undefined
      }))
    })
  } catch (e) {
    errorMessage.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openEntry(r: UmpireTieRow): void {
  entryTie.value = r
  entryBestOf.value = data.bestOfByTie.get(r.tieId) ?? 5
  entryRubberCount.value = data.rubberCountByTie.get(r.tieId) ?? 0

  // Players prefill: the submitted lineups' selection per rubber, displayed
  // through the roster names (the server re-derives these on save).
  const teamIds = data.tieTeamIds.get(r.tieId) ?? ['', '']
  const byTeam = new Map(data.lineups.filter((l) => l.tieId === r.tieId).map((l) => [l.teamId, l.playerIds]))
  const namesFor = (teamId: string, i: number): string[] =>
    (byTeam.get(teamId)?.[i] ?? []).map((id) => data.rosterNames.get(id) ?? id)
  entryPlayers.value = Array.from({ length: entryRubberCount.value }, (_, i) => [
    namesFor(teamIds[0], i),
    namesFor(teamIds[1], i)
  ] as [string[], string[]])

  const stored = data.storedByTie.get(r.tieId) ?? []
  entryStored.value = Array.from({ length: entryRubberCount.value }, (_, i) => {
    const s = stored[i]
    return s
      ? { games: s.games, walkover: s.walkover, walkoverSide: s.walkoverSide }
      : { games: [], walkover: false, walkoverSide: null }
  })
  entryOpen.value = true
}

async function onSaved(): Promise<void> {
  await load()
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>

    <v-card elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>Umpire console</v-card-title>
        <v-card-subtitle v-if="tournamentName">{{ tournamentName }}</v-card-subtitle>
        <template #append>
          <ThemeToggle />
        </template>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <div v-if="loading" class="text-body-2">Loading…</div>

        <template v-else>
          <div class="d-flex align-center ga-4 mb-3 flex-wrap">
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              label="Search player, team or event"
              density="compact"
              hide-details
              clearable
              style="max-width: 280px"
            />
            <v-spacer />
            <v-select
              v-model="eventFilter"
              :items="eventOptions"
              item-title="name"
              item-value="id"
              label="Team event"
              density="compact"
              hide-details
              style="max-width: 260px"
            />
          </div>

          <div data-testid="window">
            <template v-if="slotRows.windowed.length">
              <SlotSection
                v-for="s in slotRows.windowed"
                :key="s.slotIdx"
                :label="s.label"
                :day="s.day"
                :meta="s.isCurrent ? 'Now' : undefined"
              >
                <MatchCard
                  v-for="r in s.rows"
                  :key="r.tieId"
                  :tie="cardTie(r)"
                  @enter="openEntry(r)"
                />
              </SlotSection>
            </template>
            <p v-else class="text-body-2">No team matches in the working window.</p>
            <v-btn
              v-if="!showAll && slotRows.windowed.length === 0 && slotRows.shelvedCount > 0"
              variant="tonal"
              class="mt-2"
              @click="showAll = true"
            >
              Show all matches
            </v-btn>
          </div>

          <ShelvedPanel v-if="slotRows.shelved.length" :count="slotRows.shelvedCount">
            <SlotSection
              v-for="s in slotRows.shelved"
              :key="s.slotIdx"
              :label="s.label"
              :day="s.day"
            >
              <MatchCard v-for="r in s.rows" :key="r.tieId" :tie="cardTie(r)" @enter="openEntry(r)" />
            </SlotSection>
          </ShelvedPanel>
        </template>
      </v-card-text>
    </v-card>

    <UmpireEntryDialog
      v-model="entryOpen"
      :tie-id="entryTie?.tieId ?? ''"
      :event-name="entryTie?.categoryName ?? ''"
      :team-a-name="entryTie?.teamAName ?? ''"
      :team-b-name="entryTie?.teamBName ?? ''"
      :best-of="entryBestOf"
      :rubber-count="entryRubberCount"
      :players="entryPlayers"
      :stored="entryStored"
      @saved="onSaved"
    />
  </v-container>
</template>
