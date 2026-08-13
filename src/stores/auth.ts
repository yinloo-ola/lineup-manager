import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Authentication store (Pinia, setup style). Backed by Supabase Auth.
//
// Role distinction (Administrator vs Team Manager) arrives in later tickets;
// for this scaffold, any authenticated user reaches the admin home page.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

  /** Load the existing session and subscribe to auth changes. Idempotent. */
  async function init() {
    if (!loading.value) return
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    loading.value = false
    supabase.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
    })
  }

  async function signIn(email: string, password: string) {
    error.value = null
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (signInError) {
      error.value = signInError.message
      throw signInError
    }
    user.value = data.user
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
  }

  return { user, loading, error, isAuthenticated, init, signIn, signOut }
})
