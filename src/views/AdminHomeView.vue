<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTournamentStore } from '@/stores/tournament'
import TournamentSelector from '@/components/TournamentSelector.vue'

const auth = useAuthStore()
const tournaments = useTournamentStore()
const router = useRouter()
const email = computed(() => auth.user?.email ?? '')

async function signOut() {
  await auth.signOut()
  // No guard fires without a navigation, so push explicitly to /login.
  router.push({ name: 'login' })
}
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>Lineup Manager</v-app-bar-title>
      <TournamentSelector class="mr-2" />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="signOut">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <!-- Empty state: no tournaments (fresh install, or all deleted). #15. -->
        <v-card v-if="tournaments.tournaments.length === 0" elevation="2" rounded="lg">
          <v-card-item>
            <v-card-title class="text-h5">No tournaments yet</v-card-title>
            <v-card-subtitle>Signed in as {{ email }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-body-1">
            Import a seed to create your first tournament. You can rename, set start dates, and
            delete tournaments from the manage view at any time.
          </v-card-text>
          <v-card-actions>
            <v-btn variant="tonal" color="primary" to="/import" prepend-icon="mdi-database-import">
              Import seed
            </v-btn>
            <v-btn variant="tonal" to="/manage" prepend-icon="mdi-tune-variant">
              Manage tournaments
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card v-else elevation="2" rounded="lg">
          <v-card-item>
            <v-card-title class="text-h5">Administrator home</v-card-title>
            <v-card-subtitle>Signed in as {{ email }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-body-1">
            The scaffold is live. Roster views, Tie Format authoring, and lineup submission arrive in
            later tickets.
          </v-card-text>
          <v-card-actions>
            <v-btn variant="tonal" color="primary" to="/import" prepend-icon="mdi-database-import">
              Import seed
            </v-btn>
            <v-btn variant="tonal" to="/provision" prepend-icon="mdi-account-plus">
              Provision manager
            </v-btn>
            <v-btn variant="tonal" to="/format" prepend-icon="mdi-format-list-bulleted">
              Author Tie Format
            </v-btn>
            <v-btn variant="tonal" to="/admin/lineups" prepend-icon="mdi-clipboard-list-outline">
              All lineups
            </v-btn>
            <v-btn variant="tonal" to="/manage" prepend-icon="mdi-tune-variant">
              Manage tournaments
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
