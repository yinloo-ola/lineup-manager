<script setup lang="ts">
// PROTOTYPE — Variant A: dense fixture table, one row per team match, scan by
// scheduled time (ticket 07). Throwaway. Do not commit.
import { ref } from 'vue'
import type { MockTeamMatch } from '../mock'
import { FILTERS, matchesFor, statusOf, type DashFilter } from './helpers'
import MatchDetailDialog from './MatchDetailDialog.vue'
import StatusChip from './StatusChip.vue'

const filter = ref<DashFilter>('all')
const selected = ref<MockTeamMatch | null>(null)
</script>

<template>
  <div>
    <div class="d-flex align-center mb-3">
      <v-btn-toggle v-model="filter" mandatory density="compact" color="primary">
        <v-btn v-for="f in FILTERS" :key="f.key" :value="f.key" size="small">{{ f.label }}</v-btn>
      </v-btn-toggle>
    </div>

    <v-table density="compact" hover>
      <thead>
        <tr>
          <th class="text-left">Scheduled</th>
          <th class="text-left">Table</th>
          <th class="text-left">Group · Round</th>
          <th class="text-left">Team</th>
          <th class="text-left">Lineup</th>
          <th class="text-left">Team</th>
          <th class="text-left">Lineup</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="m in matchesFor(filter)"
          :key="`${m.scheduled}-${m.table}-${m.teamA}`"
          :class="{ 'missed-row': m.cutoffPassed && !(m.aSubmitted && m.bSubmitted) }"
          style="cursor: pointer"
          @click="selected = m"
        >
          <td>
            <span class="d-inline-flex align-center ga-1">
              {{ m.scheduled }}
              <v-chip v-if="m.cutoffPassed" size="x-small" variant="outlined">Locked</v-chip>
            </span>
          </td>
          <td>{{ m.table }}</td>
          <td class="text-medium-emphasis">{{ m.group }} · {{ m.round }}</td>
          <td class="font-weight-medium">{{ m.teamA }}</td>
          <td><StatusChip :status="statusOf(m, 'a')" small /></td>
          <td class="font-weight-medium">{{ m.teamB }}</td>
          <td><StatusChip :status="statusOf(m, 'b')" :needs-attention="m.bNeedsAttention" small /></td>
        </tr>
      </tbody>
    </v-table>

    <MatchDetailDialog :match="selected" @close="selected = null" />
  </div>
</template>

<style scoped>
.missed-row :deep(td) {
  background: rgb(var(--v-theme-error) / 8%);
  font-weight: 500;
}
</style>
