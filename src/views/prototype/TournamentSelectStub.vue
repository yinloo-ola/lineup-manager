<script setup lang="ts">
// PROTOTYPE — shared leaf stub: the tournament selector with a trailing
// "Import seed…" create entry that opens a dialog. Throwaway (ticket 06).
import { ref, watch } from 'vue'
import { activeTournament } from './mock'

const model = ref<string | null>(null)
const dialog = ref(false)
watch(
  activeTournament,
  (t) => {
    model.value = t
  },
  { immediate: true }
)

// Selecting the trailing create entry opens the import dialog; selecting a
// real tournament just moves the stub's local value (mock — no switching).
function onChange(v: unknown): void {
  if (v === '__import__') {
    dialog.value = true
    model.value = activeTournament.value
  }
}
</script>

<template>
  <div>
    <v-select
      :model-value="model"
      :items="[
        'Spring League 2026',
        'Autumn Open 2026',
        {
          title: 'Import seed…',
          value: '__import__',
          props: { prependIcon: 'mdi-database-import', baseColor: 'primary' }
        }
      ]"
      label="Tournament"
      density="compact"
      hide-details
      variant="outlined"
      style="max-width: 240px"
      @update:model-value="onChange"
    />

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-item>
          <v-card-title>Import seed — create a tournament</v-card-title>
        </v-card-item>
        <v-card-text>
          Upload the organizer's seed JSON. This is the create action: each import creates one more
          tournament — with its team events, teams, players, team matches, and each team's manager
          email.
          <v-file-input label="Seed file" density="compact" prepend-icon="" class="mt-3" />
          <p class="text-caption text-medium-emphasis mt-2">
            After import: author the team match formats, then provision the manager accounts —
            emails pre-filled from the seed.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancel</v-btn>
          <v-btn color="primary" variant="tonal" @click="dialog = false">Import</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
