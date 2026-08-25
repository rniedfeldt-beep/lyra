// Browser-side persistence for the card composer. Two layers:
//
// 1. localStorage — an immediate autosave of whatever's currently typed, per
//    spell name, plus the print queue. Survives a reload regardless of
//    environment; this is what "load it into the editor... rather than
//    starting blank" falls back to before a save has ever reached the repo.
// 2. The repo itself — data/spells/<file>.json's own "card" field, written
//    via the local dev/preview-only /api/cards/save endpoint (see
//    vite.config.js). That endpoint doesn't exist on the deployed static
//    site, so callers should expect saveCardToFile() to reject there and
//    fall back to copyCardJSON().

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

export function loadDraft(spellName) {
  const all = readJSON(DRAFT_KEY, {})
  return all[spellName] ?? null
}

export function saveDraft(spellName, card) {
  const all = readJSON(DRAFT_KEY, {})
  all[spellName] = card
  writeJSON(DRAFT_KEY, all)
}

export function loadQueue() {
  return readJSON(QUEUE_KEY, [])
}

export function saveQueue(queue) {
  writeJSON(QUEUE_KEY, queue)
}

export async function saveCardToFile({ fileName, spellName, card }) {
  const res = await fetch('/api/cards/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, spellName, card }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Save failed (HTTP ${res.status})`)
  return data
}

export async function copyCardJSON(card) {
  await navigator.clipboard.writeText(JSON.stringify(card, null, 2))
}
