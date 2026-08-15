<script setup lang="ts">
// Import tournament — the create action, owned by the shell's tournament
// selector (spec §4). Ported from the old import page: parse-error framing and
// rename-on-clash are retained verbatim; accepting paste or file input.
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { parseSeed, SeedParseError, type SeedFile } from '@/domain/seed'
import { fetchTournamentNames, importSeed, nameClashes } from '@/services/importSeed'
import { useTournamentStore } from '@/stores/tournament'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void; (e: 'imported'): void }>()

const tournaments = useTournamentStore()

const jsonText = ref('')
const busy = ref(false)
type Result = { ok: true; message: string } | { ok: false; message: string }
const result = ref<Result | null>(null)

// Rename-flow state (a name clash blocks the import until resolved).
const pendingSeed = ref<SeedFile | null>(null)
const existingNames = ref<string[]>([])
const renameValue = ref('')
const renameClash = computed(
  () => renameValue.value !== '' && nameClashes(renameValue.value, existingNames.value)
)

function close(): void {
  emit('update:modelValue', false)
}

function onFile(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  file.text().then((t) => (jsonText.value = t))
}

/** Surface parse/network errors with a clear message (parse errors are framed). */
function messageFor(e: unknown): string {
  return e instanceof SeedParseError
    ? `Invalid tournament file: ${e.message}`
    : (e as Error).message
}

/** Run an async action under the busy flag, surfacing any error as a result. */
async function runBusy(fn: () => Promise<void>): Promise<void> {
  result.value = null
  busy.value = true
  try {
    await fn()
  } catch (e) {
    result.value = { ok: false, message: messageFor(e) }
  } finally {
    busy.value = false
  }
}

/** Persist a parsed seed as a new tournament under `name`, then select it. */
async function doImport(seed: SeedFile, name: string): Promise<void> {
  const { tournamentId } = await importSeed(supabase, seed, name)
  await tournaments.load()
  tournaments.setActive(tournamentId)
  pendingSeed.value = null
  renameValue.value = ''
  jsonText.value = ''
  result.value = {
    ok: true,
    message: `Tournament “${name.trim()}” created — ${seed.categories.length} team events, ${seed.teams.length} teams, ${seed.players.length} players, ${seed.ties.length} team matches.`
  }
  emit('imported')
}

async function onParseImport(): Promise<void> {
  await runBusy(async () => {
    const seed = parseSeed(JSON.parse(jsonText.value))
    existingNames.value = await fetchTournamentNames(supabase)
    if (nameClashes(seed.tournamentName, existingNames.value)) {
      pendingSeed.value = seed
      renameValue.value = seed.tournamentName
    } else {
      await doImport(seed, seed.tournamentName)
    }
  })
}

async function onConfirmRename(): Promise<void> {
  const seed = pendingSeed.value
  const name = renameValue.value.trim()
  if (!seed || renameClash.value || !name) return
  await runBusy(() => doImport(seed, name))
}

function cancelRename(): void {
  pendingSeed.value = null
  renameValue.value = ''
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-item>
        <v-card-title>Import tournament</v-card-title>
        <v-card-subtitle>
          Each import creates a new tournament — with its team events, teams, players, team
          matches, and each team's manager email.
        </v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <v-textarea
          v-model="jsonText"
          label="Tournament JSON"
          rows="8"
          spellcheck="false"
          placeholder='{ "seedVersion": 1, "tournamentName": "…", "categories": […], "teams": [{ …, "managerEmail": "…" }], "players": […], "ties": […] }'
        />
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Tournament file"
          class="mt-2"
          @change="onFile"
        />

        <!-- Name-clash resolution: show the existing name + a rename field. -->
        <v-alert v-if="pendingSeed" type="warning" variant="tonal" class="mt-4" border>
          <p class="mb-2">
            A tournament named <strong>“{{ pendingSeed.tournamentName }}”</strong> already
            exists. Choose a different name to create this tournament.
          </p>
          <v-text-field
            v-model="renameValue"
            label="New tournament name"
            density="compact"
            hide-details="auto"
            :error-messages="renameClash ? ['That name is also taken.'] : []"
            @keyup.enter="onConfirmRename"
          />
          <div class="mt-3">
            <v-btn
              color="primary"
              :loading="busy"
              :disabled="renameClash || !renameValue.trim()"
              @click="onConfirmRename"
            >
              Confirm import
            </v-btn>
            <v-btn variant="text" class="ml-2" @click="cancelRename">Cancel</v-btn>
          </div>
        </v-alert>

        <div v-else class="mt-4">
          <v-btn color="primary" :loading="busy" :disabled="!jsonText" @click="onParseImport">
            Parse &amp; import
          </v-btn>
        </div>

        <v-alert v-if="result" :type="result.ok ? 'success' : 'error'" variant="tonal" class="mt-4">
          <span>{{ result.message }}</span>
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
