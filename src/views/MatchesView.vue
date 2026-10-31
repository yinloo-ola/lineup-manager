<script setup lang="ts">
// The Matches dashboard (spec §5 / ticket #14) — the screen the administrator
// runs a tournament day from. One row per team match, each team's lineup
// status inline in the on-screen vocabulary; chasing is visibility-only.
// The Team event selector separates rows by event, mirroring the Bracket tab.
import { computed, onMounted, ref, watch } from 'vue'
import { useTournamentStore } from '@/stores/tournament'
import { supabase } from '@/lib/supabase'
import { fetchMatches } from '@/services/lineupService'
import {
  loadTieResultContexts,
  setTieBestOf,
  type TieResultContext
} from '@/services/resultsService'
import { fetchAdminScopeData } from '@/services/adminScope'
import {
  classifySlots,
  computeWindow,
  deriveSlots,
  sortSlotTies,
  type ScheduleSlot
} from '@/domain/scheduleWindow'
import {
  matchMatchesEvent,
  matchMatchesFilter,
  type MatchFilter,
  type MatchRow
} from '@/domain/matchesDashboard'
import MatchCard, { type MatchCardTie } from '@/components/MatchCard.vue'
import MatchStatusChips from '@/components/MatchStatusChips.vue'
import SlotSection from '@/components/SlotSection.vue'
import CollapsibleMatchGroup from '@/components/CollapsibleMatchGroup.vue'
import { usePolling } from '@/composables/polling'
import ResultsEntryDialog from '@/components/ResultsEntryDialog.vue'

const tournaments = useTournamentStore()
const matches = ref<MatchRow[]>([])
const errorMessage = ref<string | null>(null)
const filter = ref<MatchFilter>('all')
const selected = ref<MatchRow | null>(null)

// Per-tie best-of editor (results slice R1): staged in the detail dialog,
// saved through the service; even/non-positive values surface as an error.
const bestOfDraft = ref<string>('')
const bestOfBusy = ref(false)
const bestOfError = ref<string | null>(null)
const bestOfSaved = ref(false)

watch(selected, (m) => {
  bestOfError.value = null
  bestOfSaved.value = false
  bestOfDraft.value = m ? String(m.bestOf ?? 5) : ''
})

async function saveBestOf(): Promise<void> {
  if (!selected.value) return
  bestOfBusy.value = true
  bestOfError.value = null
  bestOfSaved.value = false
  try {
    await setTieBestOf(supabase, selected.value.tieId, bestOfDraft.value)
    selected.value = { ...selected.value, bestOf: Number(bestOfDraft.value) }
    bestOfSaved.value = true
    await load()
  } catch (e) {
    bestOfError.value = (e as Error).message
  } finally {
    bestOfBusy.value = false
  }
}

// --- the admin results dialog (results slice R6) ---
interface PlayerOption {
  id: string
  name: string
}
const resultContexts = ref<Map<string, TieResultContext>>(new Map())
const rosterByTeam = ref<Map<string, PlayerOption[]>>(new Map())
const resultsTie = ref<MatchRow | null>(null)
const resultsOpen = ref(false)

/** Group ties with both teams known — knockout entry arrives in slice 3. */
const resultsEligible = (m: MatchRow): boolean =>
  !m.isKnockout && m.sides.every((s) => s.teamId !== null)

/** Side display names per rubber, from the submitted lineups (the who-played
 *  source of truth) — used for the admin dialog's score-column headers. */
const resultsPlayers = computed<[string[], string[]][] | undefined>(() => {
  if (!resultsTie.value) return undefined
  const ctx = resultContexts.value.get(resultsTie.value.tieId)
  if (!ctx) return undefined
  const roster = rosterByTeam.value
  const nameOf = (id: string | null): string => (id ? (roster.get(id) ?? []).find((p) => p.id === id)?.name ?? id : '—')
  const names = (ids: (string[] | null) | (string[] | null) | undefined): string[] =>
    (Array.isArray(ids) ? ids : []).map((id) => (id ? nameOf(id) : '—')) as string[]
  return Array.from({ length: ctx.rubberCount }, (_, i) => [
    names(ctx.prefill[0][i]),
    names(ctx.prefill[1][i])
  ]) as [string[], string[]][]
})

async function openResults(m: MatchRow): Promise<void> {
  // The dialog renders from the loaded contexts; under a cold parallel load
  // they may not be in yet — fetch before opening rather than showing a shell.
  if (!resultContexts.value.size) await loadResultsSupport()
  resultsTie.value = m
  resultsOpen.value = true
}

