<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'

interface Team {
  id: string
  name: string
}

const teams = ref<Team[]>([])
const teamId = ref<string | null>(null)
const email = ref('')
const password = ref('')
const busy = ref(false)
const result = ref<{ ok: boolean; message: string } | null>(null)

onMounted(async () => {
  const { data } = await supabase.from('teams').select('id, name').order('name')
  teams.value = (data as Team[] | null) ?? []
})

async function onProvision() {
  result.value = null
  if (!teamId.value || !email.value || !password.value) {
    result.value = { ok: false, message: 'Team, email, and initial password are required.' }
    return
  }
  busy.value = true
  try {
    const { data, error } = await supabase.functions.invoke<{
      ok?: boolean
      error?: string
      userId?: string
    }>('provision-manager', {
      body: { email: email.value, password: password.value, teamId: teamId.value }
    })
    if (error) result.value = { ok: false, message: error.message }
    else if (data?.error) result.value = { ok: false, message: data.error }
    else result.value = { ok: true, message: `Manager created for ${email.value}.` }
  } catch (e) {
    result.value = { ok: false, message: (e as Error).message }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>Provision manager</v-app-bar-title>
      <template #append>
        <v-btn variant="text" to="/">Home</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <v-card elevation="2" rounded="lg">
          <v-card-text>
            <p class="text-body-2 mb-4">
              Create a Team Manager account bound 1:1 to a team. The manager must set their own
              password on first login.
            </p>
            <v-select
              v-model="teamId"
              :items="teams"
              item-title="name"
              item-value="id"
              label="Team"
            />
            <v-text-field v-model="email" label="Manager email" type="email" />
            <v-text-field
              v-model="password"
              label="Initial password"
              hint="The manager will be forced to change this on first login."
              persistent-hint
            />
            <div class="mt-4">
              <v-btn
                color="primary"
                :loading="busy"
                :disabled="!teamId || !email || !password"
                @click="onProvision"
              >
                Provision
              </v-btn>
            </div>
            <v-alert
              v-if="result"
              :type="result.ok ? 'success' : 'error'"
              variant="tonal"
              class="mt-4"
            >
              {{ result.message }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
