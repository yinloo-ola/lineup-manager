import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Authentication store (Pinia, setup style). Backed by Supabase Auth.
//
// Managers are bound 1:1 to a team via the team_managers table; on login we load
// that profile to drive the forced first-login password change. Administrators
// have no team_managers row, so mustChangePassword stays false for them.
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)
  const mustChangePassword = ref(false)
  const teamId = ref<string | null>(null)
  const isAdmin = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isManager = computed(() => teamId.value !== null)

  /** Load the signed-in user's manager profile (if any) + admin flag. */
  async function loadProfile(): Promise<void> {
    if (!user.value) {
      mustChangePassword.value = false
      teamId.value = null
      isAdmin.value = false
      return
    }
    // Fetch first, then commit — never blank a known profile mid-fetch.
    // auth.updateUser() fires onAuthStateChange, which calls loadProfile(); if
    // we nulled teamId synchronously here, a concurrent navigation (right after
    // a password change) would read isManager as false and misroute a manager
    // to the admin home.
    const [tm, adminRes] = await Promise.all([
      supabase
        .from('team_managers')
        .select('must_change_password, team_id')
        .eq('user_id', user.value.id)
        .maybeSingle(),
      supabase.rpc('is_admin')
    ])
    isAdmin.value = !!adminRes.data
    if (tm.data) {
      mustChangePassword.value = !!tm.data.must_change_password
      teamId.value = tm.data.team_id
    } else {
      mustChangePassword.value = false
      teamId.value = null
    }
  }

  /** Load the existing session and subscribe to auth changes. Idempotent. */
  async function init() {
    if (!loading.value) return
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    await loadProfile()
    loading.value = false
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      await loadProfile()
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
    await loadProfile()
  }

  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    mustChangePassword.value = false
    teamId.value = null
    isAdmin.value = false
  }

  /** Set a new password and clear the must-change flag. */
  async function changePassword(newPassword: string) {
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) throw updateError
    const { error: rpcError } = await supabase.rpc('clear_must_change_password')
    if (rpcError) throw rpcError
    mustChangePassword.value = false
  }

  return {
    user,
    loading,
    error,
    mustChangePassword,
    teamId,
    isAdmin,
    isAuthenticated,
    isManager,
    init,
    signIn,
    signOut,
    changePassword
  }
})