async function loadResultsSupport(): Promise<void> {
  if (!tournaments.activeId) return
  const [ctxs, scope] = await Promise.all([
    loadTieResultContexts(supabase, tournaments.activeId),
    fetchAdminScopeData(supabase, tournaments.activeId)
  ])
  resultContexts.value = ctxs
  rosterByTeam.value = scope.rosterByTeam as unknown as Map<string, PlayerOption[]>
}

async function onResultsSaved(): Promise<void> {
  await Promise.all([load(), loadResultsSupport()])
}

interface CategoryOption {
  id: string
  name: string
}
const categories = ref<CategoryOption[]>([])
/** Null = All team events (the default — the cross-event overview stands). */
const categoryId = ref<string | null>(null)

const eventOptions = computed<{ id: string | null; name: string }[]>(() => [
  { id: null, name: 'All team events' },
  ...categories.value
])

const FILTERS: { value: MatchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'not-submitted', label: 'Not submitted' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'past-cutoff', label: 'Past cutoff' }
]

// Venue freshness (venue-ux R7): poll the same load every 20s while visible;
// a mid-session failure keeps the last good data on screen.
const loadedOnce = ref(false)
usePolling(async () => {
  await Promise.all([
    load(),
    loadResultsSupport().catch((e) => {
      console.error('dashboard poll (contexts) failed:', (e as Error).message)
    })
  ])
  loadedOnce.value = true
})

const filtered = computed(() =>
  matches.value.filter((m) => matchMatchesEvent(m, categoryId.value) && matchMatchesFilter(m, filter.value))
)

// --- the timeslot card model (venue-ux R6): same window/shelf as the console ---
const showAll = ref(false)

function adminCard(m: MatchRow): MatchCardTie {
  return {
    tieId: m.tieId,
    table: m.table,
    time: fmtTime(m.scheduledStart),
    categoryName: m.categoryName,
    categoryId: m.categoryId,
    teamAName: m.sides[0].teamName,
    teamBName: m.sides[1].teamName,
    state:
      m.resultState === 'decided'
        ? 'decided'
        : m.sides.every((s) => s.status === 'submitted')
          ? 'ready'
          : m.isKnockout
            ? 'scheduled'
            : 'pending',
    tally: m.tally,
    winnerName: m.winnerName,
    admin: true,
    resultsAvailable: resultsEligible(m),
    sides: m.sides.map((s) => ({
      teamName: s.teamName,
      status: s.status,
      needsAttention: s.needsAttention
    })),
    isKnockout: m.isKnockout
  }
}

interface DashboardSlotRows {
  slotIdx: number
  label: string
  day: string
  isCurrent: boolean
  cards: { tie: MatchCardTie; row: MatchRow }[]
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
  // The window shapes the WHOLE schedule; filters narrow within sections —
  // a search can never reshape what "now" means (venue-ux R5).
  const slots = deriveSlots(
    matches.value.map((m) => ({ tieId: m.tieId, scheduledStart: m.scheduledStart }))
  )
  const byTie = new Map(matches.value.map((m) => [m.tieId, m]))
  const windowIdx = computeWindow(slots, new Date())
  const classified = showAll.value
    ? { windowed: slots.map((_, i) => i), past: [] as number[], future: [] as number[] }
    : classifySlots(slots, windowIdx)

  const section = (slotIdx: number, isCurrent: boolean): DashboardSlotRows => {
    const slot: ScheduleSlot = slots[slotIdx]
    const rows = sortSlotTies(
      slot.tieIds
        .map((id) => byTie.get(id))
        .filter((m): m is MatchRow => m !== undefined)
        .filter((m) => matchMatchesEvent(m, categoryId.value) && matchMatchesFilter(m, filter.value))
    )
    const cards = rows.map((row) => ({ tie: adminCard(row), row }))
    return { slotIdx, label: slot.label, day: dayPrefix(slot.start), isCurrent, cards }
  }

  return {
    windowed: classified.windowed.map((i) => section(i, i === windowIdx.first)),
    past: classified.past.map((i) => section(i, false)),
    future: classified.future.map((i) => section(i, false)),
    pastCount: classified.past.reduce((n, i) => n + (slots[i]?.tieIds.length ?? 0), 0),
    futureCount: classified.future.reduce((n, i) => n + (slots[i]?.tieIds.length ?? 0), 0)
  }
})

