import { createClient } from '@supabase/supabase-js'

// Provisions the test administrator account against a running local Supabase.
// Email confirmation is disabled in supabase/config.toml, so the account can
// sign in immediately. Best-effort: ignores "already registered" on re-runs.

const url = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
// The well-known local Supabase demo anon key (matches .env.example).
const anonKey =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WlE3zzhIv_pE2z_aF1kEzvH7vVfW5Xa3hEFc'

export const TEST_ADMIN_EMAIL = 'admin@lineup.local'
export const TEST_ADMIN_PASSWORD = 'admin-password-123'

export default async function globalSetup() {
  const supabase = createClient(url, anonKey)
  const { error } = await supabase.auth.signUp({
    email: TEST_ADMIN_EMAIL,
    password: TEST_ADMIN_PASSWORD
  })
  if (error && !/already/i.test(error.message)) {
    throw new Error(`E2E global setup failed to create test admin: ${error.message}`)
  }
}
