<script setup lang="ts">
// The bracket view (ko-import spec §7, prototype variant C — the grouped
// table): one category's knockout bracket with round headers, slot rows, the
// imported-pool banner, the advance-byes action, and the cascade confirmation.
// All decisions come from the pure domain module; this view only renders and
// calls the guard-checked service.
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'
import { supabase } from '@/lib/supabase'
import {
  advanceByes,
  cascadeClear,
  CascadeNeededError,
  clearTeam,
  enterTeam,
  fetchBracket,
  placeMatch,
  toggleWinner
} from '@/services/bracketService'
import { buildBracketView, type BracketRowVm, type BracketView as BracketVm } from '@/domain/bracketView'
import type { CascadePlan } from '@/domain/bracket'

const route = useRoute()
const router = useRouter()
const tournaments = useTournamentStore()

interface CategoryOption {
  id: string
  name: string
}
const categories = ref<CategoryOption[]>([])
const categoryId = ref<string | null>(null)
const view = ref<BracketVm | null>(null)
const teamNameById = ref<Map<string, string>>(new Map())
const busy = ref(false)
const errorMessage = ref<string | null>(null)
const cascade = ref<{ plan: CascadePlan; slotId: string } | null>(null)

const hasBracket = computed(() => (view.value?.pool.length ?? 0) > 0 || (view.value?.rounds.length ?? 0) > 0)

/** A human-readable label for a slot id, for the cascade confirmation list. */
function slotLabel(slotId: string): string {
  const row = view.value?.rounds.flatMap((r) => r.rows).find((r) => r.slotId === slotId)
  if (!row) return slotId
  const round = view.value?.rounds.find((r) => r.rows.some((x) => x.slotId === slotId))?.label ?? ''
  return `${round} · ${row.sideA.name} vs ${row.sideB.name}`
}

async function loadCategories(): Promise<void> {
  if (!tournaments.activeId) return
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
  const wanted = (route.params.categoryId as string | undefined) ?? null
  if (wanted && categories.value.some((c) => c.id === wanted)) {
    categoryId.value = wanted
  } else if (!categoryId.value || !categories.value.some((c) => c.id === categoryId.value)) {
    categoryId.value = categories.value[0]?.id ?? null
  }
}

async function load(): Promise<void> {
  if (!tournaments.activeId || !categoryId.value) {
    view.value = null
    return
  }
  errorMessage.value = null
  try {
    const loaded = await fetchBracket(supabase, tournaments.activeId, categoryId.value)
    view.value = buildBracketView(loaded.snapshot, loaded.teamNameById)
    teamNameById.value = loaded.teamNameById
  } catch (e) {
    errorMessage.value = (e as Error).message
  }
}

/** The slot whose action is in flight — the cascade confirmation targets it. */
const pendingSlotId = ref<string | null>(null)

/** Run a bracket action, then reload (every action invalidates the snapshot). */
async function act(fn: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  errorMessage.value = null
  try {
    await fn()
    await load()
  } catch (e) {
    if (e instanceof CascadeNeededError) {
      // Un-pick with downstream state — surface the blast radius for confirmation.
      cascade.value = { plan: e.plan, slotId: pendingSlotId.value ?? '' }
    } else {
      errorMessage.value = (e as Error).message
    }
  } finally {
    busy.value = false
    pendingSlotId.value = null
  }
}

function fmtTime(start: string): string {
  return new Date(start).toLocaleString()
}

function rowSchedule(row: BracketRowVm): string {
  return row.schedule ? `${row.schedule.table} · ${fmtTime(row.schedule.start)}` : row.bye ? 'BYE — no schedule' : '—'
}

async function onEnter(slotId: string, side: 0 | 1, teamId: string): Promise<void> {
  if (!categoryId.value) return
  await act(() => enterTeam(supabase, tournaments.activeId!, categoryId.value!, slotId, side, teamId))
}

async function onClear(slotId: string, side: 0 | 1): Promise<void> {
  if (!categoryId.value) return
  await act(() => clearTeam(supabase, tournaments.activeId!, categoryId.value!, slotId, side))
}

async function onPlace(slotId: string, poolMatchId: string): Promise<void> {
  if (!categoryId.value) return
  await act(() => placeMatch(supabase, tournaments.activeId!, categoryId.value!, slotId, poolMatchId))
}

