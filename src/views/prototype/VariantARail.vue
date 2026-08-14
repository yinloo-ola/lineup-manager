<script setup lang="ts">
// PROTOTYPE — Variant A: persistent left rail, grouped by tournament phase.
// Throwaway (wayfinder ticket 06). Do not commit.
import { computed } from 'vue'
import MockContent from './MockContent.vue'
import TournamentSelectStub from './TournamentSelectStub.vue'
import { activeSection, activeTournament, phase, type Section } from './mock'

const setupItems: { section: Section; title: string; icon: string }[] = [
  { section: 'tournaments', title: 'Tournament settings', icon: 'mdi-tune-variant' },
  { section: 'formats', title: 'Team match formats', icon: 'mdi-format-list-bulleted' },
  { section: 'provision', title: 'Provision managers', icon: 'mdi-account-plus' }
]

const title = computed(() => {
  if (phase.value === 'none') return 'Getting started'
  const s = activeSection.value
  if (s === 'oversight') return 'Oversight'
  return setupItems.find((i) => i.section === s)?.title ?? ''
})
</script>

<template>
  <v-layout class="rounded">
    <v-navigation-drawer permanent width="230">
      <div class="pa-3 text-subtitle-2 text-medium-emphasis">Lineup Manager</div>
      <template v-if="phase !== 'none'">
        <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament</div>
        <v-list-item
          active
          :active-color="activeSection === 'oversight' ? 'primary' : undefined"
          prepend-icon="mdi-clipboard-list-outline"
          title="Oversight"
          @click="activeSection = 'oversight'"
        />
        <v-divider class="my-2" />
      </template>
      <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament setup</div>
      <v-list-item
        v-for="i in setupItems"
        :key="i.section"
        :active="activeSection === i.section"
        :prepend-icon="i.icon"
        :title="i.title"
        :append-icon="i.section === 'formats' && phase === 'started' ? 'mdi-lock-outline' : undefined"
        @click="activeSection = i.section"
      />
    </v-navigation-drawer>

    <v-app-bar flat color="surface" elevation="1">
      <v-app-bar-title>
        {{ title }}
        <span v-if="activeTournament" class="text-medium-emphasis text-body-2">
          · {{ activeTournament }}
        </span>
      </v-app-bar-title>
      <TournamentSelectStub v-if="activeTournament" />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container>
        <MockContent :section="activeSection" />
      </v-container>
    </v-main>
  </v-layout>
</template>
