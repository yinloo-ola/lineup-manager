<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { fetchManagerData, type ManagerData } from '@/services/managerService'

const auth = useAuthStore()
const router = useRouter()
const data = ref<ManagerData | null>(null)
const errorMessage = ref<string | null>(null)

const STATUS_COLORS: Record<string, string> = {
  'not-started': 'grey',
  draft: 'amber',
  submitted: 'green',
  invalidated: 'red'
}
function statusColor(s: string): string {
  return STATUS_COLORS[s] ?? 'grey'
}
function fmt(iso: string): string {
  return new Date(iso).toLocaleString()
}

async function load() {
  errorMessage.value = null
  if (!auth.teamId) {
    errorMessage.value = 'No team is assigned to this account.'
    return
  }
  try {
    data.value = await fetchManagerData(supabase, auth.teamId)
  } catch (e) {
    errorMessage.value = (e as Error).message
  }
}

async function signOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}

onMounted(load)
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>{{ data?.myTeamName ?? 'My team' }}</v-app-bar-title>
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="signOut">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
          {{ errorMessage }}
        </v-alert>

        <v-card elevation="2" rounded="lg" class="mb-6">
          <v-card-item>
            <v-card-title>Roster</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-table v-if="data && data.roster.length">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in data.roster" :key="p.id">
                  <td>{{ p.name }}</td>
                  <td>{{ p.gender }}</td>
                  <td>{{ p.age }}</td>
                </tr>
              </tbody>
            </v-table>
            <p v-else class="text-body-2">No players imported for this team yet.</p>
          </v-card-text>
        </v-card>

        <v-card elevation="2" rounded="lg">
          <v-card-item>
            <v-card-title>Ties</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list v-if="data && data.tieRows.length">
              <v-list-item v-for="t in data.tieRows" :key="t.tieId">
                <v-list-item-title>vs {{ t.opponentName }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ fmt(t.scheduledStart) }} &middot; cutoff {{ fmt(t.cutoff) }}
                </v-list-item-subtitle>
                <template #append>
                  <v-chip :color="statusColor(t.status)" variant="tonal" class="mr-2" size="small">
                    {{ t.status }}
                  </v-chip>
                  <v-chip :color="t.locked ? 'red' : 'green'" variant="tonal" size="small">
                    {{ t.locked ? 'locked' : 'open' }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <p v-else class="text-body-2">No ties scheduled.</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
