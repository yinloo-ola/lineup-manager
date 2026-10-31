<script setup lang="ts">
// One team match as a venue card (venue-ux R4/R6): table, time, event, both
// teams and a state. The umpire variant offers Enter/Edit results; the admin
// variant (admin) adds per-side lineup chips and the Results button.
import { computed } from 'vue'

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
  /** False hides the admin Results button (knockout / TBD-side rows). */
  resultsAvailable?: boolean
  sides?: { teamName: string; status: string; needsAttention: boolean }[]
  isKnockout?: boolean
}

const props = defineProps<{ tie: MatchCardTie }>()
const emit = defineEmits<{ enter: []; results: [] }>()

/** One-breath summary for assistive tech. */
const cardLabel = computed(() => {
  const state =
    props.tie.state === 'decided'
      ? `decided — ${props.tie.teamAName} ${props.tie.tally?.[0]}, ${props.tie.teamBName} ${props.tie.tally?.[1]}; ${props.tie.winnerName} won`
      : props.tie.state === 'ready'
        ? 'ready for results entry'
        : props.tie.state === 'pending'
          ? 'waiting for lineups'
          : 'scheduled'
  const table = props.tie.table ? `table ${props.tie.table}, ` : ''
  return `${props.tie.teamAName} versus ${props.tie.teamBName}, ${table}${state}`
})

function sideLabel(status: string): string {
  if (status === 'submitted') return 'in'
  if (status === 'missed-cutoff') return 'missed cutoff'
  return 'no lineup'
}
</script>

<template>
  <div
    data-testid="match-card"
    :class="['match-card', { 'is-decided': tie.state === 'decided' }]"
    :aria-label="cardLabel"
  >
    <div class="d-flex align-baseline ga-2 text-body-2 text-medium-emphasis">
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

    <!-- A decided card's result line already names both sides — no second line. -->
    <div
      v-if="!(tie.state === 'decided' && tie.winnerName && tie.tally)"
      class="teams text-body-1 font-weight-bold"
    >
      {{ tie.teamAName }} <span class="vs text-caption text-medium-emphasis">vs</span>
      {{ tie.teamBName }}
    </div>

    <div v-if="tie.state === 'decided' && tie.winnerName && tie.tally" class="result-line text-body-1">
      <span :class="tie.teamAName === tie.winnerName ? 'winner' : 'loser'">
        <v-icon v-if="tie.teamAName === tie.winnerName" size="x-small">mdi-trophy</v-icon>{{ tie.teamAName }} ({{ tie.tally[0] }})
      </span>
      <span class="slash text-medium-emphasis">/</span>
      <span :class="tie.teamBName === tie.winnerName ? 'winner' : 'loser'">
        <v-icon v-if="tie.teamBName === tie.winnerName" size="x-small">mdi-trophy</v-icon>{{ tie.teamBName }} ({{ tie.tally[1] }})
      </span>
    </div>

    <div v-if="tie.admin && tie.sides" class="status-rail text-caption text-medium-emphasis">
      <span v-for="(s, i) in tie.sides" :key="i" class="d-inline-flex align-center ga-1">
        <v-icon size="x-small" :color="s.status === 'submitted' ? 'success' : s.status === 'missed-cutoff' ? 'error' : 'grey'">
          {{ s.status === 'submitted' ? 'mdi-check-circle' : s.status === 'missed-cutoff' ? 'mdi-alert-circle' : 'mdi-circle-outline' }}
        </v-icon>
        {{ s.teamName }} · {{ s.needsAttention ? 'Needs attention' : sideLabel(s.status) }}
        <v-icon v-if="s.needsAttention" size="x-small" color="warning">mdi-alert</v-icon>
      </span>
    </div>

    <div class="d-flex align-center ga-2 mt-1 card-foot">
      <template v-if="tie.state === 'decided'">
        <v-chip size="small" color="success" variant="tonal"><v-icon size="x-small" class="mr-1">mdi-check</v-icon>Decided</v-chip>
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
        <!-- Waiting state: the gate refuses results anyway — the card's action
             is the detail dialog (chase / fill the lineup on behalf). -->
        <v-chip size="small" color="warning" variant="tonal"><v-icon size="x-small" class="mr-1">mdi-timer-sand</v-icon>Lineups pending</v-chip>
      </template>

      <template v-else>
        <v-chip size="small" variant="tonal"><v-icon size="x-small" class="mr-1">mdi-calendar-clock</v-icon>Scheduled</v-chip>
        <v-spacer />
        <v-btn v-if="tie.admin && tie.resultsAvailable !== false" size="small" variant="tonal" data-testid="card-results" @click.stop="emit('results')">
          Results
        </v-btn>
      </template>
    </div>
  </div>
</template>

<style scoped>
.match-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 13px;
}
.card-foot {
  min-height: 44px;
}
.result-line {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.result-line > span:not(.slash) {
  padding: 1px 6px;
  border-radius: 6px;
}
.result-line .winner {
  font-weight: 800;
  color: rgb(var(--v-theme-success));
}
.result-line .loser {
  color: rgb(var(--v-theme-on-surface-muted));
}
.result-line .winner .v-icon {
  margin-right: 2px;
  vertical-align: -2px;
}
.status-rail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  row-gap: 4px;
}
.status-rail > span {
  min-width: 0;
}
.match-card.is-decided {
  opacity: 0.72;
}
/* Venue screens are used on tablets/phones — keep the foot actions 44px tall. */
.match-card :deep(.v-btn) {
  min-height: 44px;
}
.table-chip {
  font-weight: 700;
  font-size: 11px;
  line-height: 14px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-raised));
}
.teams .vs {
  padding: 0 2px;
}
.tally {
  font-variant-numeric: tabular-nums;
}
</style>