async function onToggle(slotId: string, side: 0 | 1): Promise<void> {
  if (!categoryId.value) return
  pendingSlotId.value = slotId
  await act(() => toggleWinner(supabase, tournaments.activeId!, categoryId.value!, slotId, side))
  pendingSlotId.value = null
}

async function onConfirmCascade(): Promise<void> {
  const c = cascade.value
  cascade.value = null
  if (!c || !categoryId.value) return
  await act(async () => {
    await cascadeClear(supabase, tournaments.activeId!, categoryId.value!, c.slotId)
  })
}

async function onAdvanceByes(): Promise<void> {
  if (!categoryId.value) return
  await act(async () => {
    await advanceByes(supabase, tournaments.activeId!, categoryId.value!)
  })
}

watch(() => tournaments.activeId, async () => {
  await loadCategories()
  await load()
})
watch(categoryId, () => {
  if (route.params.categoryId !== categoryId.value) {
    router.replace({ name: 'bracket', params: { categoryId: categoryId.value ?? undefined } })
  }
  void load()
})
watch(() => route.params.categoryId, (id) => {
  const wanted = id as string | undefined
  if (wanted && wanted !== categoryId.value && categories.value.some((c) => c.id === wanted)) {
    categoryId.value = wanted
  }
})

onMounted(async () => {
  await loadCategories()
  await load()
})
</script>

