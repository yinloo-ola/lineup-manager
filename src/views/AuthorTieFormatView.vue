<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useTournamentStore } from '@/stores/tournament'
import TournamentSelector from '@/components/TournamentSelector.vue'
import { parseTieFormat } from '@/domain/tieFormat'
import { loadTieFormat, saveTieFormat } from '@/services/tieFormatService'
import type { Constraint, PairRule, Rubber, RubberFormat, TieFormat, UsagePolicy } from '@/domain/types'

interface Category {
  id: string
  name: string
}
interface EditRubber {
  format: RubberFormat
  male: boolean
  female: boolean
  ageMin: string
  ageMax: string
  pairRule: PairRule
}

const categories = ref<Category[]>([])
const selectedCategory = ref<string | null>(null)
const leadTime = ref(30)
const usageKind = ref<UsagePolicy['kind']>('at-most-once')
const maxRubbers = ref('')
const maxSingles = ref('')
const maxDoubles = ref('')
const rubbers = ref<EditRubber[]>([])
const saving = ref(false)
const loadingFmt = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

const tournaments = useTournamentStore()

async function loadCategories(): Promise<void> {
  if (!tournaments.activeId) {
    categories.value = []
    return
  }
  const { data } = await supabase
    .from('categories')
    .select('id, name')
    .eq('tournament_id', tournaments.activeId)
    .order('name')
  categories.value = (data as Category[] | null) ?? []
}

// Reset the editor when the administrator switches tournament.
watch(() => tournaments.activeId, () => {
  selectedCategory.value = null
  rubbers.value = []
})

onMounted(loadCategories)

function newRubber(): EditRubber {
  return { format: 'singles', male: false, female: false, ageMin: '', ageMax: '', pairRule: 'any' }
}

function moveRubber(i: number, dir: -1 | 1): void {
  const j = i + dir
  const arr = rubbers.value
  if (j < 0 || j >= arr.length) return
  const [item] = arr.splice(i, 1)
  arr.splice(j, 0, item)
}

async function onCategoryChange(id: string | null) {
  // The v-select is one-way (:model-value + @update:model-value), so the
  // handler must commit the selection — otherwise the field stays blank and the
  // v-if="selectedCategory" editor never renders.
  selectedCategory.value = id
  result.value = null
  rubbers.value = []
  leadTime.value = 30
  usageKind.value = 'at-most-once'
  if (!id) return
  loadingFmt.value = true
  try {
    const fmt = await loadTieFormat(supabase, tournaments.activeId!, id)
    if (fmt) {
      leadTime.value = fmt.leadTimeMinutes ?? 30
      const up = fmt.usagePolicy
      usageKind.value = up?.kind ?? 'at-most-once'
      if (up?.kind === 'max-rubbers') maxRubbers.value = String(up.max)
      if (up?.kind === 'singles-plus-doubles') {
        maxSingles.value = String(up.maxSingles)
        maxDoubles.value = String(up.maxDoubles)
      }
      rubbers.value = fmt.rubbers.map((r) => ({
        format: r.format,
        male: r.constraint.allowedGenders?.includes('M') ?? false,
        female: r.constraint.allowedGenders?.includes('F') ?? false,
        ageMin: r.constraint.ageMin !== undefined ? String(r.constraint.ageMin) : '',
        ageMax: r.constraint.ageMax !== undefined ? String(r.constraint.ageMax) : '',
        pairRule: r.pairRule ?? 'any'
      }))
    }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    loadingFmt.value = false
  }
}

function build(): TieFormat {
  const builtRubbers: Rubber[] = rubbers.value.map((e) => {
    const allowedGenders = [...(e.male ? ['M'] : []), ...(e.female ? ['F'] : [])]
    const constraint: Constraint = {}
    if (allowedGenders.length) constraint.allowedGenders = allowedGenders
    if (e.ageMin !== '') constraint.ageMin = Number(e.ageMin)
    if (e.ageMax !== '') constraint.ageMax = Number(e.ageMax)
    const r: Rubber = { format: e.format, constraint }
    if (e.format === 'doubles') r.pairRule = e.pairRule
    return r
  })
  let usagePolicy: UsagePolicy | undefined
  if (usageKind.value === 'max-rubbers') {
    usagePolicy = { kind: 'max-rubbers', max: Number(maxRubbers.value) }
  } else if (usageKind.value === 'singles-plus-doubles') {
    usagePolicy = {
      kind: 'singles-plus-doubles',
      maxSingles: Number(maxSingles.value),
      maxDoubles: Number(maxDoubles.value)
    }
  }
  return { rubbers: builtRubbers, usagePolicy, leadTimeMinutes: leadTime.value }
}

