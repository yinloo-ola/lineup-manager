<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { parseSeed, SeedParseError, type SeedFile } from '@/domain/seed'
import { importSeed } from '@/services/importSeed'

type Result = { ok: true; counts: string } | { ok: false; message: string }

const jsonText = ref('')
const busy = ref(false)
const result = ref<Result | null>(null)

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  file.text().then((t) => (jsonText.value = t))
}

async function onImport() {
  result.value = null
  busy.value = true
  try {
    const data: unknown = JSON.parse(jsonText.value)
    const seed: SeedFile = parseSeed(data)
    await importSeed(supabase, seed)
    result.value = {
      ok: true,
      counts: `${seed.categories.length} categories, ${seed.teams.length} teams, ${seed.players.length} players, ${seed.ties.length} ties`
    }
  } catch (e) {
    const message =
      e instanceof SeedParseError ? `Invalid seed: ${e.message}` : (e as Error).message
    result.value = { ok: false, message }
  } finally {
    busy.value = false
  }
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
              Paste the seed JSON exported from tournament-manager (or load a <code>.json</code>
              file). This creates categories, teams, players, and ties. Re-running upserts by id.
            </p>
            <v-textarea
              v-model="jsonText"
              label="Seed JSON"
              rows="12"
              spellcheck="false"
              placeholder='{ "tournamentName": "…", "categories": […], "teams": […], "players": […], "ties": […] }'
            />
            <input
              type="file"
              accept=".json,application/json"
              class="mt-2"
              @change="onFile"
            />
            <div class="mt-4">
              <v-btn color="primary" :loading="busy" :disabled="!jsonText" @click="onImport">
                Parse &amp; import
              </v-btn>
            </div>
            <v-alert
              v-if="result"
              :type="result.ok ? 'success' : 'error'"
              variant="tonal"
              class="mt-4"
            >
              <span v-if="result.ok">Imported {{ result.counts }}.</span>
              <span v-else>{{ result.message }}</span>
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
