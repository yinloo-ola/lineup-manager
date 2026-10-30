<script setup lang="ts">
// The collapsible shelf for matches outside the working window (venue-ux R5):
// always shows the count, renders its body only when expanded. A labelled
// disclosure — keyboard-operable, aria-expanded, and the same filters reach
// inside because the body is just more slot sections.
import { ref } from 'vue'

defineProps<{ count: number }>()
const open = ref(false)
</script>

<template>
  <div data-testid="shelf" class="shelved-panel mt-6">
    <button
      type="button"
      class="shelf-head"
      :aria-expanded="open"
      @click="open = !open"
    >
      <v-icon size="small">{{ open ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      Shelved
      <v-chip size="x-small" variant="tonal" class="font-weight-bold">{{ count }} matches</v-chip>
      <v-spacer />
      <span class="text-caption text-medium-emphasis">earlier slots &amp; beyond the window</span>
    </button>
    <div v-if="open" class="shelf-body px-3 pb-3">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shelved-panel {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 13px;
  background: rgb(var(--v-theme-surface-raised));
  overflow: hidden;
}
.shelf-head {
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