async function onSave() {
  result.value = null
  if (!selectedCategory.value) return
  let fmt: TieFormat
  try {
    fmt = parseTieFormat(build()) // validate the editor output before saving
  } catch (e) {
    result.value = { ok: false, message: `Invalid: ${(e as Error).message}` }
    return
  }
  saving.value = true
  try {
    await saveTieFormat(supabase, tournaments.activeId!, selectedCategory.value, fmt)
    result.value = { ok: true, message: `Saved ${fmt.rubbers.length} rubber(s), lead time ${fmt.leadTimeMinutes} min.` }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>Author Tie Format</v-app-bar-title>
      <TournamentSelector class="mr-2" />
      <template #append>
        <v-btn variant="text" to="/">Home</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <v-card elevation="2" rounded="lg">
          <v-card-text>
            <v-select
              :model-value="selectedCategory"
              :items="categories"
              item-title="name"
              item-value="id"
              label="Team category"
              @update:model-value="onCategoryChange($event as string | null)"
            />

            <template v-if="selectedCategory">
              <div class="d-flex align-center ga-4 mt-2">
                <v-text-field
                  v-model.number="leadTime"
                  type="number"
                  label="Cutoff lead time (min)"
                  density="compact"
                  style="max-width: 200px"
                />
                <v-select
                  v-model="usageKind"
                  :items="['at-most-once', 'max-rubbers', 'singles-plus-doubles']"
                  label="Within-tie usage"
                  density="compact"
                  style="max-width: 260px"
                />
                <v-text-field
                  v-if="usageKind === 'max-rubbers'"
                  v-model="maxRubbers"
                  type="number"
                  label="max rubbers"
                  density="compact"
                  style="max-width: 140px"
                />
                <template v-if="usageKind === 'singles-plus-doubles'">
                  <v-text-field v-model="maxSingles" type="number" label="max singles" density="compact" style="max-width: 140px" />
                  <v-text-field v-model="maxDoubles" type="number" label="max doubles" density="compact" style="max-width: 140px" />
                </template>
              </div>

              <div class="d-flex align-center mt-6 mb-2">
                <span class="text-h6">Rubbers</span>
                <v-spacer />
                <v-btn variant="tonal" size="small" prepend-icon="mdi-plus" @click="rubbers.push(newRubber())">
                  Add rubber
                </v-btn>
              </div>

              <div v-if="loadingFmt" class="text-body-2">Loading…</div>

              <v-card
                v-for="(r, i) in rubbers"
                :key="i"
                variant="outlined"
                class="mb-3 pa-3"
              >
                <div class="d-flex align-center ga-3">
                  <v-select
                    v-model="r.format"
                    :items="['singles', 'doubles']"
                    label="Format"
                    density="compact"
                    style="max-width: 160px"
                  />
                  <v-checkbox v-model="r.male" label="Men" density="compact" hide-details />
                  <v-checkbox v-model="r.female" label="Women" density="compact" hide-details />
                  <v-text-field v-model="r.ageMin" type="number" label="ageMin" density="compact" style="max-width: 110px" />
                  <v-text-field v-model="r.ageMax" type="number" label="ageMax" density="compact" style="max-width: 110px" />
                  <v-select
                    v-if="r.format === 'doubles'"
                    v-model="r.pairRule"
                    :items="['any', 'same-gender', 'mixed']"
                    label="Pair rule"
                    density="compact"
                    style="max-width: 180px"
                  />
                  <v-spacer />
                  <v-btn icon="mdi-arrow-up" variant="text" size="small" :disabled="i === 0" @click="moveRubber(i, -1)" />
                  <v-btn icon="mdi-arrow-down" variant="text" size="small" :disabled="i === rubbers.length - 1" @click="moveRubber(i, 1)" />
                  <v-btn icon="mdi-delete" variant="text" size="small" @click="rubbers.splice(i, 1)" />
                </div>
              </v-card>

              <div class="mt-2">
                <v-btn color="primary" :loading="saving" @click="onSave">Save Tie Format</v-btn>
              </div>
              <v-alert v-if="result" :type="result.ok ? 'success' : 'error'" variant="tonal" class="mt-4">
                {{ result.message }}
              </v-alert>
            </template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
