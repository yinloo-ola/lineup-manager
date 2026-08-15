<script setup lang="ts">
// PROTOTYPE — shared drill-in detail: both teams' lineups per team match,
// with edit-on-behalf reachable (ticket 07). Throwaway. Do not commit.
import type { MockTeamMatch } from '../mock'
import { lineupOf, metaLine, statusOf } from './helpers'
import StatusChip from './StatusChip.vue'

const props = defineProps<{ match: MockTeamMatch | null }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <v-dialog
    :model-value="match !== null"
    max-width="640"
    scrollable
    @update:model-value="emit('close')"
  >
    <v-card v-if="match">
      <v-card-item>
        <v-card-title>{{ match.teamA }} vs {{ match.teamB }}</v-card-title>
        <v-card-subtitle>{{ metaLine(match) }}</v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <div v-for="side in (['a', 'b'] as const)" :key="side" class="mb-4">
          <div class="d-flex align-center ga-2 mb-1">
            <span class="text-body-1 font-weight-medium">
              {{ side === 'a' ? match.teamA : match.teamB }}
            </span>
            <StatusChip
              :status="statusOf(match, side)"
              :needs-attention="side === 'b' && match.bNeedsAttention"
              small
            />
            <v-spacer />
            <v-btn
              size="small"
              :color="statusOf(match, side) === 'missed-cutoff' ? 'error' : 'primary'"
              variant="tonal"
              prepend-icon="mdi-pencil-outline"
            >
              {{
                statusOf(match, side) === 'missed-cutoff'
                  ? 'Fill lineup on behalf'
                  : 'Edit on behalf'
              }}
            </v-btn>
          </div>
          <v-alert
            v-if="statusOf(match, side) === 'missed-cutoff'"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            Cutoff passed with no lineup — chase the team manager or fill the lineup on behalf now.
          </v-alert>
          <v-list density="compact" lines="one" class="py-0">
            <v-list-item
              v-for="p in lineupOf(side === 'a' ? match.teamA : match.teamB)"
              :key="p"
              :title="p"
            />
          </v-list>
        </div>
        <p class="text-caption text-medium-emphasis">
          On-behalf editing opens the lineup builder as that team (builder with ?team=) — the
          admin's escape hatch; chasing stays visibility-only (no in-app nudge).
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="emit('close')">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
