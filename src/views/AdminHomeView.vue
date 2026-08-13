<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const email = computed(() => auth.user?.email ?? '')

async function signOut() {
  await auth.signOut()
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
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
