<script setup lang="ts">
// Team match format authoring (spec §7) plus the two format rules of spec §6
// (ticket #16): the FREEZE — once the tournament has started (anchored on its
// start date) the page is disabled with its reason — and the GUARDED pre-start
// edit — a save that would break submitted lineups first shows an impact
// preview and requires explicit confirmation. No silent invalidation: a
// confirmed break surfaces downstream as Needs attention.
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useTournamentStore } from '@/stores/tournament'
import { isFormatFrozen, type FormatBreak } from '@/domain/formatFreeze'
import { parseTieFormat } from '@/domain/tieFormat'
import { loadTieFormat, previewFormatImpact, saveTieFormat } from '@/services/tieFormatService'
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
const previewing = ref(false)
const loadingFmt = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

const tournaments = useTournamentStore()

// The freeze (spec §6): anchored on the tournament's start date — a tournament
// without one has not started, so its formats stay editable.
const frozen = computed(() => isFormatFrozen(tournaments.active?.startDate ?? null))

const USAGE_ITEMS: { title: string; value: UsagePolicy['kind'] }[] = [
  { title: 'At most once', value: 'at-most-once' },
  { title: 'Max matches', value: 'max-rubbers' },
  { title: 'Singles + doubles caps', value: 'singles-plus-doubles' }
]

// --- the guarded save's confirm dialog ---
const confirming = ref(false)
const pendingFmt = ref<TieFormat | null>(null)
const breaks = ref<FormatBreak[]>([])

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
  // Categories only load within an active tournament (loadCategories), so a
  // selection implies one — but narrow it locally rather than asserting.
  const tournamentId = tournaments.activeId
  if (!id || !tournamentId) return
  loadingFmt.value = true
  try {
    const fmt = await loadTieFormat(supabase, tournamentId, id)
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
  const tournamentId = tournaments.activeId
  if (!selectedCategory.value || !tournamentId || frozen.value) return
  let fmt: TieFormat
  try {
    fmt = parseTieFormat(build()) // validate the editor output before saving
  } catch (e) {
    result.value = { ok: false, message: `Invalid: ${(e as Error).message}` }
    return
  }
  // The guard (spec §6): preview the impact before saving. A breaking save
  // needs explicit confirmation; cancel leaves everything untouched.
  previewing.value = true
  try {
    const impact = await previewFormatImpact(supabase, tournamentId, selectedCategory.value, fmt)
    if (impact.length > 0) {
      pendingFmt.value = fmt
      breaks.value = impact
      confirming.value = true
      return
    }
    await doSave(fmt)
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    previewing.value = false
  }
}

async function onConfirm(): Promise<void> {
  const fmt = pendingFmt.value
  confirming.value = false
  if (!fmt) return
  pendingFmt.value = null
  breaks.value = []
  await doSave(fmt)
}

function onCancelConfirm(): void {
  confirming.value = false
  pendingFmt.value = null
  breaks.value = []
}

async function doSave(fmt: TieFormat): Promise<void> {
  const tournamentId = tournaments.activeId
  const category = selectedCategory.value
  if (!tournamentId || !category) return
  saving.value = true
  try {
    await saveTieFormat(supabase, tournamentId, category, fmt)
    result.value = { ok: true, message: `Saved ${fmt.rubbers.length} match(es), cutoff lead time ${fmt.leadTimeMinutes} min.` }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    saving.value = false
  }
}

function formatScheduledStart(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString()
}
</script>

