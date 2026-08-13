<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const password = ref('')
const confirm = ref('')
const show = ref(false)
const busy = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit() {
  errorMessage.value = null
  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirm.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  busy.value = true
  try {
    await auth.changePassword(password.value)
    // Route to the correct destination for this role (managers → /manager).
    router.push({ name: auth.isManager ? 'manager' : 'home' })
  } catch (e) {
    errorMessage.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card elevation="8" rounded="lg">
          <v-card-item>
            <v-card-title class="text-h5">Set a new password</v-card-title>
            <v-card-subtitle>Your administrator set a temporary password — choose your own.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-form @submit.prevent="onSubmit">
              <v-text-field
                v-model="password"
                label="New password"
                :type="show ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="show ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="show = !show"
              />
              <v-text-field
                v-model="confirm"
                label="Confirm new password"
                :type="show ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
              />
              <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-2">
                {{ errorMessage }}
              </v-alert>
              <v-btn type="submit" color="primary" block size="large" class="mt-4" :loading="busy">
                Update password
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
