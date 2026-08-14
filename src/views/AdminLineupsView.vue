<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTournamentStore } from '@/stores/tournament'
import { supabase } from '@/lib/supabase'
import { fetchAdminLineups } from '@/services/lineupService'
import TournamentSelector from '@/components/TournamentSelector.vue'
import type { AdminLineupRow } from '@/domain/adminView'

const auth = useAuthStore()
const tournaments = useTournamentStore()
const rows = ref<AdminLineupRow[]>([])
const errorMessage = ref<string | null>(null)

const STATUS_COLORS: Record<string, string> = {
  'not-started': 'grey',
  draft: 'amber',
  submitted: 'green',
  invalidated: 'red'
}
function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? 'grey'
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString()
}

async function load(): Promise<void> {
  errorMessage.value = null
  if (!tournaments.activeId) return
  try {
    rows.value = await fetchAdminLineups(supabase, tournaments.activeId)
  } catch (e) {
    errorMessage.value = (e as Error).message
  }
}

// Re-scope when the administrator switches tournament.
watch(() => tournaments.activeId, load)

onMounted(load)
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>All lineups</v-app-bar-title>
      <TournamentSelector class="mr-2" />
      <template #append>
        <v-btn variant="text" to="/">Home</v-btn>
      </template>
    </v-app-bar>

    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>

    <v-card elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>Administrator oversight</v-card-title>
        <v-card-subtitle>
          Every team's lineup + status. Admins may fill or overwrite any lineup — including after the cutoff — using the same validation rules as managers.
        </v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-table v-if="rows.length" density="comfortable">
          <thead>
            <tr>
              <th>Team</th>
              <th>Opponent</th>
              <th>Category</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Cutoff</th>
              <th>Last edit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="`${r.tieId}:${r.teamId}`">
              <td>{{ r.teamName }}</td>
              <td>{{ r.opponentName }}</td>
              <td>{{ r.categoryName }}</td>
              <td>
                <v-chip :color="statusColor(r.effectiveStatus)" variant="tonal" size="small">{{ r.effectiveStatus }}</v-chip>
                <v-chip v-if="r.effectiveStatus === 'invalidated'" color="red" variant="tonal" size="small" class="ml-1">action needed</v-chip>
                <v-chip v-else-if="r.locked" color="red" variant="tonal" size="small" class="ml-1">locked</v-chip>
              </td>
              <td>{{ fmt(r.scheduledStart) }}</td>
              <td>{{ fmt(r.cutoff) }}</td>
              <td>
                <span v-if="r.updatedBy">{{ r.updatedBy }}</span>
                <span v-else class="text-medium-emphasis">—</span>
                <div class="text-caption text-medium-emphasis">{{ fmt(r.updatedAt) }}</div>
              </td>
              <td class="text-right">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="primary"
                  :to="{ name: 'lineup-builder', params: { tieId: r.tieId }, query: { team: r.teamId } }"
                >
                  Edit
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2">No lineups saved yet.</p>
      </v-card-text>
    </v-card>
  </v-container>
</template>
