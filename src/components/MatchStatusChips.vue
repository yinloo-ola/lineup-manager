<script setup lang="ts">
// A team's lineup-status chips in the on-screen vocabulary (spec §2): the
// status chip (Missed cutoff carries the alert icon) plus the rare
// Needs attention marker for a lineup a format edit broke.
import type { MatchSide, SideStatus } from '@/domain/matchesDashboard'

const props = defineProps<{ side: MatchSide }>()

const PRESENTATION: Record<SideStatus, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'green' },
  'not-submitted': { label: 'Not submitted', color: 'grey' },
  'missed-cutoff': { label: 'Missed cutoff', color: 'error' }
}
</script>

<template>
  <div class="d-flex flex-wrap align-center ga-2">
    <v-chip :color="PRESENTATION[props.side.status].color" variant="tonal" size="small">
      {{ PRESENTATION[props.side.status].label }}
      <template v-if="props.side.status === 'missed-cutoff'" #prepend>
        <v-icon start icon="mdi-alert"></v-icon>
      </template>
    </v-chip>
    <v-chip v-if="props.side.needsAttention" color="warning" variant="tonal" size="small">
      Needs attention
    </v-chip>
  </div>
</template>
