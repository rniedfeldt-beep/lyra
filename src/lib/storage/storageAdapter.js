import { createClient } from '@supabase/supabase-js'

const LOCAL_STORAGE_KEY = 'lyra-live-state'
const ROW_ID = 1

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = Boolean(supabase)

function readLocal() {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
  return raw ? JSON.parse(raw) : null
}

function writeLocal(state) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state))
}

// Supabase is the source of truth when configured (see CLAUDE.md > Persistence),
// with localStorage as the offline fallback and a local mirror on every read/write.
export async function loadState() {
  if (supabase) {
    const { data, error } = await supabase
      .from('character_state')
      .select('state')
      .eq('id', ROW_ID)
      .maybeSingle()

    if (!error && data) {
      writeLocal(data.state)
      return { state: data.state, source: 'supabase' }
    }
    if (error) console.warn('Supabase load failed, falling back to local storage:', error.message)
  }

  const local = readLocal()
  return { state: local, source: local ? 'local' : 'none' }
}

export async function saveState(state) {
  writeLocal(state)

  if (supabase) {
    const { error } = await supabase
      .from('character_state')
      .upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })

    if (error) {
      console.warn('Supabase save failed, local copy retained:', error.message)
      return { source: 'local', error }
    }
    return { source: 'supabase' }
  }

  return { source: 'local' }
}
