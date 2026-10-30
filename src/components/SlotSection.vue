<script setup lang="ts">
// One timeslot's heading + responsive card grid (venue-ux R4): 3-up on
// tablet, 1-up on phone. Pure presentation — the cards arrive via the slot.
defineProps<{
  /** The slot's time label, e.g. 10:30. */
  label: string
  /** Optional day prefix for slots that are not today, e.g. "2 Mar · ". */
  day?: string
  /** Optional right-hand meta, e.g. "Now" / "Up next". */
  meta?: string
}>()
</script>

<template>
  <section class="slot-section">
    <div class="d-flex align-center ga-2 mt-4 mb-2">
      <span class="text-h6 font-weight-bold slot-time">{{ day }}{{ label }}</span>
      <v-chip v-if="meta" size="small" color="primary" variant="tonal" class="font-weight-bold">
        {{ meta }}
      </v-chip>
      <slot name="meta" />
    </div>
    <div class="card-grid">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.slot-time {
  font-variant-numeric: tabular-nums;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  align-items: stretch;
}
@media (max-width: 420px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