<template>
  <v-container>
    <v-row class="mt-4">
      <v-col>
        <v-card elevation="2" rounded="lg">
          <v-card-text>
            <v-alert v-if="frozen" type="warning" variant="tonal" class="mb-4">
              This tournament has started — Team Match Formats are frozen and can no longer be
              amended. The freeze anchors on the tournament's start date.
            </v-alert>

            <v-select
              :model-value="selectedCategory"
              :items="categories"
              item-title="name"
              item-value="id"
              label="Team event"
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
                  :disabled="frozen"
                />
                <v-select
                  v-model="usageKind"
                  :items="USAGE_ITEMS"
                  item-title="title"
                  item-value="value"
                  label="Player usage per team match"
                  density="compact"
                  style="max-width: 260px"
                  :disabled="frozen"
                />
                <v-text-field
                  v-if="usageKind === 'max-rubbers'"
                  v-model="maxRubbers"
                  type="number"
                  label="max matches"
                  density="compact"
                  style="max-width: 140px"
                  :disabled="frozen"
                />
                <template v-if="usageKind === 'singles-plus-doubles'">
                  <v-text-field v-model="maxSingles" type="number" label="max singles" density="compact" style="max-width: 140px" :disabled="frozen" />
                  <v-text-field v-model="maxDoubles" type="number" label="max doubles" density="compact" style="max-width: 140px" :disabled="frozen" />
                </template>
              </div>

              <div class="d-flex align-center mt-6 mb-2">
                <span class="text-h6">Matches</span>
                <v-spacer />
                <v-btn variant="tonal" size="small" prepend-icon="mdi-plus" :disabled="frozen" @click="rubbers.push(newRubber())">
                  Add match
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
                    :disabled="frozen"
                  />
                  <v-checkbox v-model="r.male" label="Men" density="compact" hide-details :disabled="frozen" />
                  <v-checkbox v-model="r.female" label="Women" density="compact" hide-details :disabled="frozen" />
                  <v-text-field v-model="r.ageMin" type="number" label="Min age" density="compact" style="max-width: 110px" :disabled="frozen" />
                  <v-text-field v-model="r.ageMax" type="number" label="Max age" density="compact" style="max-width: 110px" :disabled="frozen" />
                  <v-select
                    v-if="r.format === 'doubles'"
                    v-model="r.pairRule"
                    :items="['any', 'same-gender', 'mixed']"
                    label="Pair rule"
                    density="compact"
                    style="max-width: 180px"
                    :disabled="frozen"
                  />
                  <v-spacer />
                  <v-btn icon="mdi-arrow-up" variant="text" size="small" :disabled="i === 0 || frozen" @click="moveRubber(i, -1)" />
                  <v-btn icon="mdi-arrow-down" variant="text" size="small" :disabled="i === rubbers.length - 1 || frozen" @click="moveRubber(i, 1)" />
                  <v-btn icon="mdi-delete" variant="text" size="small" :disabled="frozen" @click="rubbers.splice(i, 1)" />
                </div>
              </v-card>

              <div class="mt-2">
                <v-btn color="primary" :loading="saving || previewing" :disabled="frozen" @click="onSave">
                  Save Team Match Format
                </v-btn>
              </div>
              <v-alert v-if="result" :type="result.ok ? 'success' : 'error'" variant="tonal" class="mt-4">
                {{ result.message }}
              </v-alert>
            </template>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Guarded-save confirm: impact preview + explicit confirmation -->
    <v-dialog :model-value="confirming" max-width="560" persistent>
      <v-card rounded="lg">
        <v-card-item>
          <v-card-title class="text-warning">
            <v-icon class="mr-1">mdi-alert</v-icon> This change breaks submitted lineups
          </v-card-title>
        </v-card-item>
        <v-card-text>
          <p class="mb-3">
            {{ breaks.length }} submitted lineup(s) no longer satisfy the proposed format:
          </p>
          <v-list density="compact" class="bg-grey-lighten-4 rounded">
            <v-list-item v-for="(b, i) in breaks" :key="i">
              <v-icon class="mr-2">mdi-sword-cross</v-icon>
              {{ b.teamName }} vs {{ b.opponentName }} — {{ formatScheduledStart(b.scheduledStart) }}
            </v-list-item>
          </v-list>
          <p class="text-caption text-medium-emphasis mt-2">
            Each affected lineup will read <strong>Not submitted</strong> with the
            <strong>Needs attention</strong> marker on the Matches dashboard until its manager
            corrects and re-submits it.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="onCancelConfirm">Cancel</v-btn>
          <v-btn color="warning" :loading="saving" @click="onConfirm">Save anyway</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
