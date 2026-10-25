<script setup lang="ts">
// The umpire console (results slice R5): the group ties of the tournament this
// account umpires, each with its entry gate and derived entry state. Entry
// happens one tie at a time through UmpireEntryDialog; the save path is the
// upsert_umpire_result RPC (the gate is re-enforced server-side).
import { computed, onMounted, reactive, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  buildUmpireTieRows,
  LOCKED_REASON,
  type UmpireLineupInput,
  type UmpireTieRow
} from '@/domain/umpireView'
import type { GameScore, Side } from '@/domain/results'
import UmpireEntryDialog from '@/components/UmpireEntryDialog.vue'

const auth = useAuthStore()
const rows = ref<UmpireTieRow[]>([])
const tournamentName = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const loading = ref(true)

// Raw inputs the display rows don't carry but the entry dialog needs —
// kept out of buildUmpireTieRows, which is pure and renders only the list.
const data = reactive({
  tieTeamIds: new Map<string, [string, string]>(),
  lineups: [] as {
    tieId: string
    teamId: string
    status: UmpireLineupInput['status']
    playerIds: (string[] | null)[]
  }[],
  rosterNames: new Map<string, string>(),
  rubberCountByTie: new Map<string, number>(),
  bestOfByTie: new Map<string, number>(),
  storedByTie: new Map<
    string,
    ({ games: GameScore[]; walkover: boolean; walkoverSide: Side | null } | undefined)[]
  >()
})

const openRows = computed(() => rows.value.filter((r) => r.entryOpen))
const lockedRows = computed(() => rows.value.filter((r) => !r.entryOpen))

// --- the entry dialog ---
const entryOpen = ref(false)
const entryTie = ref<UmpireTieRow | null>(null)
const entryBestOf = ref(5)
const entryRubberCount = ref(0)
const entryPlayers = ref<[string[], string[]][]>([])
const entryStored = ref<{ games: GameScore[]; walkover: boolean; walkoverSide: Side | null }[]>([])

function fmt(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString()
}

