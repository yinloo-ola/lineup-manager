<script setup lang="ts">
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { parseSeed, SeedParseError, type SeedFile } from '@/domain/seed'
import { fetchTournamentNames, importSeed, nameClashes } from '@/services/importSeed'
import { useTournamentStore } from '@/stores/tournament'

type Result = { ok: true; message: string } | { ok: false; message: string }

const tournaments = useTournamentStore()

const jsonText = ref('')
const busy = ref(false)
const result = ref<Result | null>(null)

// Rename-flow state. `pendingSeed` holds a parsed seed awaiting import; when set
// alongside a clash, the UI shows the existing name + a rename field.
const pendingSeed = ref<SeedFile | null>(null)
const existingNames = ref<string[]>([])
const renameValue = ref('')
const renameClash = computed(
  () => renameValue.value !== '' && nameClashes(renameValue.value, existingNames.value)
)

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  file.text().then((t) => (jsonText.value = t))
}

/** Surface parse/network errors with a clear message (parse errors are framed). */
function messageFor(e: unknown): string {
  return e instanceof SeedParseError ? `Invalid seed: ${e.message}` : (e as Error).message
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
  result.value = {
    ok: true,
    message: `Tournament “${name.trim()}” created — ${seed.categories.length} categories, ${seed.teams.length} teams, ${seed.players.length} players, ${seed.ties.length} ties.`
  }
}

async function onParseImport() {
  await runBusy(async () => {
    const seed = parseSeed(JSON.parse(jsonText.value))
    existingNames.value = await fetchTournamentNames(supabase)
    if (nameClashes(seed.tournamentName, existingNames.value)) {
      // Block the import and ask for a rename — resolving completes it.
      pendingSeed.value = seed
      renameValue.value = seed.tournamentName
    } else {
      await doImport(seed, seed.tournamentName)
    }
  })
}

async function onConfirmRename() {
  const seed = pendingSeed.value
  const name = renameValue.value.trim()
  if (!seed || renameClash.value || !name) return
  await runBusy(() => doImport(seed, name))
}

function cancelRename() {
  pendingSeed.value = null
  renameValue.value = ''
}
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>Import seed</v-app-bar-title>
      <template #append>
        <v-btn variant="text" to="/">Home</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <v-card elevation="2" rounded="lg">
          <v-card-text>
            <p class="text-body-2 mb-4">
              Paste the tournament JSON exported from tournament-manager (or load a
              <code>.json</code> file). Each import creates a <strong>new tournament</strong> named
              from <code>tournamentName</code> — re-importing the same file makes a second
              tournament, it never overwrites. Every team carries its manager's email, so
              provisioning is pre-filled after import. Contract:
              <code>docs/seed-contract.md</code>.
            </p>
            <v-textarea
              v-model="jsonText"
              label="Tournament JSON"
              rows="12"
              spellcheck="false"
              placeholder='{ "seedVersion": 1, "tournamentName": "…", "categories": […], "teams": [{ …, "managerEmail": "…" }], "players": […], "ties": […] }'
            />
            <input
              type="file"
              accept=".json,application/json"
              class="mt-2"
              @change="onFile"
            />

            <!-- Name-clash resolution: show the existing name + a rename field. -->
            <v-alert
              v-if="pendingSeed"
              type="warning"
              variant="tonal"
              class="mt-4"
              border
            >
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

            <v-alert
              v-if="result"
              :type="result.ok ? 'success' : 'error'"
              variant="tonal"
              class="mt-4"
            >
              <span>{{ result.message }}</span>
              <v-btn
                v-if="result.ok"
                variant="text"
                size="small"
                class="ml-2"
                to="/admin/lineups"
              >
                View lineups
              </v-btn>
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
