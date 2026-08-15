<script setup lang="ts">
// The admin shell (spec §3): flat left rail — Matches primary, the three setup
// sections directly reachable but visually subordinate — plus the app bar with
// location title, the global tournament selector, and sign out. Every admin
// page renders inside this layout; per-page app bars are gone.
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTournamentStore } from '@/stores/tournament'
import TournamentSelector from '@/components/TournamentSelector.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const tournaments = useTournamentStore()

const locationTitle = computed(() => (route.meta.title as string | undefined) ?? 'Matches')
const hasTournament = computed(() => tournaments.active !== null)
const today = new Date().toISOString().slice(0, 10)
// The format-freeze hook (spec §6): once started, the formats entry locks.
// Ticket 16 replaces this date check with the freeze rule itself. The loose
// null check also covers "no active tournament" (the empty state).
const started = computed(
  () =>
    tournaments.active?.startDate != null && tournaments.active.startDate <= today
)

async function onSignOut(): Promise<void> {
  await auth.signOut()
  await router.push({ name: 'login' })
}
</script>

<template>
  <v-layout>
    <v-navigation-drawer permanent width="230">
      <div class="pa-3 text-subtitle-2 text-medium-emphasis">Lineup Manager</div>
      <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament</div>
      <v-list-item
        :active="$route.name === 'matches'"
        :active-color="$route.name === 'matches' ? 'primary' : undefined"
        prepend-icon="mdi-table-tennis"
        title="Matches"
        :disabled="!hasTournament"
        to="/matches"
      />
      <v-divider class="my-2" />
      <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament setup</div>
      <v-list-item
        :active="$route.name === 'settings'"
        prepend-icon="mdi-tune-variant"
        to="/settings"
        class="text-medium-emphasis"
      >
        <v-list-item-title class="text-body-2">Tournament settings</v-list-item-title>
      </v-list-item>
      <v-list-item
        :active="$route.name === 'formats'"
        prepend-icon="mdi-format-list-bulleted"
        :append-icon="started ? 'mdi-lock-outline' : undefined"
        to="/formats"
        class="text-medium-emphasis"
      >
        <v-list-item-title class="text-body-2">Team match formats</v-list-item-title>
      </v-list-item>
      <v-list-item
        :active="$route.name === 'provision'"
        prepend-icon="mdi-account-plus"
        to="/provision"
        class="text-medium-emphasis"
      >
        <v-list-item-title class="text-body-2">Provision managers</v-list-item-title>
      </v-list-item>
    </v-navigation-drawer>

    <v-app-bar flat color="surface" elevation="1">
      <v-app-bar-title>
        {{ locationTitle }}
        <span v-if="hasTournament" class="text-medium-emphasis text-body-2">
          · {{ tournaments.active!.name }}
        </span>
      </v-app-bar-title>
      <v-spacer />
      <TournamentSelector v-if="hasTournament" />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="onSignOut">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-layout>
</template>
