// Supabase-backed persistence for saved cards — same project, same
// permissive-RLS approach as the main app's storageAdapter.js (see
// CLAUDE.md > Persistence and sync), just a different table: spell_cards,
// one row per (character, spell_name), rather than the single
// character_state row. No localStorage fallback here — a saved card that
// silently only exists on one device defeats the point of "we both see
// all saved cards," so callers surface a real error instead of a fallback.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export const isSupabaseConfigured = Boolean(supabase)

// Always available regardless of what's actually been saved yet — Lyra and
// Vaelith exist as soon as the app loads, not only after a first save.
const DEFAULT_CHARACTERS = ['Lyra', 'Vaelith']

export async function fetchCharacters() {
  if (!supabase) return DEFAULT_CHARACTERS
  const { data, error } = await supabase.from('spell_cards').select('character')
  if (error) {
    console.warn('Supabase fetchCharacters failed:', error.message)
    return DEFAULT_CHARACTERS
  }
  const found = data.map((r) => r.character)
  return [...new Set([...DEFAULT_CHARACTERS, ...found])]
}

// Every saved card for one character — used both for the Saved Cards panel
// (load-for-revision) and to know, while searching/pasting, whether a
// spell already has a card so it isn't started blank.
export async function fetchCardsForCharacter(character) {
  if (!supabase || !character) return []
  const { data, error } = await supabase
    .from('spell_cards')
    .select('spell_name, mech, card, updated_at')
    .eq('character', character)
    .order('spell_name')
  if (error) {
    console.warn('Supabase fetchCardsForCharacter failed:', error.message)
    return []
  }
  return data
}

export async function saveCard(character, spellName, mech, card) {
  if (!supabase) throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL/ANON_KEY).')
  const { error } = await supabase.from('spell_cards').upsert(
    {
      character,
      spell_name: spellName,
      mech: mech ?? {},
      card: card ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'character,spell_name' },
  )
  if (error) throw error
}
