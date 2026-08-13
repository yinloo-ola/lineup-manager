<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const email = computed(() => auth.user?.email ?? '')

async function signOut() {
  await auth.signOut()
  // No guard fires without a navigation, so push explicitly to /login.
  router.push({ name: 'login' })
}
</script>

<template>
  <v-container>
    <v-app-bar flat color="surface">
      <v-app-bar-title>Lineup Manager</v-app-bar-title>
      <template #append>
        <v-btn variant="text" prepend-icon="mdi-logout" @click="signOut">Sign out</v-btn>
      </template>
    </v-app-bar>

    <v-row class="mt-4">
      <v-col>
        <v-card elevation="2" rounded="lg">
          <v-card-item>
            <v-card-title class="text-h5">Administrator home</v-card-title>
            <v-card-subtitle>Signed in as {{ email }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="text-body-1">
            The scaffold is live. Roster views, Tie Format authoring, and lineup submission arrive in
            later tickets.
          </v-card-text>
          <v-card-actions>
            <v-btn variant="tonal" color="primary" to="/import" prepend-icon="mdi-database-import">
              Import seed
            </v-btn>
            <v-btn variant="tonal" to="/provision" prepend-icon="mdi-account-plus">
              Provision manager
            </v-btn>
            <v-btn variant="tonal" to="/format" prepend-icon="mdi-format-list-bulleted">
              Author Tie Format
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
