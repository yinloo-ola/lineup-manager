<script setup lang="ts">
// The shared results-entry dialog (venue-ux follow-up, owner redesign):
// one component for umpire and admin variants. Designed for the umpire on
// duty: score columns carry the PLAYERS' names (no anonymous sides), the
// walkover winner is picked by team name (no "side A/B"), and a live derived
// tally shows the team-match outcome while typing. Accessible names keep the
// "Match N …" prefixes for AT and the E2E even where the visible label is
// hidden.
import { computed, reactive, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import {
  upsertUmpireResult,
  saveRubberResult,
  setTieBestOf,
  type TieResultContext
} from '@/services/resultsService'
import { deriveTieResult, validateGames, type GameScore, type Side } from '@/domain/results'
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

interface EditRubber {
  games: EntryGame[]
  walkover: boolean
  walkoverSide: Side | null
}

const props = defineProps<{
  modelValue: boolean
  variant: 'umpire' | 'admin'
  tieId: string
  eventName?: string
  teamAName: string
  teamBName: string
  bestOf: number
  rubberCount: number
  /** Side display names per rubber — always derived from the submitted
   *  lineups, the single source of truth for who played. */
  players?: [string[], string[]][]
  /** Stored rows to preload (umpire variant). */
  stored?: StoredRubber[]
  /** Admin: everything the dialog needs, from loadTieResultContexts. */
  context?: TieResultContext | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
}>()

const rubbers = reactive<EditRubber[]>([])
const bestOfDraft = ref('')
const violationsByRubber = reactive<Record<number, string[]>>({})
const bestOfError = ref<string | null>(null)
const serverError = ref<string | null>(null)
const saving = ref(false)

const isAdmin = computed(() => props.variant === 'admin')

function asIdArray(side: unknown): (string | null)[] | null {
  if (!Array.isArray(side)) return null
  return side.map((id) => (typeof id === 'string' ? id : null))
}

watch(
  () => [props.modelValue, props.tieId, props.variant === 'admin' ? props.context : props.stored] as const,
  () => {
    if (!props.modelValue) return
    serverError.value = null
    bestOfError.value = null
    for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]

    if (isAdmin.value) {
      const ctx = props.context
      if (!ctx) return
      bestOfDraft.value = String(ctx.bestOf)
      rubbers.splice(0, rubbers.length)
      for (let i = 0; i < ctx.rubberCount; i += 1) {
        const stored = ctx.stored[i]
        const prefillA = ctx.prefill[0][i]
        const prefillB = ctx.prefill[1][i]
        const hasStored = stored != null && (stored.games.length > 0 || stored.walkover)
        rubbers.push({
          games: hasStored
            ? stored.games.map((g) => ({ a: String(g.a), b: String(g.b) }))
            : [{ a: '', b: '' }],
          walkover: stored?.walkover ?? false,
          walkoverSide: stored?.walkoverSide ?? null
        })
      }
      return
    }

    // Umpire variant: players ride on the submitted lineups (server-derived on
    // save); the form only scores.
    bestOfDraft.value = String(props.bestOf)
    rubbers.splice(0, rubbers.length)
    for (let i = 0; i < props.rubberCount; i += 1) {
      const stored = props.stored?.[i]
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

function addGame(rubber: number): void {
  rubbers[rubber].games.push({ a: '', b: '' })
}

/** Side display names for one rubber: umpire = pre-filled lineup names. */
function sideNames(rubber: number, side: 0 | 1): string[] {
  if (isAdmin.value) return []
  return props.players?.[rubber]?.[side] ?? []
}

/** The single label above a score column: the player (umpire) or a select (admin). */
function columnPlayerName(rubber: number, side: 0 | 1): string {
  const names = sideNames(rubber, side)
  return names.length ? names.join(', ') : side === 0 ? props.teamAName : props.teamBName
}

function violationsFor(rubber: number): string[] {
  return violationsByRubber[rubber] ?? []
}

function numbersOf(r: EditRubber): GameScore[] {
  return r.games
    .filter((g) => g.a !== '' && g.b !== '')
    .map((g) => ({ a: Number(g.a), b: Number(g.b) }))
}

/** The live derived team-match outcome from the DRAFT state — never stored. */
const draftOutcome = computed(() => {
  const bestOf = Number(bestOfDraft.value) || props.bestOf
  const entered = rubbers
    .map((r, i) => ({
      rubberIndex: i + 1,
      games: numbersOf(r),
      walkover: r.walkover,
      walkoverSide: r.walkoverSide
    }))
    .filter((r) => r.walkover || r.games.length > 0)
  if (entered.length === 0) return null
  const derived = deriveTieResult(entered, bestOf, props.rubberCount)
  const name = (s: Side) => (s === 'a' ? props.teamAName : props.teamBName)
  return {
    tally: derived.tally,
    state: derived.state,
    winnerName: derived.winnerSide ? name(derived.winnerSide) : null
  }
})

const outcomeText = computed(() => {
  const o = draftOutcome.value
  if (!o) return null
  const base = `${props.teamAName} ${o.tally[0]} · ${o.tally[1]} ${props.teamBName}`
  return o.state === 'decided' && o.winnerName ? `${base} — ${o.winnerName} wins` : base
})

async function onSave(): Promise<void> {
  serverError.value = null
  bestOfError.value = null
  for (const k of Object.keys(violationsByRubber)) delete violationsByRubber[Number(k)]
  const bestOf = Number(bestOfDraft.value)

  let touched = 0
  for (let i = 0; i < rubbers.length; i += 1) {
    const r = rubbers[i]
    const games = r.games.filter((g) => g.a !== '' || g.b !== '').map((g) => ({ a: Number(g.a), b: Number(g.b) }))
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
  if (touched === 0 && !isAdmin.value) {
    emit('update:modelValue', false)
    return
  }

  saving.value = true
  try {
    if (isAdmin.value) {
      const ctx = props.context
      if (ctx && bestOf !== ctx.bestOf) {
        try {
          await setTieBestOf(supabase, props.tieId, bestOfDraft.value)
        } catch (e) {
          bestOfError.value = (e as Error).message
          return
        }
      }
      for (let i = 0; i < rubbers.length; i += 1) {
        const r = rubbers[i]
        const games = numbersOf(r)
        if (!r.walkover && games.length === 0) continue
        try {
          await saveRubberResult(supabase, {
            tieId: props.tieId,
            rubberIndex: i + 1,
            games: r.walkover ? [] : games,
            walkover: r.walkover,
            walkoverSide: r.walkover ? r.walkoverSide : null,
            bestOf
          })
        } catch (e) {
          serverError.value = (e as Error).message
          return
        }
      }
    } else {
      for (let i = 0; i < rubbers.length; i += 1) {
        const r = rubbers[i]
        const games = numbersOf(r)
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
    }
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
    max-width="760"
    @update:model-value="emit('update:modelValue', $event as boolean)"
  >
    <v-card rounded="lg">
      <v-card-item>
        <v-card-title>{{ teamAName }} vs {{ teamBName }}</v-card-title>
        <v-card-subtitle>
          <template v-if="eventName">{{ eventName }} · </template>Best of {{ bestOf }} games per
          match
        </v-card-subtitle>
        <template #append>
          <v-chip
            v-if="outcomeText"
            size="small"
            :color="draftOutcome?.state === 'decided' ? 'success' : 'primary'"
            variant="tonal"
            :class="{ 'font-weight-bold': draftOutcome?.state === 'decided' }"
            data-testid="draft-outcome"
          >
            {{ outcomeText }}
          </v-chip>
        </template>
      </v-card-item>
      <v-card-text>
        <v-alert v-if="serverError" type="error" variant="tonal" density="compact" class="mb-3">
          {{ serverError }}
        </v-alert>

        <div v-if="isAdmin" class="d-flex align-center ga-3 mb-3">
          <v-text-field
            v-model="bestOfDraft"
            type="number"
            label="Best of (games per match)"
            density="compact"
            hide-details
            style="max-width: 200px"
          />
        </div>
        <v-alert v-if="bestOfError" type="error" variant="tonal" density="compact" class="mb-3">
          {{ bestOfError }}
        </v-alert>

        <v-card v-for="(r, i) in rubbers" :key="i" variant="outlined" class="mb-3 pa-3">
          <div class="d-flex align-center ga-3">
            <span class="text-subtitle-1 font-weight-bold">Match {{ i + 1 }}</span>
            <span class="text-body-2 text-medium-emphasis match-players">
              {{ columnPlayerName(i, 0) }} vs {{ columnPlayerName(i, 1) }}
            </span>
            <v-spacer />
            <v-checkbox
              v-model="r.walkover"
              density="compact"
              hide-details
              :aria-label="`Match ${i + 1} walkover`"
              data-testid="walkover-toggle"
            >
              <template #label><span class="text-body-2">Walkover</span></template>
            </v-checkbox>
          </div>

          <template v-if="!r.walkover">
            <div class="score-grid mt-2">
              <span class="game-label"></span>
              <span class="side-head text-caption text-medium-emphasis">
                {{ columnPlayerName(i, 0) }}
              </span>
              <span></span>
              <span class="side-head text-caption text-medium-emphasis">
                {{ columnPlayerName(i, 1) }}
              </span>

              <template v-for="(g, gi) in r.games" :key="gi">
                <span class="game-label text-body-2">Game {{ gi + 1 }}</span>
                <v-text-field
                  v-model="g.a"
                  type="number"
                  :aria-label="`Match ${i + 1} game ${gi + 1} side A`"
                  density="compact"
                  hide-details
                  class="score-field"
                />
                <span class="text-body-2 text-medium-emphasis dash">–</span>
                <v-text-field
                  v-model="g.b"
                  type="number"
                  :aria-label="`Match ${i + 1} game ${gi + 1} side B`"
                  density="compact"
                  hide-details
                  class="score-field"
                />
              </template>
            </div>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-plus"
              :aria-label="`Match ${i + 1} add game`"
              @click="addGame(i)"
            >
              Add game
            </v-btn>
          </template>

          <div v-else class="mt-2 d-flex align-center flex-wrap ga-2">
            <span class="text-body-2 text-medium-emphasis mr-1">Winner:</span>
            <v-btn
              size="small"
              :color="r.walkoverSide === 'a' ? 'primary' : undefined"
              :variant="r.walkoverSide === 'a' ? 'flat' : 'outlined'"
              :aria-label="`Match ${i + 1} walkover side A`"
              data-testid="walkover-side"
              @click="r.walkoverSide = 'a'"
            >
              {{ teamAName }}
            </v-btn>
            <v-btn
              size="small"
              :color="r.walkoverSide === 'b' ? 'primary' : undefined"
              :variant="r.walkoverSide === 'b' ? 'flat' : 'outlined'"
              :aria-label="`Match ${i + 1} walkover side B`"
              data-testid="walkover-side"
              @click="r.walkoverSide = 'b'"
            >
              {{ teamBName }}
            </v-btn>
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
        <v-btn color="primary" :disabled="saving" :loading="saving" @click="onSave">
          Save results
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.match-players {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.score-grid {
  display: grid;
  grid-template-columns: 70px minmax(72px, 110px) 16px minmax(72px, 110px);
  column-gap: 8px;
  row-gap: 6px;
  align-items: center;
}
.game-label {
  text-align: right;
  padding-right: 4px;
}
.dash {
  text-align: center;
}
.side-head {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.score-field :deep(input) {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
</style>
