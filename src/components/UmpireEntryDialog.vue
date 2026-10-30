<script setup lang="ts">
// The umpire's per-tie entry form (results slice R5): one section per rubber
// in the tie's format. Players display read-only from the submitted lineups —
// the SERVER derives the stored player identity from those same lineups, so
// what the umpire sees is exactly what gets stored. Game entry validates
// against the tie's best-of (overflow beyond the majority is an entry error);
// walkovers carry no games and need their winning side. Saves go through the
// upsert_umpire_result RPC — the gate is enforced server-side.
import { computed, reactive, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { upsertUmpireResult } from '@/services/resultsService'
import {
  validateGames,
  type GameScore,
  type Side
} from '@/domain/results'
import type { Violation } from '@/domain/types'

export interface EntryGame {
  a: string
  b: string
}

interface StoredRubber {
  games: GameScore[]
  walkover: boolean
  walkoverSide: Side | null
}

const props = defineProps<{
  modelValue: boolean
  tieId: string
  /** The team event's display name, shown with the match for context. */
  eventName?: string
  teamAName: string
  teamBName: string
  bestOf: number
  rubberCount: number
  /** Display names per side per rubber (from the submitted lineups). */
  players: [string[], string[]][]
  stored: StoredRubber[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const rubbers = reactive<
  { games: EntryGame[]; walkover: boolean; walkoverSide: Side | null }[]
>([])
const violationsByRubber = reactive<Record<number, string[]>>({})
const serverError = ref<string | null>(null)
const saving = ref(false)

watch(
  () => [props.modelValue, props.tieId],
  () => {
    if (!props.modelValue) return
    serverError.value = null
    violationsByRubberClear()
    rubbers.splice(0, rubbers.length)
    for (let i = 0; i < props.rubberCount; i += 1) {
      const stored = props.stored[i]
      const hasStored = stored != null && (stored.games.length > 0 || stored.walkover)
      rubbers.push({
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

function violationsByRubberClear(): void {
  for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
}

function addGame(rubber: number): void {
  rubbers[rubber].games.push({ a: '', b: '' })
}

function playersLabel(rubber: number): string {
  const [a, b] = props.players[rubber] ?? [[], []]
  const fmt = (names: string[]) => (names.length ? names.join(', ') : '—')
  return `${fmt(a)} vs ${fmt(b)}`
}

/** Violations for one rubber, rendered inline. */
function violationsFor(rubber: number): string[] {
  return violationsByRubber[rubber] ?? []
}

async function onSave(): Promise<void> {
  serverError.value = null
  violationsByRubberClear()

  // Validate every touched rubber first — a save with any violation writes
  // nothing.
  let touched = 0
  for (let i = 0; i < rubbers.length; i += 1) {
    const r = rubbers[i]
    const games: GameScore[] = r.games
      .filter((g) => g.a !== '' || g.b !== '')
      .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
    const partial = r.games.some((g) => (g.a === '') !== (g.b === ''))
    const violations: Violation[] =
      r.walkover || games.length > 0
        ? validateGames(games, props.bestOf, r.walkover, r.walkoverSide ?? undefined)
        : []
    if (partial && !r.walkover) {
      violations.push({
        kind: 'bad-score',
        message: 'Both sides of a game need scores.'
      })
    }
    if (violations.length > 0) violationsByRubber[i] = violations.map((v) => v.message)
    if (r.walkover || games.length > 0) touched += 1
  }
  if (Object.keys(violationsByRubber).length > 0) return
  if (touched === 0) {
    emit('update:modelValue', false)
    return
  }

  saving.value = true
  try {
    for (let i = 0; i < rubbers.length; i += 1) {
      const r = rubbers[i]
      const games = r.games
        .filter((g) => g.a !== '' && g.b !== '')
        .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
      if (!r.walkover && games.length === 0) continue
      try {
        await upsertUmpireResult(supabase, {
          tieId: props.tieId,
          rubberIndex: i + 1,
          games,
          walkover: r.walkover,
          walkoverSide: r.walkover ? r.walkoverSide : null
        })
      } catch (e) {
        serverError.value = (e as Error).message
        return
      }
    }
    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

const canSave = computed(() => !saving.value)
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    @update:model-value="emit('update:modelValue', $event as boolean)"
  >
    <v-card rounded="lg">
      <v-card-item>
        <v-card-title>{{ teamAName }} vs {{ teamBName }}</v-card-title>
        <v-card-subtitle>
          <template v-if="eventName">{{ eventName }} · </template>Best of {{ bestOf }} games per
          match
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-alert v-if="serverError" type="error" variant="tonal" density="compact" class="mb-3">
          {{ serverError }}
        </v-alert>

        <v-card v-for="(r, i) in rubbers" :key="i" variant="outlined" class="mb-3 pa-3">
          <div class="d-flex align-center ga-3 mb-2">
            <span class="text-subtitle-1">Match {{ i + 1 }}</span>
            <span class="text-body-2 text-medium-emphasis">{{ playersLabel(i) }}</span>
          </div>

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

          <div class="d-flex align-center ga-4 mt-1">
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
            v-if="violationsFor(i).length"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-2"
          >
            <div v-for="(m, mi) in violationsFor(i)" :key="mi">{{ m }}</div>
          </v-alert>
        </v-card>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn color="primary" :disabled="!canSave" :loading="saving" @click="onSave">
          Save results
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