function stateLabel(r: UmpireTieRow): string {
  if (r.state === 'decided') return `Decided · ${r.winnerName}`
  if (r.state === 'partial') return 'Partly entered'
  return ''
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
    const [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes] =
      await Promise.all([
        supabase
          .from('ties')
          .select(
            'id, scheduled_start, table_label, team_a, team_b, is_knockout, category_id, best_of'
          )
          .eq('tournament_id', tournamentId)
          .order('scheduled_start'),
        supabase
          .from('lineups')
          .select('tie_id, team_id, status, player_ids')
          .eq('tournament_id', tournamentId),
        supabase.from('teams').select('id, name').eq('tournament_id', tournamentId),
        supabase.from('players').select('id, name').eq('tournament_id', tournamentId),
        supabase.from('tie_formats').select('category_id, rubbers').eq('tournament_id', tournamentId),
        supabase
          .from('rubber_results')
          .select('tie_id, rubber_index, games, walkover, walkover_side')
          .eq('tournament_id', tournamentId),
        supabase.from('tournaments').select('name').eq('id', tournamentId).maybeSingle()
      ])
    for (const r of [tiesRes, lineupsRes, teamsRes, playersRes, formatsRes, resultsRes, tourRes]) {
      if (r.error) throw r.error
    }
    tournamentName.value = (tourRes.data as { name: string } | null)?.name ?? null

    const ties = (tiesRes.data as Record<string, unknown>[]) ?? []
    const rubberCountByCategory = new Map<string, number>()
    for (const f of (formatsRes.data as { category_id: string; rubbers: unknown }[]) ?? []) {
      if (Array.isArray(f.rubbers)) rubberCountByCategory.set(f.category_id, f.rubbers.length)
    }
    const rubberCountByTie = new Map<string, number>()
    const bestOfByTie = new Map<string, number>()
    data.tieTeamIds.clear()
    for (const t of ties) {
      rubberCountByTie.set(t.id as string, rubberCountByCategory.get(t.category_id as string) ?? 0)
      bestOfByTie.set(t.id as string, (t.best_of as number | null) ?? 5)
      data.tieTeamIds.set(t.id as string, [t.team_a as string, t.team_b as string])
    }

    const lineups = ((lineupsRes.data as Record<string, unknown>[]) ?? []).map((l) => ({
      tieId: l.tie_id as string,
      teamId: l.team_id as string,
      status: l.status as UmpireLineupInput['status'],
      playerIds: (l.player_ids as (string[] | null)[]) ?? []
    }))
    data.lineups = lineups
    data.rosterNames = new Map(
      ((playersRes.data as { id: string; name: string }[]) ?? []).map((p) => [p.id, p.name])
    )
    data.rubberCountByTie = rubberCountByTie
    data.bestOfByTie = bestOfByTie
    data.storedByTie.clear()
    for (const r of (resultsRes.data as Record<string, unknown>[]) ?? []) {
      const tieId = r.tie_id as string
      const arr = data.storedByTie.get(tieId) ?? []
      arr[(r.rubber_index as number) - 1] = {
        games: (r.games as GameScore[]) ?? [],
        walkover: (r.walkover as boolean) ?? false,
        walkoverSide: (r.walkover_side as Side | null) ?? null
      }
      data.storedByTie.set(tieId, arr)
    }

    rows.value = buildUmpireTieRows({
      ties: ties.map((t) => ({
        tieId: t.id as string,
        scheduledStart: (t.scheduled_start as string | null) ?? null,
        table: (t.table_label as string | null) ?? undefined,
        teamIds: [t.team_a as string | null, t.team_b as string | null],
        isKnockout: (t.is_knockout as boolean | null) ?? false
      })),
      lineups: lineups.map((l) => ({
        tieId: l.tieId,
        teamId: l.teamId,
        status: l.status
      })),
      teamNameById: new Map(
        ((teamsRes.data as { id: string; name: string }[]) ?? []).map((t) => [t.id, t.name])
      ),
      rubberCountByTie,
      bestOfByTie,
      results: ((resultsRes.data as Record<string, unknown>[]) ?? []).map((r) => ({
        tieId: r.tie_id as string,
        rubberIndex: r.rubber_index as number,
        games: (r.games as GameScore[]) ?? [],
        walkover: (r.walkover as boolean) ?? false,
        walkoverSide: (r.walkover_side as Side | null) ?? undefined
      }))
    })
  } catch (e) {
    errorMessage.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openEntry(r: UmpireTieRow): void {
  entryTie.value = r
  entryBestOf.value = data.bestOfByTie.get(r.tieId) ?? 5
  entryRubberCount.value = data.rubberCountByTie.get(r.tieId) ?? 0

  // Players prefill: the submitted lineups' selection per rubber, displayed
  // through the roster names (the server re-derives these on save).
  const teamIds = data.tieTeamIds.get(r.tieId) ?? ['', '']
  const byTeam = new Map(data.lineups.filter((l) => l.tieId === r.tieId).map((l) => [l.teamId, l.playerIds]))
  const namesFor = (teamId: string, i: number): string[] =>
    (byTeam.get(teamId)?.[i] ?? []).map((id) => data.rosterNames.get(id) ?? id)
  entryPlayers.value = Array.from({ length: entryRubberCount.value }, (_, i) => [
    namesFor(teamIds[0], i),
    namesFor(teamIds[1], i)
  ] as [string[], string[]])

  const stored = data.storedByTie.get(r.tieId) ?? []
  entryStored.value = Array.from({ length: entryRubberCount.value }, (_, i) => {
    const s = stored[i]
    return s
      ? { games: s.games, walkover: s.walkover, walkoverSide: s.walkoverSide }
      : { games: [], walkover: false, walkoverSide: null }
  })
  entryOpen.value = true
}

async function onSaved(): Promise<void> {
  await load()
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
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in openRows" :key="r.tieId">
                <td>{{ fmt(r.scheduledStart) }}</td>
                <td>{{ r.table ?? '—' }}</td>
                <td>{{ r.teamAName }} vs {{ r.teamBName }}</td>
                <td>{{ stateLabel(r) }}</td>
                <td class="text-right">
                  <v-btn
                    v-if="r.state !== 'decided'"
                    size="small"
                    color="primary"
                    variant="tonal"
                    @click="openEntry(r)"
                  >
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

    <UmpireEntryDialog
      v-model="entryOpen"
      :tie-id="entryTie?.tieId ?? ''"
      :team-a-name="entryTie?.teamAName ?? ''"
      :team-b-name="entryTie?.teamBName ?? ''"
      :best-of="entryBestOf"
      :rubber-count="entryRubberCount"
      :players="entryPlayers"
      :stored="entryStored"
      @saved="onSaved"
    />
  </v-container>
</template>
