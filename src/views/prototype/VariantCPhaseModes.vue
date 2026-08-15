<script setup lang="ts">
// PROTOTYPE — Variant C, reshaped per user verdict: left nav with Matches as
// the primary area and Setup demoted below it; setup's three sections are
// inner tabs. Throwaway (wayfinder ticket 06). Do not commit.
import { ref, watch } from 'vue'
import MockContent from './MockContent.vue'
import TournamentSelectStub from './TournamentSelectStub.vue'
import { activeTournament, phase } from './mock'

type Mode = 'matches' | 'setup'
const mode = ref<Mode>(phase.value === 'none' ? 'setup' : 'matches')
watch(phase, (p) => {
  mode.value = p === 'none' ? 'setup' : 'matches'
})

const setupTab = ref<string>('tournaments')
const setupTabs = [
  { key: 'tournaments', title: 'Tournament settings' },
  { key: 'formats', title: 'Team match formats' },
  { key: 'provision', title: 'Provision managers' }
]
</script>

<template>
  <v-layout class="rounded">
    <v-app-bar flat color="surface" elevation="1">
      <v-app-bar-title>
        {{ activeTournament ?? 'Lineup Manager' }}
        <span v-if="activeTournament" class="text-medium-emphasis text-body-2">
          · {{ phase === 'started' ? 'in play' : 'before start' }}
        </span>
      </v-app-bar-title>
      <v-spacer />
      <TournamentSelectStub v-if="activeTournament" />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout">Sign out</v-btn>
      </template>
    </v-app-bar>

    <!-- Left nav: Matches is the primary area; Setup is deliberately subordinate. -->
    <v-navigation-drawer permanent width="200" :border="0" color="surface">
      <v-list density="compact" nav>
        <v-list-item
          :active="mode === 'matches'"
          active-class="border-s-primary"
          prepend-icon="mdi-table-tennis"
          title="Matches"
          :disabled="phase === 'none'"
          @click="mode = 'matches'"
        />
        <v-divider class="my-2" />
        <v-list-item
          :active="mode === 'setup'"
          prepend-icon="mdi-cog-outline"
          class="text-medium-emphasis"
          @click="mode = 'setup'"
        >
          <v-list-item-title class="text-body-2">Setup</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container>
        <!-- Matches: the dashboard is the screen. -->
        <MockContent v-if="mode === 'matches'" section="oversight" />

        <!-- Setup: the three setup sections as inner tabs. -->
        <template v-else>
          <v-tabs v-model="setupTab" density="comfortable" color="primary" class="mb-4">
            <v-tab
              v-for="t in setupTabs"
              :key="t.key"
              :value="t.key"
              :disabled="phase === 'none' && t.key !== 'tournaments'"
            >
              {{ t.title }}
            </v-tab>
          </v-tabs>
          <MockContent :section="phase === 'none' ? 'none' : setupTab" />
        </template>
      </v-container>
    </v-main>
  </v-layout>
</template>
