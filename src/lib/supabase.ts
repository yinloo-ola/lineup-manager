import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Not fatal — the app still mounts; auth calls will simply fail with a clear error.
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.'
  )
}

// Fall back to the local Supabase defaults so the app mounts without env vars.
export const supabase = createClient(url ?? 'http://127.0.0.1:54321', anonKey ?? '')
