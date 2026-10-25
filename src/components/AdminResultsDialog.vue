<script setup lang="ts">
// The administrator's results dialog (results slice R6): everything editable —
// players per rubber per side, game scores, walkovers (with side) and the
// tie's best-of — regardless of who entered the data and at any time. Saves go
// through saveRubberResult, which re-checks the entry gate server-side.
import { reactive, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { setTieBestOf, saveRubberResult, type TieResultContext } from '@/services/resultsService'
import { validateGames, type GameScore, type Side } from '@/domain/results'
import type { Violation } from '@/domain/types'

interface PlayerOption {
  id: string
  name: string
}

const props = defineProps<{
  modelValue: boolean
  tieId: string
  teamAName: string
  teamBName: string
  context: TieResultContext | null
  rosterA: PlayerOption[]
  rosterB: PlayerOption[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

interface EditPlayer {
  id: string | null
}
interface EditRubber {
  playersA: EditPlayer[]
  playersB: EditPlayer[]
  games: { a: string; b: string }[]
  walkover: boolean
  walkoverSide: Side | null
}

const rubbers = reactive<EditRubber[]>([])
const bestOfDraft = ref('')
const violationsByRubber = reactive<Record<number, string[]>>({})
const bestOfError = ref<string | null>(null)
const serverError = ref<string | null>(null)
const saved = ref(false)
const saving = ref(false)

watch(
  () => [props.modelValue, props.tieId, props.context] as const,
  () => {
    if (!props.modelValue || !props.context) return
    serverError.value = null
    bestOfError.value = null
    saved.value = false
    for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
    const ctx = props.context
    bestOfDraft.value = String(ctx.bestOf)
    rubbers.splice(0, rubbers.length)
    for (let i = 0; i < ctx.rubberCount; i += 1) {
      const stored = ctx.stored[i]
      const prefillA = ctx.prefill[0][i]
      const prefillB = ctx.prefill[1][i]
      const hasStored = stored != null && (stored.games.length > 0 || stored.walkover)
      const slotsA = (hasStored ? asIdArray(stored.playerIds[0]) : prefillA) ?? []
      const slotsB = (hasStored ? asIdArray(stored.playerIds[1]) : prefillB) ?? []
      rubbers.push({
        playersA: slotsA.map((id) => ({ id })),
        playersB: slotsB.map((id) => ({ id })),
        games: hasStored
          ? stored.games.map((g) => ({ a: String(g.a), b: String(g.b) }))
          : [{ a: '', b: '' }],
        walkover: stored?.walkover ?? false,
        walkoverSide: stored?.walkoverSide ?? null
      })
    }
  },
  { immediate: true }
)

/** The stored player_ids side value is an array of ids (or jsonb null). */
function asIdArray(side: unknown): (string | null)[] | null {
  if (!Array.isArray(side)) return null
  return side.map((id) => (typeof id === 'string' ? id : null))
}

function addGame(rubber: number): void {
  rubbers[rubber].games.push({ a: '', b: '' })
}

function rosterFor(side: 0 | 1): PlayerOption[] {
  return side === 0 ? props.rosterA : props.rosterB
}

async function onSave(): Promise<void> {
  serverError.value = null
  bestOfError.value = null
  saved.value = false
  for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
  const ctx = props.context
  if (!ctx) return

  // Best-of first: a change saves through the same odd-only path as R1.
  const bestOf = Number(bestOfDraft.value)
  let bestOfChanged = bestOf !== ctx.bestOf

  let touched = 0
  for (let i = 0; i < rubbers.length; i += 1) {
    const r = rubbers[i]
    const games: GameScore[] = r.games
      .filter((g) => g.a !== '' || g.b !== '')
      .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
    const partial = r.games.some((g) => (g.a === '') !== (g.b === ''))
    const violations: Violation[] =
      r.walkover || games.length > 0
        ? validateGames(games, bestOf, r.walkover, r.walkoverSide ?? undefined)
        : []
    if (partial && !r.walkover) {
      violations.push({ kind: 'bad-score', message: 'Both sides of a game need scores.' })
    }
    if (violations.length > 0) violationsByRubber[i] = violations.map((v) => v.message)
    if (r.walkover || games.length > 0) touched += 1
  }
  if (Object.keys(violationsByRubber).length > 0) return

  saving.value = true
  try {
    if (bestOfChanged) {
      try {
        await setTieBestOf(supabase, props.tieId, bestOfDraft.value)
      } catch (e) {
        bestOfError.value = (e as Error).message
        return
      }
      bestOfChanged = false
    }
    for (let i = 0; i < rubbers.length; i += 1) {
      const r = rubbers[i]
      const games = r.games
        .filter((g) => g.a !== '' && g.b !== '')
        .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
      if (!r.walkover && games.length === 0) continue
      try {
        await saveRubberResult(supabase, {
          tieId: props.tieId,
          rubberIndex: i + 1,
          playerIds: [
            r.playersA.map((p) => p.id),
            r.playersB.map((p) => p.id)
          ],
          games: r.walkover ? [] : games,
          walkover: r.walkover,
          walkoverSide: r.walkover ? r.walkoverSide : null
        })
      } catch (e) {
        serverError.value = (e as Error).message
        return
      }
    }
    saved.value = true
    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="860"
    @update:model-value="emit('update:modelValue', $event as boolean)"
  >
    <v-card rounded="lg">
      <v-card-item>
        <v-card-title>Results — {{ teamAName }} vs {{ teamBName }}</v-card-title>
        <v-card-subtitle>Players, scores and walkovers — edits recompute the winner</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-alert v-if="serverError" type="error" variant="tonal" density="compact" class="mb-3">
          {{ serverError }}
        </v-alert>

        <div class="d-flex align-center ga-3 mb-3">
          <v-text-field
            v-model="bestOfDraft"
            type="number"
            label="Best of (games per match)"
            density="compact"
            style="max-width: 200px"
          />
        </div>
        <v-alert v-if="bestOfError" type="error" variant="tonal" density="compact" class="mb-3">
          {{ bestOfError }}
        </v-alert>

        <v-card v-for="(r, i) in rubbers" :key="i" variant="outlined" class="mb-3 pa-3">
          <div class="text-subtitle-1 mb-2">Match {{ i + 1 }}</div>

          <template v-if="!r.walkover">
            <div v-for="(g, gi) in r.games" :key="gi" class="d-flex align-center ga-3 mb-1">
              <span class="text-body-2" style="min-width: 70px">Game {{ gi + 1 }}</span>
              <v-text-field
                v-model="g.a"
                type="number"
                :label="`Rubber ${i + 1} game ${gi + 1} side A`"
                density="compact"
                hide-details
                style="max-width: 110px"
              />
              <span class="text-body-2">–</span>
              <v-text-field
                v-model="g.b"
                type="number"
                :label="`Rubber ${i + 1} game ${gi + 1} side B`"
                density="compact"
                hide-details
                style="max-width: 110px"
              />
            </div>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-plus"
              :aria-label="`Rubber ${i + 1} add game`"
              @click="addGame(i)"
            >
              Add game
            </v-btn>
          </template>

          <div class="d-flex flex-wrap align-center ga-3 mt-1">
            <v-select
              v-for="(p, pi) in r.playersA"
              :key="`a${pi}`"
              v-model="p.id"
              :items="rosterFor(0)"
              item-title="name"
              item-value="id"
              :label="
                r.playersA.length > 1
                  ? `Rubber ${i + 1} side A player ${pi + 1}`
                  : `Rubber ${i + 1} side A player`
              "
              density="compact"
              hide-details
              style="max-width: 220px"
            />
            <v-select
              v-for="(p, pi) in r.playersB"
              :key="`b${pi}`"
              v-model="p.id"
              :items="rosterFor(1)"
              item-title="name"
              item-value="id"
              :label="
                r.playersB.length > 1
                  ? `Rubber ${i + 1} side B player ${pi + 1}`
                  : `Rubber ${i + 1} side B player`
              "
              density="compact"
              hide-details
              style="max-width: 220px"
            />
          </div>

          <div class="d-flex align-center ga-4 mt-2">
            <v-checkbox
              v-model="r.walkover"
              :label="`Rubber ${i + 1} walkover`"
              density="compact"
              hide-details
            />
            <v-radio-group
              v-if="r.walkover"
              v-model="r.walkoverSide"
              inline
              hide-details
              density="compact"
            >
              <v-radio :value="'a'" :label="`Rubber ${i + 1} walkover side A`" />
              <v-radio :value="'b'" :label="`Rubber ${i + 1} walkover side B`" />
            </v-radio-group>
          </div>

          <v-alert
            v-if="(violationsByRubber[i] ?? []).length"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            <div v-for="(m, mi) in violationsByRubber[i]" :key="mi">{{ m }}</div>
          </v-alert>
        </v-card>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :disabled="saving" :loading="saving" @click="onSave">
          Save results
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
