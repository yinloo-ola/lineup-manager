<script setup lang="ts">
// Provision managers (spec §7 / ticket #17): each team's manager email arrives
// pre-filled from the import (seed v1 guarantees one per team) — provisioning
// confirms/activates those accounts rather than typing emails from scratch. The
// per-manager state is visible at a glance; account creation goes through the
// provision-manager edge function (service role stays server-side).
import { computed, onMounted, ref, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { useTournamentStore } from '@/stores/tournament'
import {
  managerEmailError,
  provisionState,
  provisionSummary,
  type ProvisionTeam
} from '@/domain/provisionView'
import { fetchProvisionTeams, updateTeamManagerEmail } from '@/services/provisionService'

const tournaments = useTournamentStore()
const teams = ref<ProvisionTeam[]>([])
const errorMessage = ref<string | null>(null)
const result = ref<{ ok: boolean; message: string } | null>(null)

const summary = computed(() => provisionSummary(teams.value))

const STATE_PRESENTATION = {
  active: { label: 'Active', color: 'green' },
  'must-change-password': { label: 'Must change password', color: 'amber' },
  'not-provisioned': { label: 'Not provisioned yet', color: 'grey' }
} as const

/** Teams joined with their derived state + presentation, once per reload. */
const rows = computed(() =>
  teams.value.map((t) => ({
    team: t,
    state: provisionState(t),
    presentation: STATE_PRESENTATION[provisionState(t)]
  }))
)

// --- the provision dialog (one team at a time) ---
const dialogTeam = ref<ProvisionTeam | null>(null)
const email = ref('')
const password = ref('')
const busy = ref(false)

const emailError = computed(() => {
  if (!dialogTeam.value) return null
  const others = teams.value
    .filter((t) => t.teamId !== dialogTeam.value!.teamId)
    .map((t) => t.managerEmail ?? '')
    .filter((e) => e !== '')
  return managerEmailError(email.value, others)
})

function openDialog(t: ProvisionTeam): void {
  dialogTeam.value = t
  email.value = t.managerEmail ?? ''
  password.value = ''
  result.value = null
}

async function onProvision(): Promise<void> {
  const t = dialogTeam.value
  const tournamentId = tournaments.activeId
  if (!t || !tournamentId || emailError.value || !password.value) return
  busy.value = true
  try {
    const corrected = email.value.trim()
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      userId?: string
    }>('provision-manager', {
      body: { email: corrected, password: password.value, teamId: t.teamId }
    })
    if (error) {
      result.value = { ok: false, message: error.message }
      return
    }
    if (data?.error) {
      result.value = { ok: false, message: data.error }
      return
    }
    // Persist a corrected email only after the account exists, so a failed
    // provisioning never overwrites the seeded value.
    if (corrected !== (t.managerEmail ?? '')) {
      await updateTeamManagerEmail(supabase, tournamentId, t.teamId, corrected)
    }
    dialogTeam.value = null
    result.value = {
      ok: true,
      message: `Team Manager created for ${t.teamName} (${corrected}) — they must change the password on first login.`
    }
    await load()
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    busy.value = false
  }
}

async function load(): Promise<void> {
  errorMessage.value = null
  if (!tournaments.activeId) {
    teams.value = []
    return
  }
  try {
    teams.value = await fetchProvisionTeams(supabase, tournaments.activeId)
  } catch (e) {
    errorMessage.value = (e as Error).message
  }
}

// Re-scope when the administrator switches tournament.
watch(() => tournaments.activeId, load)

onMounted(load)
</script>

<template>
  <v-container>
    <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4">
      {{ errorMessage }}
    </v-alert>
    <v-alert
      v-if="result"
      :type="result.ok ? 'success' : 'error'"
      variant="tonal"
      class="mt-4"
      closable
      @click:close="result = null"
    >
      {{ result.message }}
    </v-alert>

    <v-card elevation="2" rounded="lg" class="mt-4">
      <v-card-item>
        <v-card-title>Provision managers</v-card-title>
        <v-card-subtitle>
          {{ summary.total === 0
            ? 'This tournament has no teams yet.'
            : summary.allProvisioned
              ? `All ${summary.total} team(s) provisioned — ${summary.active} active, ${summary.mustChangePassword} still to change their first password.`
              : `${summary.total - summary.notProvisioned} of ${summary.total} team(s) provisioned.` }}
        </v-card-subtitle>
      </v-card-item>
      <v-divider />
      <v-card-text>
        <v-alert v-if="summary.allProvisioned && summary.total > 0" type="success" variant="tonal" density="compact" class="mb-4">
          Every team has a Team Manager.
        </v-alert>
        <p class="text-body-2 text-medium-emphasis mb-4">
          Manager emails arrive pre-filled from the import; correct one only to fix a typo.
          Each manager must change their password on first login.
        </p>

        <v-table v-if="teams.length" density="comfortable">
          <thead>
            <tr>
              <th>Team</th>
              <th>Manager email</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.team.teamId">
              <td>{{ r.team.teamName }}</td>
              <td>
                <span v-if="r.team.managerEmail">{{ r.team.managerEmail }}</span>
                <span v-else class="text-medium-emphasis">— (not in the import)</span>
              </td>
              <td>
                <v-chip :color="r.presentation.color" variant="tonal" size="small">
                  {{ r.presentation.label }}
                </v-chip>
              </td>
              <td class="text-right">
                <v-btn
                  v-if="r.state === 'not-provisioned'"
                  size="small"
                  color="primary"
                  variant="tonal"
                  @click="openDialog(r.team)"
                >
                  Provision
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
        <p v-else class="text-body-2">No teams yet.</p>
      </v-card-text>
    </v-card>

    <!-- Provision dialog: seeded email (correctable) + initial password -->
    <v-dialog :model-value="dialogTeam != null" max-width="480" @update:model-value="dialogTeam = null">
      <v-card rounded="lg">
        <v-card-item>
          <v-card-title>Provision {{ dialogTeam?.teamName }}</v-card-title>
          <v-card-subtitle>
            The manager must change the password on first login.
          </v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-text-field
            v-model="email"
            label="Manager email"
            type="email"
            autofocus
            :error-messages="emailError ?? []"
          />
          <v-text-field v-model="password" label="Initial password" type="password" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogTeam = null">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="busy"
            :disabled="!!emailError || !password"
            @click="onProvision"
          >
            Provision
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
