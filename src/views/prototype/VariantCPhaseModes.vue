<script setup lang="ts">
// PROTOTYPE — Variant C: two phase modes (Setup | Oversight); setup is a task
// launcher, not a persistent nav. Throwaway (wayfinder ticket 06). Do not commit.
import { computed, ref, watch } from 'vue'
import MockContent from './MockContent.vue'
import TournamentSelectStub from './TournamentSelectStub.vue'
import { activeTournament, phase } from './mock'

type Mode = 'setup' | 'oversight'
const mode = ref<Mode>(phase.value === 'none' ? 'setup' : 'oversight')
watch(phase, (p) => {
  mode.value = p === 'none' ? 'setup' : 'oversight'
})

const setupSection = ref<string>('tournaments')
const setupTasks = computed(() => [
  {
    key: 'tournaments',
    title: 'Tournament settings',
    icon: 'mdi-tune-variant',
    note: 'Rename, start date, delete — for the selected tournament'
  },
  {
    key: 'formats',
    title: 'Team match formats',
    icon: 'mdi-format-list-bulleted',
    note: phase.value === 'started' ? 'Frozen — tournament started' : '2 of 2 authored'
  },
  {
    key: 'provision',
    title: 'Provision managers',
    icon: 'mdi-account-plus',
    note: '2 managers provisioned'
  }
])
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

    <v-main>
      <v-container>
        <v-btn-toggle v-model="mode" mandatory color="primary" density="comfortable" class="mb-4">
          <v-btn value="setup" :disabled="phase === 'none' ? false : false">Setup</v-btn>
          <v-btn value="oversight" :disabled="phase === 'none'">Oversight</v-btn>
        </v-btn-toggle>

        <!-- Setup mode: a launcher of tasks, status marked per task. -->
        <template v-if="mode === 'setup'">
          <v-row>
            <v-col v-for="t in setupTasks" :key="t.key" cols="12" sm="6" md="3">
              <v-card
                elevation="1"
                rounded="lg"
                class="fill-height"
                :class="{ 'border-primary': setupSection === t.key }"
                @click="setupSection = t.key"
              >
                <v-card-item>
                  <template #prepend><v-icon :icon="t.icon" /></template>
                  <v-card-title class="text-body-1">{{ t.title }}</v-card-title>
                  <v-card-subtitle class="text-caption">{{ t.note }}</v-card-subtitle>
                </v-card-item>
              </v-card>
            </v-col>
          </v-row>
          <div class="mt-4">
            <MockContent :section="phase === 'none' ? 'none' : setupSection" />
          </div>
        </template>

        <!-- Oversight mode: the dashboard is the screen. -->
        <MockContent v-else section="oversight" />
      </v-container>
    </v-main>
  </v-layout>
</template>
