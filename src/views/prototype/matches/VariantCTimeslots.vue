<script setup lang="ts">
// PROTOTYPE — Variant C: grouped by timeslot — sections per scheduled time,
// one summary card per team match with a submitted count (ticket 07).
// Throwaway. Do not commit.
import { computed, ref } from 'vue'
import type { MockTeamMatch } from '../mock'
import { FILTERS, matchesFor, statusOf, type DashFilter } from './helpers'
import MatchDetailDialog from './MatchDetailDialog.vue'
import StatusChip from './StatusChip.vue'

const filter = ref<DashFilter>('all')
const selected = ref<MockTeamMatch | null>(null)

const slots = computed(() => {
  const bySlot = new Map<string, MockTeamMatch[]>()
  for (const m of matchesFor(filter.value)) {
    bySlot.set(m.scheduled, [...(bySlot.get(m.scheduled) ?? []), m])
  }
  return [...bySlot.entries()]
})
</script>

<template>
  <div>
    <div class="d-flex align-center mb-3">
      <v-btn-toggle v-model="filter" mandatory density="compact" color="primary">
        <v-btn v-for="f in FILTERS" :key="f.key" :value="f.key" size="small">{{ f.label }}</v-btn>
      </v-btn-toggle>
    </div>

    <section v-for="[time, ms] in slots" :key="time" class="mb-5">
      <div class="d-flex align-center ga-2 mb-2">
        <v-icon icon="mdi-clock-outline" size="small" />
        <span class="text-subtitle-1 font-weight-medium">{{ time }}</span>
        <v-chip size="x-small" variant="tonal">{{ ms.length }} team matches</v-chip>
        <v-chip v-if="ms.every((m) => m.cutoffPassed)" size="x-small" variant="outlined">
          <v-icon icon="mdi-lock-outline" size="x-small" class="mr-1" /> Locked
        </v-chip>
      </div>

      <v-row>
        <v-col v-for="m in ms" :key="`${m.table}-${m.teamA}`" cols="12" sm="6" md="4">
          <v-card
            elevation="1"
            rounded="lg"
            :class="{
              'border-error border-opacity-100': m.cutoffPassed && !(m.aSubmitted && m.bSubmitted),
              'border-disabled': m.cutoffPassed && m.aSubmitted && m.bSubmitted
            }"
            height="100%"
            @click="selected = m"
          >
            <v-card-item>
              <template #prepend>
                <v-chip size="small" variant="tonal" label>Table {{ m.table }}</v-chip>
              </template>
              <v-card-title class="text-body-1">{{ m.teamA }} vs {{ m.teamB }}</v-card-title>
              <v-card-subtitle class="text-caption">
                Group {{ m.group }} · Round {{ m.round }}
              </v-card-subtitle>
            </v-card-item>
            <v-card-text class="pt-0">
              <div class="text-body-2 mb-1">
                {{ (m.aSubmitted ? 1 : 0) + (m.bSubmitted ? 1 : 0) }}/2 submitted
              </div>
              <div class="d-flex flex-wrap ga-1">
                <StatusChip :status="statusOf(m, 'a')" small />
                <StatusChip :status="statusOf(m, 'b')" :needs-attention="m.bNeedsAttention" small />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </section>

    <MatchDetailDialog :match="selected" @close="selected = null" />
  </div>
</template>
