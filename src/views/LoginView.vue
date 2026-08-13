<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit() {
  errorMessage.value = null
  submitting.value = true
  try {
    await auth.signIn(email.value, password.value)
    router.push({ name: 'home' })
  } catch (e) {
    errorMessage.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card elevation="8" rounded="lg">
          <v-card-item>
            <v-card-title class="text-h5">Lineup Manager</v-card-title>
            <v-card-subtitle>Administrator sign in</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-form @submit.prevent="onSubmit">
              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                autocomplete="username"
                prepend-inner-icon="mdi-email-outline"
                :rules="[(v) => !!v || 'Email is required']"
                required
              />
              <v-text-field
                v-model="password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                :rules="[(v) => !!v || 'Password is required']"
                required
                @click:append-inner="showPassword = !showPassword"
              />
              <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-2">
                {{ errorMessage }}
              </v-alert>
              <v-btn
                type="submit"
                color="primary"
                block
                size="large"
                class="mt-4"
                :loading="submitting"
              >
                Sign in
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
