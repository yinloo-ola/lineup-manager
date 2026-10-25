<script setup lang="ts">
// The umpire console (results slice R2): the group ties of the tournament this
// account umpires, each showing its entry gate. Entry itself lands with R5 —
// the button renders but the entry surface is not wired yet.
import { computed, onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  buildUmpireTieRows,
  LOCKED_REASON,
  type UmpireLineupInput,
  type UmpireTieRow
} from '@/domain/umpireView'

const auth = useAuthStore()
const rows = ref<UmpireTieRow[]>([])
const tournamentName = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(true)

const openRows = computed(() => rows.value.filter((r) => r.entryOpen))
const lockedRows = computed(() => rows.value.filter((r) => !r.entryOpen))

function fmt(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString()
}

async function load(): Promise<void> {
  errorMessage.value = null
  const tournamentId = auth.umpireTournamentId
  if (!tournamentId) {
    errorMessage.value = 'This account is not bound to a tournament.'
    loading.value = false
    return
  }
  try {
    const [tiesRes, lineupsRes, teamsRes, tourRes] = await Promise.all([
      supabase
        .from('ties')
        .select('id, scheduled_start, table_label, team_a, team_b, is_knockout')
        .eq('tournament_id', tournamentId)
        .order('scheduled_start'),
      supabase
        .from('lineups')
        .select('tie_id, team_id, status')
        .eq('tournament_id', tournamentId),
      supabase.from('teams').select('id, name').eq('tournament_id', tournamentId),
      supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle()
    ])
    for (const r of [tiesRes, lineupsRes, teamsRes, tourRes]) {
      if (r.error) throw r.error
    }
    tournamentName.value = (tourRes.data as { name: string } | null)?.name ?? null
    rows.value = buildUmpireTieRows({
      ties: ((tiesRes.data as Record<string, unknown>[]) ?? []).map((t) => ({
        tieId: t.id as string,
        scheduledStart: (t.scheduled_start as string | null) ?? null,
        table: (t.table_label as string | null) ?? undefined,
        teamIds: [t.team_a as string | null, t.team_b as string | null],
        isKnockout: (t.is_knockout as boolean | null) ?? false
      })),
      lineups: ((lineupsRes.data as Record<string, unknown>[]) ?? []).map((l) => ({
        tieId: l.tie_id as string,
        teamId: l.team_id as string,
        status: l.status as UmpireLineupInput['status']
      })),
      teamNameById: new Map(
        ((teamsRes.data as { id: string; name: string }[]) ?? []).map((t) => [t.id, t.name])
      )
    })
  } catch (e) {
    errorMessage.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>

    <v-card elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>Umpire console</v-card-title>
        <v-card-subtitle v-if="tournamentName">{{ tournamentName }}</v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <div v-if="loading" class="text-body-2">Loading…</div>

        <template v-else>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Enter results for a team match once both lineups are submitted.
          </p>

          <v-table v-if="openRows.length" density="comfortable">
            <thead>
              <tr>
                <th>Scheduled</th>
                <th>Table</th>
                <th>Teams</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in openRows" :key="r.tieId">
                <td>{{ fmt(r.scheduledStart) }}</td>
                <td>{{ r.table ?? '—' }}</td>
                <td>{{ r.teamAName }} vs {{ r.teamBName }}</td>
                <td class="text-right">
                  <v-btn size="small" color="primary" variant="tonal" disabled>
                    Enter results
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p v-else class="text-body-2">No team matches ready for entry.</p>

          <template v-if="lockedRows.length">
            <div class="text-h6 mt-6 mb-2">Waiting for lineups</div>
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>Scheduled</th>
                  <th>Table</th>
                  <th>Teams</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in lockedRows" :key="r.tieId">
                  <td>{{ fmt(r.scheduledStart) }}</td>
                  <td>{{ r.table ?? '—' }}</td>
                  <td>{{ r.teamAName }} vs {{ r.teamBName }}</td>
                  <td>
                    <v-chip size="small" variant="outlined" color="grey">{{ LOCKED_REASON }}</v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </template>
        </template>
      </v-card-text>
    </v-card>
  </v-container>
</template>
