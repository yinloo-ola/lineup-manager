<script setup lang="ts">
// PROTOTYPE — Variant B: status-first board — chasing columns (Not submitted
// / Submitted), cutoff matches pinned at top (ticket 07). Throwaway. Do not commit.
import { computed, ref } from 'vue'
import type { MockTeamMatch } from '../mock'
import { FILTERS, matchesFor, statusOf, type DashFilter } from './helpers'
import MatchDetailDialog from './MatchDetailDialog.vue'
import StatusChip from './StatusChip.vue'

const filter = ref<DashFilter>('all')
const selected = ref<MockTeamMatch | null>(null)

// Missed-cutoff matches first — they need action now (chase or fill on behalf).
const missing = computed(() => {
  const list = matchesFor(filter.value).filter((m) => !(m.aSubmitted && m.bSubmitted))
  return list.sort((x, y) => Number(y.cutoffPassed) - Number(x.cutoffPassed) || x.sortKey - y.sortKey)
})
const done = computed(() => matchesFor(filter.value).filter((m) => m.aSubmitted && m.bSubmitted))

function cardSubtitle(m: MockTeamMatch): string {
  return `Group ${m.group} · Round ${m.round} · Table ${m.table} · ${m.scheduled}`
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-3">
      <v-btn-toggle v-model="filter" mandatory density="compact" color="primary">
        <v-btn v-for="f in FILTERS" :key="f.key" :value="f.key" size="small">{{ f.label }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-row>
      <v-col cols="12" md="6">
        <div class="text-overline text-error mb-2">Not submitted ({{ missing.length }})</div>
        <v-card
          v-for="m in missing"
          :key="`${m.scheduled}-${m.table}-${m.teamA}`"
          :class="m.cutoffPassed ? 'border-error border-opacity-100' : 'border-error'"
          elevation="1"
          rounded="lg"
          class="mb-2"
          @click="selected = m"
        >
          <v-card-item>
            <v-card-title class="text-body-1">
              {{ m.teamA }} vs {{ m.teamB }}
              <v-chip v-if="m.cutoffPassed" size="x-small" variant="outlined" class="ml-1">Locked</v-chip>
            </v-card-title>
            <v-card-subtitle class="text-caption">{{ cardSubtitle(m) }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-wrap ga-2 pt-0">
            <StatusChip :status="statusOf(m, 'a')" small />
            <StatusChip :status="statusOf(m, 'b')" :needs-attention="m.bNeedsAttention" small />
          </v-card-text>
        </v-card>
        <div v-if="!missing.length" class="text-body-2 text-medium-emphasis">Nothing to chase.</div>
      </v-col>

      <v-col cols="12" md="6">
        <div class="text-overline text-success mb-2">Submitted ({{ done.length }})</div>
        <v-card
          v-for="m in done"
          :key="`${m.scheduled}-${m.table}-${m.teamA}`"
          elevation="1"
          rounded="lg"
          class="mb-2"
          @click="selected = m"
        >
          <v-card-item>
            <v-card-title class="text-body-1">{{ m.teamA }} vs {{ m.teamB }}</v-card-title>
            <v-card-subtitle class="text-caption">{{ cardSubtitle(m) }}</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <MatchDetailDialog :match="selected" @close="selected = null" />
  </div>
</template>
