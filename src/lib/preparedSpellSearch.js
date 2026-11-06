// Search helpers behind the Prepared Spells slots. Pure functions over the
// merged spell groups (spellReferenceData.js `spellGroups`) so they can be
// reasoned about without the Vite-only spell loader; loadSpellGroups() is
// the lazy bridge to that loader.
//
// The search is a convenience, never a requirement: a slot's text is free
// and is saved whether or not it matches anything here (the DM hands out
// spells from books that haven't been extracted).

let groupsPromise = null

// The spell data is the biggest chunk in the app, so it's pulled in with a
// dynamic import the first time a slot is rendered, then cached.
export function loadSpellGroups() {
  groupsPromise ??= import('./spellReferenceData').then((m) => m.spellGroups)
  return groupsPromise
}

// Case-insensitive, trimmed, with typographic apostrophes folded to plain
// ones — the data uses "Nature’s Purity" and a keyboard types "Nature's".
function norm(text) {
  return (text ?? '').replace(/[‘’]/g, "'").trim().toLowerCase()
}

export function findSpellGroup(groups, value) {
  const key = norm(value)
  if (!key) return null
  return groups.find((g) => norm(g.name) === key) ?? null
}

// Spells at this druid level matching what's been typed so far: names (or
// any word in them) that start with the query first, then names that merely
// contain it. A group counts as the slot's level if any printing prints it
// there. Nothing is offered until two characters are typed, and a query
// that already equals a spell's full name offers nothing — it's picked.
export function suggestSpells(groups, query, level, limit = 8) {
  const q = norm(query)
  if (q.length < 2) return []
  const starts = []
  const contains = []
  for (const g of groups) {
    if (!g.levels.includes(level)) continue
    const name = norm(g.name)
    if (name === q) return []
    if (name.startsWith(q) || name.split(/[\s-]+/).some((w) => w.startsWith(q))) starts.push(g)
    else if (name.includes(q)) contains.push(g)
  }
  return [...starts, ...contains].slice(0, limit)
}
