<script setup lang="ts">
// One team match as a venue card (venue-ux R4/R6): table, time, event, both
// teams and a state. The umpire variant offers Enter/Edit results; the admin
// variant (admin) adds per-side lineup chips and the Results button.
export interface MatchCardTie {
  tieId: string
  table?: string
  time?: string
  categoryName?: string
  categoryId?: string
  teamAName: string
  teamBName: string
  state: 'ready' | 'decided' | 'pending' | 'scheduled'
  /** Rubbers won per side when any results exist — rendered as 3–1. */
  tally?: [number, number]
  winnerName?: string
  admin?: boolean
  sides?: { teamName: string; status: string; needsAttention: boolean }[]
  isKnockout?: boolean
}

const props = defineProps<{ tie: MatchCardTie }>()
const emit = defineEmits<{ enter: []; results: [] }>()

function sideLabel(status: string): string {
  if (status === 'submitted') return 'in'
  if (status === 'missed-cutoff') return 'missed cutoff'
  return 'no lineup'
}
</script>

<template>
  <v-card
    data-testid="match-card"
    :class="['match-card', { 'is-decided': tie.state === 'decided' }]"
    rounded="lg"
    variant="outlined"
  >
    <div class="d-flex align-center ga-2 text-body-2 text-medium-emphasis">
      <span v-if="tie.table" class="table-chip">Table {{ tie.table }}</span>
      <span v-if="tie.time" class="font-weight-medium">{{ tie.time }}</span>
      <span v-if="tie.categoryName">{{ tie.categoryName }}</span>
      <v-spacer />
      <v-btn
        v-if="tie.isKnockout && tie.categoryId"
        size="x-small"
        variant="text"
        prepend-icon="mdi-git"
        data-testid="card-bracket"
        :to="{ name: 'bracket', params: { categoryId: tie.categoryId } }"
        @click.stop
      >
        Bracket
      </v-btn>
    </div>

    <div class="teams text-body-1 font-weight-bold">
      {{ tie.teamAName }} <span class="vs text-caption text-medium-emphasis">vs</span>
      {{ tie.teamBName }}
    </div>

    <div v-if="tie.admin && tie.sides" class="d-flex flex-wrap ga-3 text-caption text-medium-emphasis">
      <span v-for="(s, i) in tie.sides" :key="i" class="d-inline-flex align-center ga-1">
        <v-icon size="x-small" :color="s.status === 'submitted' ? 'success' : s.status === 'missed-cutoff' ? 'error' : 'grey'">
          {{ s.status === 'submitted' ? 'mdi-check-circle' : s.status === 'missed-cutoff' ? 'mdi-alert-circle' : 'mdi-circle-outline' }}
        </v-icon>
        {{ s.teamName }} · {{ s.needsAttention ? 'Needs attention' : sideLabel(s.status) }}
        <v-icon v-if="s.needsAttention" size="x-small" color="warning">mdi-alert</v-icon>
      </span>
    </div>

    <div class="d-flex align-center ga-2 mt-1" style="min-height: 40px">
      <template v-if="tie.state === 'decided'">
        <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-check">Decided</v-chip>
        <span class="font-weight-bold">{{ tie.winnerName }}</span>
        <span v-if="tie.tally" class="text-body-2 text-medium-emphasis tally">
          {{ tie.tally[0] }}–{{ tie.tally[1] }}
        </span>
        <v-spacer />
        <v-btn
          v-if="!tie.admin"
          size="small"
          variant="tonal"
          data-testid="edit-results"
          @click.stop="emit('enter')"
        >
          Edit results
        </v-btn>
        <v-btn v-else size="small" variant="tonal" data-testid="card-results" @click.stop="emit('results')">
          Results
        </v-btn>
      </template>

      <template v-else-if="tie.state === 'ready'">
        <v-spacer />
        <v-btn
          v-if="!tie.admin"
          color="primary"
          data-testid="enter-results"
          @click.stop="emit('enter')"
        >
          Enter results
        </v-btn>
        <v-btn v-else size="small" variant="tonal" data-testid="card-results" @click.stop="emit('results')">
          Results
        </v-btn>
      </template>

      <template v-else-if="tie.state === 'pending'">
        <v-chip size="small" color="warning" variant="tonal" prepend-icon="mdi-hourglass">
          Lineups pending
        </v-chip>
        <v-spacer />
        <v-btn v-if="tie.admin" size="small" variant="tonal" data-testid="card-results" @click.stop="emit('results')">
          Results
        </v-btn>
      </template>

      <template v-else>
        <v-chip size="small" variant="tonal" prepend-icon="mdi-calendar-clock">Scheduled</v-chip>
        <v-spacer />
        <v-btn v-if="tie.admin" size="small" variant="tonal" data-testid="card-results" @click.stop="emit('results')">
          Results
        </v-btn>
      </template>
    </div>
  </v-card>
</template>

<style scoped>
.match-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  height: 100%;
}
.match-card.is-decided {
  opacity: 0.72;
}
.table-chip {
  font-weight: 700;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 7px;
  background: rgb(var(--v-theme-surface-raised));
}
.teams .vs {
  padding: 0 2px;
}
.tally {
  font-variant-numeric: tabular-nums;
}
</style>
