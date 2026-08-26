// Browser-side localStorage helpers for the card composer — a safety net
// only, not the persistence layer. The real store is Supabase
// (supabaseCards.js): saved cards live there, shared between both players,
// and survive a reload on their own. What lives here is narrower:
//
// 1. An immediate autosave of whatever's currently typed, per (character,
//    spell), so navigating away before hitting Save doesn't lose it.
// 2. The print queue, which is genuinely local/per-device — there's no
//    reason two people printing different things need a shared queue.

const DRAFT_KEY = 'lyra-cards-drafts-v1'
const QUEUE_KEY = 'lyra-cards-queue-v1'

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* localStorage unavailable (private browsing, quota) — draft just won't survive a reload */
  }
}

function draftKey(character, spellName) {
  return `${character}::${spellName}`
}

export function loadDraft(character, spellName) {
  const all = readJSON(DRAFT_KEY, {})
  return all[draftKey(character, spellName)] ?? null
}

export function saveDraft(character, spellName, draft) {
  const all = readJSON(DRAFT_KEY, {})
  all[draftKey(character, spellName)] = draft
  writeJSON(DRAFT_KEY, all)
}

export function loadQueue() {
  return readJSON(QUEUE_KEY, [])
}

export function saveQueue(queue) {
  writeJSON(QUEUE_KEY, queue)
}
