<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { fetchLineupBuilderData, saveLineupDraft, type LineupBuilderData } from '@/services/lineupService'
import { isLineupComplete, removePlayer, tryAssign } from '@/domain/lineupBuilder'
import { findDoubleBookings, validateLineup } from '@/domain/validate'
import type { Lineup, Rubber, Violation } from '@/domain/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const data = ref<LineupBuilderData | null>(null)
const working = ref<Lineup | null>(null)
const selected = ref<Record<number, string | null>>({})
const feedback = ref<{ kind: 'success' | 'error'; text: string } | null>(null)
const errorMessage = ref<string | null>(null)
const busy = ref(false)

const tieId = computed(() => String(route.params.tieId))

function expectedFor(rubber: Rubber): number {
  return rubber.format === 'singles' ? 1 : 2
}
function assigned(i: number): string[] {
  return working.value?.playerIds[i] ?? []
}
function rubberFull(i: number): boolean {
  const fmt = data.value?.tieFormat
  if (!fmt) return true
  return assigned(i).length >= expectedFor(fmt.rubbers[i])
}
function availablePlayers(i: number): { id: string; label: string }[] {
  const taken = new Set(assigned(i))
  return (data.value?.roster ?? [])
    .filter((p) => !taken.has(p.id))
    .map((p) => ({ id: p.id, label: `${p.name} (${p.gender})` }))
}
function playerName(id: string): string {
  const p = data.value?.roster.find((x) => x.id === id)
  return p ? `${p.name} (${p.gender})` : id
}

// Current standing issues in the working lineup (excluding "incomplete rubber",
// which is expected while drafting). Drives the per-rubber + global alerts.
const issues = computed<Violation[]>(() => {
  const d = data.value
  const w = working.value
  if (!d || !w) return []
  const within = validateLineup(d.tieFormat, d.tie, w, d.roster, { asOf: d.asOf })
  const across = findDoubleBookings([d.tie, ...d.teamTies], [w, ...d.teamLineups])
  return [...within, ...across].filter((v) => v.kind !== 'incomplete-rubber')
})
const rubberIssues = computed<Violation[][]>(() => {
  const byRubber: Violation[][] = []
  for (const v of issues.value) {
    if (v.rubberIndex === undefined) continue
    ;(byRubber[v.rubberIndex] ??= []).push(v)
  }
  return byRubber
})
const globalIssues = computed(() => issues.value.filter((v) => v.rubberIndex === undefined))
const complete = computed(() => {
  const d = data.value
  const w = working.value
  return !!(d && w && isLineupComplete(d.tieFormat, w))
})

function rubberSummary(rubber: Rubber): string {
  const parts: string[] = [rubber.format === 'singles' ? 'Singles' : 'Doubles']
  const g = rubber.constraint.allowedGenders
  if (g && g.length) {
    const map: Record<string, string> = { M: 'Men', F: 'Women' }
    parts.push(g.map((x) => map[x] ?? x).join(' / '))
  } else {
    parts.push('Any gender')
  }
  const { ageMin, ageMax } = rubber.constraint
  if (ageMin !== undefined && ageMax !== undefined) parts.push(`age ${ageMin}\u2013${ageMax}`)
  else if (ageMin !== undefined) parts.push(`age ${ageMin}+`)
  else if (ageMax !== undefined) parts.push(`age \u2264${ageMax}`)
  if (rubber.format === 'doubles' && rubber.pairRule) {
    parts.push(
      rubber.pairRule === 'same-gender'
        ? 'same-gender pair'
        : rubber.pairRule === 'mixed'
          ? 'mixed pair'
          : 'any pair'
    )
  }
  return parts.join(' \u00b7 ')
}

function onAdd(i: number, playerId: string | null): void {
  selected.value[i] = null
  const d = data.value
  const w = working.value
  if (!d || !w || !playerId) return
  const result = tryAssign({
    tieFormat: d.tieFormat,
    tie: d.tie,
    roster: d.roster,
    asOf: d.asOf,
    lineup: w,
    rubberIndex: i,
    playerId,
    teamTies: d.teamTies,
    teamLineups: d.teamLineups
  })
  if (result.ok) {
    working.value = result.lineup
    feedback.value = null
  } else {
    feedback.value = { kind: 'error', text: `${playerName(playerId)}: ${result.reason}` }
  }
}

