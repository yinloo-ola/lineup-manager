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
  matchMatchesEvent,
  matchMatchesFilter,
  matchMissesCutoff,
  type MatchFilter,
  type MatchRow
} from '@/domain/matchesDashboard'
import MatchStatusChips from '@/components/MatchStatusChips.vue'

const tournaments = useTournamentStore()
const matches = ref<MatchRow[]>([])
const errorMessage = ref<string | null>(null)
const filter = ref<MatchFilter>('all')
const selected = ref<MatchRow | null>(null)

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

const filtered = computed(() =>
  matches.value.filter((m) => matchMatchesEvent(m, categoryId.value) && matchMatchesFilter(m, filter.value))
)

function fmt(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString()
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
  errorMessage.value = null
  if (!tournaments.activeId) return
  try {
    matches.value = await fetchMatches(supabase, tournaments.activeId)
  } catch (e) {
    errorMessage.value = (e as Error).message
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
          <v-table v-if="filtered.length" density="comfortable">
            <thead>
              <tr>
                <th>Scheduled</th>
                <!-- Only when events are mixed — scoped to one event the column
                     would repeat that event's name on every row. -->
                <th v-if="categoryId === null">Team event</th>
                <th>Table</th>
                <th>Group · Round</th>
                <th colspan="2">Teams</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in filtered"
                :key="m.tieId"
                :class="{ 'missed-cutoff-row': matchMissesCutoff(m) }"
                class="match-row"
                @click="selected = m"
              >
                <td>
                  {{ fmt(m.scheduledStart) }}
                  <v-chip v-if="m.locked" size="small" variant="outlined" class="ml-2">Locked</v-chip>
                </td>
                <td v-if="categoryId === null">{{ m.categoryName }}</td>
                <td>{{ m.table ?? '—' }}</td>
                <td>{{ groupRoundParts(m).join(' · ') || '—' }}</td>
                <td v-for="s in m.sides" :key="s.teamId ?? 'tbd'">
                  <div class="d-flex flex-wrap align-center ga-2">
                    <span>{{ s.teamName }}</span>
                    <MatchStatusChips :side="s" />
                  </div>
                </td>
                <td>
                  <v-btn
                    v-if="m.isKnockout"
                    size="x-small"
                    variant="text"
                    @click.stop
                    :to="{ name: 'bracket', params: { categoryId: m.categoryId } }"
                  >Bracket</v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
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
