<script setup lang="ts">
// The no-tournament state (spec §3): landing when no tournament exists — the
// first-run screen, whose whole job is the create action (import).
import { ref } from 'vue'
import ImportTournamentDialog from '@/components/ImportTournamentDialog.vue'
import { useRouter } from 'vue-router'
import { useTournamentStore } from '@/stores/tournament'

const importOpen = ref(false)
const router = useRouter()
const tournaments = useTournamentStore()

// After a successful import the tournament exists — land on Matches.
function onImported(): void {
  void router.push({ name: 'matches' })
}
</script>

<template>
  <v-container>
    <v-card elevation="2" rounded="lg" class="pa-6 mt-8 text-center mx-auto" max-width="480">
      <v-icon icon="mdi-trophy-outline" size="48" class="mb-2" />
      <div class="text-h6">No tournament yet</div>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Import a tournament to create your first one — its team events, teams, and team matches.
      </p>
      <v-btn color="primary" prepend-icon="mdi-database-import" @click="importOpen = true">
        Import tournament
      </v-btn>
    </v-card>
    <ImportTournamentDialog v-model="importOpen" @imported="onImported" />
  </v-container>
</template>