function onRemove(i: number, playerId: string): void {
  if (!working.value) return
  working.value = removePlayer(working.value, i, playerId)
  feedback.value = null
}

async function onSave(): Promise<void> {
  const d = data.value
  const w = working.value
  if (!d || !w || d.locked) return
  busy.value = true
  feedback.value = null
  try {
    await saveLineupDraft(supabase, w)
    feedback.value = { kind: 'success', text: 'Draft saved.' }
  } catch (e) {
    feedback.value = { kind: 'error', text: (e as Error).message }
  } finally {
    busy.value = false
  }
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString()
}

async function load(): Promise<void> {
  errorMessage.value = null
  if (!auth.teamId) {
    errorMessage.value = 'No team is assigned to this account.'
    return
  }
  try {
    const d = await fetchLineupBuilderData(supabase, tieId.value, auth.teamId)
    data.value = d
    working.value = d.lineup
  } catch (e) {
    errorMessage.value = (e as Error).message
  }
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>
        <template v-if="data">vs {{ data.opponentName }}</template>
        <template v-else>Lineup</template>
      </v-app-bar-title>
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-arrow-left" :to="{ name: 'manager' }">Back</v-btn>
      </template>
    </v-app-bar>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>

    <template v-if="data && working">
      <v-alert v-if="data.locked" type="warning" variant="tonal" class="mt-4">
        Lineup is locked — the cutoff ({{ fmt(data.cutoff) }}) has passed. Drafts can no longer be saved.
      </v-alert>

      <v-row class="mt-2">
        <v-col cols="12" md="7">
          <div
            v-for="(rubber, i) in data.tieFormat.rubbers"
            :key="i"
            class="rubber-row mb-4"
          >
            <v-card elevation="1" rounded="lg">
              <v-card-item>
                <v-card-title class="text-h6">
                  Rubber {{ i + 1 }} <span class="text-medium-emphasis text-body-2">· {{ rubberSummary(rubber) }}</span>
                </v-card-title>
                <v-card-subtitle>{{ expectedFor(rubber) }} player(s)</v-card-subtitle>
              </v-card-item>
              <v-card-text>
                <div class="d-flex flex-wrap align-center ga-2 mb-3">
                  <v-chip
                    v-for="pid in assigned(i)"
                    :key="pid"
                    color="primary"
                    variant="tonal"
                    closable
                    :disabled="data.locked"
                    @click:close="onRemove(i, pid)"
                  >
                    {{ playerName(pid) }}
                  </v-chip>
                  <span v-if="assigned(i).length === 0" class="text-medium-emphasis">No player assigned.</span>
                </div>

                <v-select
                  v-if="!rubberFull(i) && !data.locked"
                  :model-value="selected[i] ?? null"
                  :items="availablePlayers(i)"
                  item-title="label"
                  item-value="id"
                  label="Add player"
                  density="compact"
                  clearable
                  @update:model-value="onAdd(i, $event)"
                />

                <v-alert
                  v-for="(v, vi) in rubberIssues[i]"
                  :key="vi"
                  type="error"
                  variant="tonal"
                  density="compact"
                  class="mt-1"
                >
                  {{ v.message }}
                </v-alert>
              </v-card-text>
            </v-card>
          </div>
        </v-col>

        <v-col cols="12" md="5">
          <v-card elevation="2" rounded="lg" class="mb-4">
            <v-card-item>
              <v-card-title>Lineup</v-card-title>
              <v-card-subtitle>
                {{ fmt(data.tie.scheduledStart) }} · cutoff {{ fmt(data.cutoff) }}
              </v-card-subtitle>
            </v-card-item>
            <v-card-text>
              <v-chip :color="complete ? 'green' : 'amber'" variant="tonal" class="mr-2">
                {{ complete ? 'complete' : 'draft' }}
              </v-chip>
              <v-chip color="grey" variant="tonal">{{ data.lineup.status }}</v-chip>

              <v-alert
                v-for="(v, vi) in globalIssues"
                :key="vi"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
              >
                {{ v.message }}
              </v-alert>

              <v-alert
                v-if="feedback"
                :type="feedback.kind"
                variant="tonal"
                density="comfortable"
                class="mt-3"
              >
                {{ feedback.text }}
              </v-alert>

              <v-btn
                color="primary"
                block
                size="large"
                class="mt-4"
                :loading="busy"
                :disabled="data.locked"
                @click="onSave"
              >
                Save draft
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>
