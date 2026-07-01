import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url) console.error('[Supabase] VITE_SUPABASE_URL is missing — check your .env file')
if (!key) console.error('[Supabase] VITE_SUPABASE_ANON_KEY is missing — check your .env file')

export const supabase = url && key ? createClient(url, key) : null

if (supabase) {
  console.log('[Supabase] client initialised — URL:', url)
} else {
  console.error('[Supabase] client NOT initialised — multiplayer will not work')
}

export function isSupabaseConfigured() {
  return Boolean(url && key)
}
