<script setup lang="ts">
// PROTOTYPE — throwaway host for the admin-shell variants (wayfinder ticket 06).
// Three structurally different shells, switchable via ?variant=A|B|C and the
// floating bottom bar. Never commit; captured to a throwaway branch on decision.
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { land, phase, type MockPhase } from './prototype/mock'
import VariantARail from './prototype/VariantARail.vue'
import VariantBTabs from './prototype/VariantBTabs.vue'
import VariantCPhaseModes from './prototype/VariantCPhaseModes.vue'

const VARIANTS = [
  { key: 'A', name: 'Left rail', component: VariantARail },
  { key: 'B', name: 'Top tabs', component: VariantBTabs },
  { key: 'C', name: 'Phase modes', component: VariantCPhaseModes }
] as const

const PHASES: { key: MockPhase; label: string }[] = [
  { key: 'none', label: 'No tournament' },
  { key: 'before', label: 'Before start' },
  { key: 'started', label: 'Started' }
]

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

function setPhase(p: MockPhase): void {
  phase.value = p
  land()
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, [contenteditable]')) return
  if (e.key === 'ArrowLeft') cycle(-1)
  if (e.key === 'ArrowRight') cycle(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

land()
</script>

<template>
  <component :is="current.component" />

  <!-- Floating prototype switcher — obviously not part of the design. -->
  <div
    class="prototype-bar d-flex align-center ga-2"
    style="position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); z-index: 9999"
  >
    <v-btn density="compact" icon="mdi-chevron-left" variant="flat" @click="cycle(-1)" />
    <span class="text-body-2 font-weight-medium" style="min-width: 120px; text-align: center">
      {{ current.key }} — {{ current.name }}
    </span>
    <v-btn density="compact" icon="mdi-chevron-right" variant="flat" @click="cycle(1)" />
    <v-divider vertical class="mx-1" />
    <v-btn
      v-for="p in PHASES"
      :key="p.key"
      size="x-small"
      :variant="phase === p.key ? 'flat' : 'text'"
      :color="phase === p.key ? 'primary' : undefined"
      @click="setPhase(p.key)"
    >
      {{ p.label }}
    </v-btn>
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
