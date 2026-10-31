<script setup lang="ts">
// A collapsible group of slot sections under the working window (venue-ux):
// the Past group (earlier timeslots) and the Future group (beyond the window).
// Always shows the count; renders its body only when expanded. A labelled
// disclosure — keyboard-operable, aria-expanded — and the same filters reach
// inside because the body is just more slot sections.
import { computed, ref } from 'vue'

const props = defineProps<{
  /** The group's heading, e.g. Past / Future. */
  title: string
  count: number
  /** One-line caption on the right, e.g. "earlier timeslots". */
  caption?: string
}>()

const open = ref(false)
const countLabel = computed(() =>
  `${props.count} ${props.count === 1 ? 'match' : 'matches'}`
)
</script>

<template>
  <div class="match-group mt-6">
    <button
      type="button"
      class="group-head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <v-icon size="small">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      {{ title }}
      <v-chip size="x-small" variant="tonal" class="font-weight-bold">{{ countLabel }}</v-chip>
      <v-spacer />
      <span v-if="caption" class="text-caption text-medium-emphasis">{{ caption }}</span>
    </button>
    <div v-if="open" class="group-body px-3 pb-3">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.match-group {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 13px;
  background: rgb(var(--v-theme-surface-raised));
  overflow: hidden;
}
.group-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  background: transparent;
  border: 0;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  text-align: left;
}
</style>
