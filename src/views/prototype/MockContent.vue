<script setup lang="ts">
// PROTOTYPE — throwaway mock page bodies (wayfinder ticket 06). Do not commit.
import { phase, teamMatches } from './mock'

defineProps<{ section: string }>()
</script>

<template>
  <div>
    <!-- Empty / first-run state: no tournament exists yet. -->
    <template v-if="phase === 'none'">
      <v-card elevation="2" rounded="lg" class="pa-6 text-center" data-section="empty">
        <v-icon icon="mdi-trophy-outline" size="48" class="mb-2" />
        <div class="text-h6">No tournament yet</div>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Import a tournament to create your first one — its team events, teams, and team matches.
        </p>
        <v-btn color="primary" prepend-icon="mdi-database-import">Import tournament</v-btn>
      </v-card>
    </template>

    <template v-else>
      <!-- Oversight: lean binary dashboard per the walkthrough decisions. -->
      <div v-if="section === 'oversight'" data-section="oversight">
        <div class="d-flex ga-2 mb-4">
          <v-btn-toggle density="compact" color="primary" model-value="all">
            <v-btn value="all" size="small">All</v-btn>
            <v-btn value="not" size="small">Not submitted</v-btn>
            <v-btn value="past" size="small">Past cutoff</v-btn>
          </v-btn-toggle>
        </div>
        <v-card
          v-for="m in teamMatches"
          :key="m.sortKey"
          elevation="1"
          rounded="lg"
          class="mb-2"
        >
          <div class="d-flex align-center flex-wrap pa-3 ga-2">
            <div style="min-width: 260px">
              <div class="text-body-1 font-weight-medium">{{ m.teamA }} vs {{ m.teamB }}</div>
              <div class="text-caption text-medium-emphasis">
                Table {{ m.table }} · Group {{ m.group }} · Round {{ m.round }} · {{ m.scheduled }}
              </div>
            </div>
            <v-chip v-if="m.cutoffPassed" color="red" variant="tonal" size="small">Locked</v-chip>
            <v-spacer />
            <div class="d-flex align-center ga-2">
              <v-chip :color="m.aSubmitted ? 'green' : 'amber'" variant="tonal" size="small">
                {{ m.teamA }}: {{ m.aSubmitted ? 'Submitted' : 'Not submitted' }}
              </v-chip>
              <v-chip :color="m.bSubmitted ? 'green' : 'amber'" variant="tonal" size="small">
                {{ m.teamB }}: {{ m.bSubmitted ? 'Submitted' : 'Not submitted' }}
              </v-chip>
              <v-chip v-if="m.bNeedsAttention" color="red" variant="tonal" size="small">
                Needs attention
              </v-chip>
              <v-btn size="small" variant="text" prepend-icon="mdi-pencil-outline">Open</v-btn>
            </div>
          </div>
        </v-card>
      </div>

      <!-- Setup section stubs (fine as-is per the walkthrough; shown for shell context). -->
      <v-card v-else-if="section === 'tournaments'" elevation="1" rounded="lg" class="pa-4" data-section="tournaments" style="max-width: 480px">
        <div class="text-h6 mb-2">Tournament settings</div>
        <p class="text-caption text-medium-emphasis mb-4">
          Managing the tournament selected at the top right — switch there to manage another.
        </p>
        <v-text-field label="Name" model-value="Spring League 2026" density="compact" class="mb-2" />
        <v-text-field label="Start date" model-value="2026-04-11" density="compact" class="mb-4" hint="Formats freeze once the tournament starts" persistent-hint />
        <div class="d-flex ga-2">
          <v-btn color="primary" variant="tonal" size="small">Save</v-btn>
          <v-btn color="error" variant="text" size="small" prepend-icon="mdi-delete-outline">
            Delete tournament
          </v-btn>
        </div>
      </v-card>

      <v-card v-else-if="section === 'formats'" elevation="1" rounded="lg" class="pa-4" data-section="formats">
        <div class="text-h6 mb-2">Team match formats</div>
        <v-alert v-if="phase === 'started'" type="info" variant="tonal" density="compact" class="mb-3">
          Frozen — the tournament has started, so formats can no longer be amended.
        </v-alert>
        <v-list lines="two" density="compact">
          <v-list-item title="Men's Team" subtitle="5 matches · lead time 30 h" />
          <v-list-item title="Women's Team" subtitle="5 matches · lead time 30 h" />
        </v-list>
        <v-btn v-if="phase === 'before'" color="primary" variant="tonal" size="small" class="mt-2">
          Edit format
        </v-btn>
        <p v-if="phase === 'before'" class="text-caption text-medium-emphasis mt-2">
          An edit that would break submitted lineups shows its impact and asks for confirmation first.
        </p>
      </v-card>

      <v-card v-else elevation="1" rounded="lg" class="pa-4" data-section="provision">
        <div class="text-h6 mb-2">Provision managers</div>
        <p class="text-caption text-medium-emphasis mb-2">Emails pre-filled from the import — one per team.</p>
        <v-list lines="two" density="compact">
          <v-list-item title="Team Alpha" subtitle="alpha.manager@example.com (from import) · active" />
          <v-list-item title="Team Bravo" subtitle="bravo.manager@example.com (from import) · must change password" />
          <v-list-item title="Team Charlie" subtitle="charlie.manager@example.com (from import) · not provisioned yet" />
        </v-list>
        <v-btn color="primary" variant="tonal" size="small" class="mt-2" prepend-icon="mdi-account-plus">
          Provision selected
        </v-btn>
      </v-card>
    </template>
  </div>
</template>
