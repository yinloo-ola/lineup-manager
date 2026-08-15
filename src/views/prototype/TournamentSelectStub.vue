<script setup lang="ts">
// PROTOTYPE — shared leaf stub: a searchable tournament selector with grouped
// Active & upcoming / Past sections and a trailing "Import tournament…"
// create entry that opens a dialog. Throwaway (ticket 06).
import { computed, ref, watch } from 'vue'
import { activeTournament, tournaments } from './mock'

const model = ref<string | null>(null)
const dialog = ref(false)
const search = ref('')
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
  search.value = ''
}

// Active & upcoming always shown; past tournaments only surface when
// searching (the archive stays out of the default menu). The create entry
// always stays visible. Built-in filtering is disabled — this computed is
// the single filter.
const items = computed(() => {
  const q = search.value.trim().toLowerCase()
  const matches = (t: (typeof tournaments)[number]) =>
    !q || t.name.toLowerCase().includes(q) || t.starts.includes(q)
  const out: Array<Record<string, unknown>> = []
  const live = tournaments.filter((t) => t.status !== 'past' && matches(t))
  if (live.length) {
    out.push({ header: 'Active & upcoming' })
    out.push(
      ...live.map((t) => ({
        title: t.name,
        value: t.name,
        props: { subtitle: t.starts }
      }))
    )
  }
  if (q) {
    const past = tournaments.filter((t) => t.status === 'past' && matches(t))
    if (past.length) {
      out.push({ header: 'Past' })
      out.push(
        ...past.map((t) => ({
          title: t.name,
          value: t.name,
          props: { subtitle: t.starts }
        }))
      )
    }
  } else {
    out.push({
      title: 'Type to search past tournaments',
      props: { disabled: true, prependIcon: 'mdi-magnify' }
    })
  }
  out.push({
    title: 'Import tournament…',
    value: '__import__',
    props: { prependIcon: 'mdi-database-import', baseColor: 'primary' }
  })
  return out
})
</script>

<template>
  <div>
    <v-autocomplete
      v-model="model"
      v-model:search="search"
      :items="items"
      :filter="() => true"
      label="Tournament"
      density="compact"
      hide-details
      variant="outlined"
      :menu-props="{ maxHeight: 320 }"
      style="max-width: 280px"
      @update:model-value="onChange"
    />

    <v-dialog v-model="dialog" max-width="480">
      <v-card>
        <v-card-item>
          <v-card-title>Import tournament</v-card-title>
        </v-card-item>
        <v-card-text>
          Upload the tournament JSON exported from the organizer tool. This is the create action:
          each import creates one more tournament — with its team events, teams, players, team
          matches, and each team's manager email.
          <v-file-input label="Tournament file" density="compact" prepend-icon="" class="mt-3" />
          <p class="text-caption text-medium-emphasis mt-2">
            After import: author the team match formats, then provision the manager accounts —
            emails pre-filled from the import.
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
