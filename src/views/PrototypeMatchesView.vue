<script setup lang="ts">
// PROTOTYPE — throwaway host for the Matches-dashboard variants (wayfinder
// ticket 07), framed in the settled variant-A shell. Three structurally
// different dashboards, switchable via ?variant=A|B|C and the floating bottom
// bar. Never merge; captured to a throwaway branch on decision.
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { activeTournament } from './prototype/mock'
import TournamentSelectStub from './prototype/TournamentSelectStub.vue'
import VariantAFixtureTable from './prototype/matches/VariantAFixtureTable.vue'
import VariantBStatusBoard from './prototype/matches/VariantBStatusBoard.vue'
import VariantCTimeslots from './prototype/matches/VariantCTimeslots.vue'

const VARIANTS = [
  { key: 'A', name: 'Fixture table', component: VariantAFixtureTable },
  { key: 'B', name: 'Status board', component: VariantBStatusBoard },
  { key: 'C', name: 'Timeslots', component: VariantCTimeslots }
] as const

const route = useRoute()
const router = useRouter()

const idx = computed(() => {
  const i = VARIANTS.findIndex((v) => v.key === route.query.variant)
  return i === -1 ? 0 : i
})
const current = computed(() => VARIANTS[idx.value])

function cycle(dir: 1 | -1): void {
  const next = VARIANTS[(idx.value + dir + VARIANTS.length) % VARIANTS.length]
  router.replace({ query: { ...route.query, variant: next.key } })
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, [contenteditable]')) return
  if (e.key === 'ArrowLeft') cycle(-1)
  if (e.key === 'ArrowRight') cycle(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <v-layout class="rounded">
    <v-navigation-drawer permanent width="230">
      <div class="pa-3 text-subtitle-2 text-medium-emphasis">Lineup Manager</div>
      <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament</div>
      <v-list-item active active-color="primary" prepend-icon="mdi-table-tennis" title="Matches" />
      <v-divider class="my-2" />
      <div class="px-4 pt-2 text-overline text-medium-emphasis">Tournament setup</div>
      <v-list-item
        v-for="i in [
          { title: 'Tournament settings', icon: 'mdi-tune-variant' },
          { title: 'Team match formats', icon: 'mdi-format-list-bulleted' },
          { title: 'Provision managers', icon: 'mdi-account-plus' }
        ]"
        :key="i.title"
        :prepend-icon="i.icon"
        class="text-medium-emphasis"
      >
        <v-list-item-title class="text-body-2">{{ i.title }}</v-list-item-title>
      </v-list-item>
    </v-navigation-drawer>

    <v-app-bar flat color="surface" elevation="1">
      <v-app-bar-title>
        Matches
        <span class="text-medium-emphasis text-body-2">· {{ activeTournament }}</span>
      </v-app-bar-title>
      <v-spacer />
      <TournamentSelectStub />
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container>
        <component :is="current.component" />
      </v-container>
    </v-main>
  </v-layout>

  <!-- Floating prototype switcher — obviously not part of the design. -->
  <div
    class="prototype-bar d-flex align-center ga-2"
    style="position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 9999"
  >
    <v-btn density="compact" icon="mdi-chevron-left" variant="flat" @click="cycle(-1)" />
    <span class="text-body-2 font-weight-medium" style="min-width: 160px; text-align: center">
      {{ current.key }} — {{ current.name }}
    </span>
    <v-btn density="compact" icon="mdi-chevron-right" variant="flat" @click="cycle(1)" />
  </div>
</template>

<style scoped>
.prototype-bar {
  background: rgb(33 33 33);
  color: white;
  border-radius: 999px;
  padding: 4px 10px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 30%);
}
</style>