<template>
  <v-container>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4" closable>
      {{ errorMessage }}
    </v-alert>

    <div class="d-flex align-center ga-4 mt-4 flex-wrap">
      <v-select
        v-model="categoryId"
        :items="categories"
        item-title="name"
        item-value="id"
        label="Team event"
        density="compact"
        hide-details
        style="max-width: 280px"
      />
      <v-btn
        v-if="view && view.balanced && view.byesToAdvance > 0"
        color="primary"
        size="small"
        :loading="busy"
        @click="onAdvanceByes"
      >
        Advance {{ view.byesToAdvance }} bye{{ view.byesToAdvance > 1 ? 's' : '' }} →
      </v-btn>
      <v-chip v-else-if="view && view.byesToAdvance > 0" size="small" variant="tonal">
        {{ view.byesToAdvance }} bye{{ view.byesToAdvance > 1 ? 's' : '' }} pending — advances when every
        imported team match is placed and every slot holds a team ({{ view.twoTeamSlots }}/{{ view.poolCount }})
      </v-chip>
    </div>

    <template v-if="view && hasBracket">
      <v-alert type="info" variant="tonal" density="compact" class="mt-4">
        <strong>Imported {{ view.entryRoundLabel }} team matches (with table + time):</strong>
        <v-chip
          v-for="p in view.pool"
          :key="p.id"
          size="small"
          class="ml-2"
          :color="p.placedOnSlotId ? 'success' : undefined"
          :variant="p.placedOnSlotId ? 'tonal' : 'elevated'"
        >
          {{ p.label }}{{ p.placedOnSlotId ? ' → placed' : '' }}
        </v-chip>
      </v-alert>

      <v-card elevation="2" rounded="lg" class="mt-4">
        <v-card-text>
          <template v-for="round in view.rounds" :key="round.label">
            <v-toolbar density="compact" color="grey-lighten-4">
              <v-toolbar-title class="text-subtitle-2">{{ round.label }}</v-toolbar-title>
            </v-toolbar>
            <v-table density="compact">
              <tbody>
                <tr v-for="row in round.rows" :key="row.slotId" :style="row.bye ? 'opacity:.7' : ''">
                  <td style="width: 170px">
                    <div class="d-flex align-center ga-1">
                      <template v-if="row.sideA.teamId">
                        <v-btn
                          size="small"
                          :variant="row.winnerSide === 'a' ? 'flat' : 'tonal'"
                          :color="row.winnerSide === 'a' ? 'primary' : 'default'"
                          :disabled="busy || (!row.canPickA && row.winnerSide !== 'a')"
                          :title="row.winnerSide === 'a' ? 'click again to un-pick' : ''"
                          @click="onToggle(row.slotId, 0)"
                        >{{ row.sideA.name }}</v-btn>
                        <v-btn
                          v-if="row.sideA.canClear"
                          icon="mdi-close"
                          size="x-small"
                          variant="text"
                          title="remove team"
                          :disabled="busy"
                          @click="onClear(row.slotId, 0)"
                        />
                      </template>
                      <v-select
                        v-else-if="row.sideA.canEnter"
                        variant="underlined"
                        density="compact"
                        hide-details
                        :items="view.enterableTeams"
                        item-title="name"
                        item-value="id"
                        placeholder="— enter team —"
                        @update:model-value="(teamId: string) => onEnter(row.slotId, 0, teamId)"
                      />
                      <span v-else class="text-disabled text-italic">TBD</span>
                    </div>
                  </td>
                  <td style="width: 40px" class="text-medium-emphasis text-caption">vs</td>
                  <td style="width: 170px">
                    <div class="d-flex align-center ga-1">
                      <template v-if="row.sideB.teamId">
                        <v-btn
                          size="small"
                          :variant="row.winnerSide === 'b' ? 'flat' : 'tonal'"
                          :color="row.winnerSide === 'b' ? 'primary' : 'default'"
                          :disabled="busy || (!row.canPickB && row.winnerSide !== 'b')"
                          :title="row.winnerSide === 'b' ? 'click again to un-pick' : ''"
                          @click="onToggle(row.slotId, 1)"
                        >{{ row.sideB.name }}</v-btn>
                        <v-btn
                          v-if="row.sideB.canClear"
                          icon="mdi-close"
                          size="x-small"
                          variant="text"
                          title="remove team"
                          :disabled="busy"
                          @click="onClear(row.slotId, 1)"
                        />
                      </template>
                      <v-select
                        v-else-if="row.sideB.canEnter"
                        variant="underlined"
                        density="compact"
                        hide-details
                        :items="view.enterableTeams"
                        item-title="name"
                        item-value="id"
                        placeholder="— enter team —"
                        @update:model-value="(teamId: string) => onEnter(row.slotId, 1, teamId)"
                      />
                      <span v-else class="text-disabled text-italic">TBD</span>
                    </div>
                  </td>
                  <td style="width: 230px">
                    <v-select
                      v-if="row.needsPlacement"
                      variant="underlined"
                      density="compact"
                      hide-details
                      single-line
                      :items="row.unplacedPool"
                      item-title="label"
                      item-value="id"
                      placeholder="assign imported match…"
                      @update:model-value="(poolId: string) => onPlace(row.slotId, poolId)"
                    />
                    <v-chip v-else-if="row.winnerName" size="small" color="primary" variant="tonal">
                      {{ row.winnerName }}
                    </v-chip>
                    <span v-else class="text-disabled">—</span>
                  </td>
                  <td class="text-caption text-medium-emphasis">{{ rowSchedule(row) }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </v-card-text>
      </v-card>
    </template>
    <v-card v-else-if="!errorMessage" elevation="2" rounded="lg" class="mt-4">
      <v-card-text class="text-body-2">
        No knockout bracket for this team event — it arrives when an imported tournament carries one.
      </v-card-text>
    </v-card>

    <v-dialog :model-value="cascade !== null" max-width="520">
      <v-card v-if="cascade">
        <v-card-title class="text-h6">Un-pick / change winner</v-card-title>
        <v-card-text>
          Correcting this result rewinds the bracket. This will clear:
          <v-list density="compact">
            <v-list-item v-for="id in cascade.plan.clearedWinners" :key="id" prepend-icon="mdi-trophy-outline">
              <v-list-item-title class="text-body-2">Winner cleared — {{ slotLabel(id) }}</v-list-item-title>
            </v-list-item>
            <v-list-item
              v-for="l in cascade.plan.removedLineups"
              :key="l.tieId + l.teamId"
              prepend-icon="mdi-clipboard-remove-outline"
            >
              <v-list-item-title class="text-body-2">
                Lineup removed — {{ teamNameById.get(l.teamId) ?? l.teamId }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
          <p class="text-caption text-medium-emphasis">
            Nothing is removed until you confirm. Lineups of teams still on a team match stand.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cascade = null">Cancel</v-btn>
          <v-btn color="error" @click="onConfirmCascade">Clear &amp; re-pick</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
