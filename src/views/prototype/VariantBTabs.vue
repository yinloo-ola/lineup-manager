<script setup lang="ts">
// PROTOTYPE — Variant B: top tab bar, phase clusters side by side.
// Throwaway (wayfinder ticket 06). Do not commit.
import MockContent from './MockContent.vue'
import TournamentSelectStub from './TournamentSelectStub.vue'
import { activeSection, activeTournament, phase, type Section } from './mock'

const setupTabs: { section: Section; title: string }[] = [
  { section: 'tournaments', title: 'Tournament settings' },
  { section: 'formats', title: 'Formats' },
  { section: 'provision', title: 'Provision' }
]

function select(s: Section): void {
  activeSection.value = s
}
</script>

<template>
  <v-layout class="rounded">
    <v-app-bar flat color="surface" elevation="1">
      <v-app-bar-title>Lineup Manager</v-app-bar-title>
      <v-spacer />
      <TournamentSelectStub v-if="activeTournament" />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout">Sign out</v-btn>
      </template>
      <!-- Tabs live in the app-bar extension so the layout registers their
           height — a bare v-tabs sibling rendered invisibly behind the bar. -->
      <template v-if="phase !== 'none'" #extension>
        <v-tabs :model-value="activeSection" color="primary" density="comfortable" align-tabs="start">
          <v-tab value="oversight" prepend-icon="mdi-clipboard-list-outline" @click="select('oversight')">
            Oversight
          </v-tab>
          <v-divider vertical class="mx-3 my-2" />
          <v-tab
            v-for="t in setupTabs"
            :key="t.section"
            :value="t.section"
            @click="select(t.section)"
          >
            {{ t.title }}
            <v-icon
              v-if="t.section === 'formats' && phase === 'started'"
              icon="mdi-lock-outline"
              size="small"
              class="ml-1"
            />
          </v-tab>
        </v-tabs>
      </template>
    </v-app-bar>

    <v-main>
      <v-container>
        <div class="text-h6 mb-3">
          <template v-if="activeSection === 'oversight'">Oversight</template>
          <template v-else>{{ setupTabs.find((t) => t.section === activeSection)?.title }}</template>
        </div>
        <MockContent :section="activeSection" />
      </v-container>
    </v-main>
  </v-layout>
</template>
