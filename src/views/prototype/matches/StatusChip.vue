<script setup lang="ts">
// PROTOTYPE — shared status chip (ticket 07). Throwaway. Do not commit.
import { STATUS_META, type LineupStatus } from './helpers'

defineProps<{ status: LineupStatus; needsAttention?: boolean; small?: boolean }>()
</script>

<template>
  <span class="d-inline-flex align-center ga-1">
    <v-chip
      :color="STATUS_META[status].color"
      :size="small ? 'x-small' : 'small'"
      :variant="status === 'missed-cutoff' ? 'flat' : 'tonal'"
    >
      <v-icon v-if="status === 'missed-cutoff'" icon="mdi-alert" size="x-small" class="mr-1" />
      {{ STATUS_META[status].label }}
    </v-chip>
    <v-chip v-if="needsAttention" color="warning" size="x-small" variant="tonal">Needs attention</v-chip>
  </span>
</template>
