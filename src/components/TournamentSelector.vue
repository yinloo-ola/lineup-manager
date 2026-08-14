<script setup lang="ts">
import { useTournamentStore } from '@/stores/tournament'

// Admin tournament switcher. With more than one tournament it's a dropdown; with
// exactly one it's a read-only chip (context without a pointless selector). A Team
// Manager never renders this — they're auto-scoped to their own tournament.
const store = useTournamentStore()
</script>

<template>
  <v-select
    v-if="store.tournaments.length > 1"
    :model-value="store.activeId"
    :items="store.tournaments"
    item-title="name"
    item-value="id"
    density="compact"
    hide-details
    flat
    variant="outlined"
    label="Tournament"
    prepend-inner-icon="mdi-trophy"
    style="max-width: 260px"
    @update:model-value="store.setActive($event as string)"
  />
  <v-chip v-else-if="store.active" label variant="tonal" size="small">
    <v-icon start>mdi-trophy</v-icon>
    {{ store.active.name }}
  </v-chip>
</template>
