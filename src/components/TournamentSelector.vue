<script setup lang="ts">
// Admin tournament selector (spec §4): owns switching AND creation. The menu
// shows Active & upcoming by default (newest-first, start-date subtitles) with
// a muted hint that past tournaments are searchable; typing surfaces them under
// a "Past" header. The trailing "Import tournament…" entry is the create action.
// A Team Manager never renders this — they're auto-scoped to their own tournament.
import { computed, ref, watch } from 'vue'
import { groupTournaments } from '@/domain/tournamentGrouping'
import { useTournamentStore } from '@/stores/tournament'
import ImportTournamentDialog from '@/components/ImportTournamentDialog.vue'

const store = useTournamentStore()
const search = ref('')
const importOpen = ref(false)

watch(
  () => store.activeId,
  () => {
    search.value = ''
  }
)

const today = new Date().toISOString().slice(0, 10)

// Grouped per the domain rule; headers drop out when their group is empty; the
// create entry always stays. Built-in filtering is disabled — this is the only
// filter. Subtitles carry the start date so same-named years differ at a glance.
const toItem = (t: { id: string; name: string; startDate: string | null }) => ({
  title: t.name,
  value: t.id,
  props: { subtitle: t.startDate ?? 'no start date' }
})

const items = computed(() => {
  const { live, past } = groupTournaments(store.tournaments, {
    today,
    query: search.value
  })
  const out: Array<Record<string, unknown>> = []
  if (live.length) {
    out.push({ header: 'Active & upcoming' }, ...live.map(toItem))
  }
  if (search.value.trim()) {
    if (past.length) {
      out.push({ header: 'Past' }, ...past.map(toItem))
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

// Selecting the trailing create entry opens the import dialog; selecting a
// tournament switches (and clears any search).
function onChange(v: unknown): void {
  if (v === '__import__') {
    importOpen.value = true
    // Restore the selection the menu briefly showed on the pseudo-entry.
    if (store.activeId) store.setActive(store.activeId)
  } else if (typeof v === 'string') {
    store.setActive(v)
  }
  search.value = ''
}
</script>

<template>
  <div class="d-flex align-center">
    <v-autocomplete
      :model-value="store.activeId"
      v-model:search="search"
      :items="items"
      :filter="() => true"
      label="Tournament"
      density="compact"
      hide-details
      hide-selected
      variant="outlined"
      :menu-props="{ maxHeight: 320 }"
      style="max-width: 280px"
      @update:model-value="onChange"
    />
    <ImportTournamentDialog v-model="importOpen" />
  </div>
</template>