function fmt(iso: string | null): string {
  // Scheduled starts are tournament-local ISO stored with a UTC offset — render
  // them in UTC so card times agree with the slot headings on any device.
  return iso === null ? '—' : new Date(iso).toLocaleString(undefined, { timeZone: 'UTC' })
}

/** Compact card time: HH:mm in tournament-local (UTC) — the heading owns the day. */
function fmtTime(iso: string | null): string {
  return iso === null
    ? '—'
    : new Date(iso).toLocaleTimeString(undefined, {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
}

/** group · round metadata parts, shown where the seed provides them. */
function groupRoundParts(m: MatchRow): string[] {
  return [m.group, m.round].filter((x): x is string => x != null)
}

/** The drill-in metadata line: group · round · table · scheduled. */
function metadata(m: MatchRow): string {
  return [
    ...groupRoundParts(m),
    ...(m.table != null ? [`Table ${m.table}`] : []),
    fmt(m.scheduledStart)
  ].join(' · ')
}

async function load(): Promise<void> {
  if (!tournaments.activeId) return
  try {
    matches.value = await fetchMatches(supabase, tournaments.activeId)
    loadedOnce.value = true
    errorMessage.value = null
  } catch (e) {
    if (!loadedOnce.value) errorMessage.value = (e as Error).message
    else console.error('dashboard poll failed:', (e as Error).message)
  }
}

/** The event selector's list — same source and ordering as the Bracket tab. */
async function loadCategories(): Promise<void> {
  if (!tournaments.activeId) {
    categories.value = []
    return
  }
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('tournament_id', tournaments.activeId)
    .order('name')
  if (error) {
    errorMessage.value = error.message
    return
  }
  categories.value = (data as CategoryOption[] | null) ?? []
}

// Re-scope when the administrator switches tournament. The event selection
// belongs to the old tournament, so it resets to All team events.
watch(() => tournaments.activeId, async () => {
  categoryId.value = null
  await loadCategories()
  await load()
})

onMounted(async () => {
  await loadCategories()
  await load()
  await loadResultsSupport().catch((e) => {
    errorMessage.value = (e as Error).message
  })
})
</script>

<template>
  <v-container>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>

    <template v-if="matches.length">
      <div class="d-flex align-center ga-4 mt-4 flex-wrap">
        <v-select
          v-model="categoryId"
          :items="eventOptions"
          item-title="name"
          item-value="id"
          label="Team event"
          density="compact"
          hide-details
          style="max-width: 280px"
        />
        <v-btn-toggle v-model="filter" mandatory color="primary" density="comfortable">
          <v-btn v-for="f in FILTERS" :key="f.value" :value="f.value" size="small">
            {{ f.label }}
          </v-btn>
        </v-btn-toggle>
      </div>

      <v-card elevation="2" rounded="lg" class="mt-4">
        <v-card-text>
          <div v-if="filtered.length" data-testid="dashboard-cards">
            <CollapsibleMatchGroup
              v-if="slotRows.past.length"
              title="Past"
              data-testid="past-panel"
              :count="slotRows.pastCount"
              caption="earlier timeslots"
            >
              <SlotSection
                v-for="s in slotRows.past"
                :key="s.slotIdx"
                :label="s.label"
                :day="s.day"
              >
                <MatchCard
                  v-for="c in s.cards"
                  :key="c.tie.tieId"
                  :tie="c.tie"
                  @results="openResults(c.row)"
                  @click="selected = c.row"
                />
              </SlotSection>
            </CollapsibleMatchGroup>

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
                    v-for="c in s.cards"
                    :key="c.tie.tieId"
                    :tie="c.tie"
                    @results="openResults(c.row)"
                    @click="selected = c.row"
                  />
                </SlotSection>
              </template>
              <p v-else class="text-body-2">No team matches in the working window.</p>
              <v-btn
                v-if="!showAll && slotRows.windowed.length === 0 && slotRows.pastCount + slotRows.futureCount > 0"
                variant="tonal"
                class="mt-2"
                @click="showAll = true"
              >
                Show all matches
              </v-btn>
            </div>


            <CollapsibleMatchGroup
              v-if="slotRows.future.length"
              title="Future"
              data-testid="future-panel"
              :count="slotRows.futureCount"
              caption="beyond the working window"
            >
              <SlotSection
                v-for="s in slotRows.future"
                :key="s.slotIdx"
                :label="s.label"
                :day="s.day"
              >
                <MatchCard
                  v-for="c in s.cards"
                  :key="c.tie.tieId"
                  :tie="c.tie"
                  @results="openResults(c.row)"
                  @click="selected = c.row"
                />
              </SlotSection>
            </CollapsibleMatchGroup>
          </div>
          <p v-else class="text-body-2">No team matches for this filter.</p>
        </v-card-text>
      </v-card>
    </template>
    <v-card v-else-if="!errorMessage" elevation="2" rounded="lg" class="mt-4">
      <v-card-text class="text-body-2">No team matches yet.</v-card-text>
    </v-card>

    <v-dialog :model-value="selected != null" max-width="900" @update:model-value="selected = null">
      <v-card v-if="selected" rounded="lg">
        <v-card-item>
          <v-card-title>
            {{ selected.sides[0].teamName }} vs {{ selected.sides[1].teamName }}
          </v-card-title>
          <v-card-subtitle>{{ metadata(selected) }}</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="4">
              <v-text-field
                v-model="bestOfDraft"
                type="number"
                label="Best of (games per match)"
                density="compact"
                hint="Positive odd number — 5 is the default"
                persistent-hint
                style="max-width: 240px"
              />
              <v-btn
                class="mt-2"
                size="small"
                variant="tonal"
                color="primary"
                :loading="bestOfBusy"
                @click="saveBestOf"
              >
                Save best of
              </v-btn>
              <v-alert
                v-if="bestOfError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                {{ bestOfError }}
              </v-alert>
              <v-alert
                v-if="bestOfSaved"
                type="success"
                variant="tonal"
                density="compact"
                class="mt-2"
              >
                Best of saved.
              </v-alert>
            </v-col>
          </v-row>
          <v-row>
            <v-col v-for="s in selected.sides" :key="s.teamId ?? 'tbd'" cols="12" md="6">
              <v-card variant="outlined" rounded="lg">
                <v-card-item>
                  <v-card-title class="text-body-1">{{ s.teamName }}</v-card-title>
                </v-card-item>
                <v-card-text>
                  <div class="mb-3">
                    <MatchStatusChips :side="s" />
                  </div>

                  <div v-if="s.players">
                    <div v-for="(names, i) in s.players" :key="i" class="text-body-2 mb-1">
                      <span class="text-medium-emphasis">Match {{ i + 1 }}</span>
                      {{ names ? names.join(', ') : '—' }}
                    </div>
                  </div>
                  <p v-else class="text-body-2 text-medium-emphasis">No lineup saved.</p>
                  <p v-if="s.submittedAt" class="text-caption text-medium-emphasis mt-2">
                    Submitted {{ fmt(s.submittedAt) }}
                  </p>

                  <v-alert
                    v-if="s.status === 'missed-cutoff'"
                    type="error"
                    variant="tonal"
                    density="compact"
                    class="mt-3"
                  >
                    The lineup is missing and the cutoff has passed. Chase {{ s.teamName }}'s
                    manager, or fill the lineup on the team's behalf.
                  </v-alert>

                  <v-btn
                    block
                    class="mt-3"
                    :color="s.status === 'missed-cutoff' ? 'error' : 'primary'"
                    :to="{ name: 'lineup-builder', params: { tieId: selected.tieId }, query: { team: s.teamId } }"
                  >
                    {{ s.status === 'missed-cutoff' ? 'Fill lineup on behalf' : 'Edit on behalf' }}
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="selected = null">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <ResultsEntryDialog
      v-model="resultsOpen"
      variant="admin"
      :tie-id="resultsTie?.tieId ?? ''"
      :event-name="resultsTie?.categoryName"
      :team-a-name="resultsTie?.sides[0].teamName ?? ''"
      :team-b-name="resultsTie?.sides[1].teamName ?? ''"
      :best-of="resultsTie ? resultContexts.get(resultsTie.tieId)?.bestOf ?? 5 : 5"
      :rubber-count="resultsTie ? resultContexts.get(resultsTie.tieId)?.rubberCount ?? 0 : 0"
      :context="resultsTie ? resultContexts.get(resultsTie.tieId) ?? null : null"
      :players="resultsPlayers"
      @saved="onResultsSaved"
    />
  </v-container>
</template>

<style scoped>
.match-row {
  cursor: pointer;
}
.missed-cutoff-row {
  background-color: rgb(var(--v-theme-error), 0.08);
}
</style>
