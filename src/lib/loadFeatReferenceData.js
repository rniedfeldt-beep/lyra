// Loads every extracted sourcebook feat file from the project-root
// /data/feats folder (CLAUDE.md > Feat reference data) — bibliographic
// data (source, page, prerequisites, full benefit text) distinct from
// src/data/feats/*.json, which holds only the live calc-engine effect
// hooks for feats Lyra actually has. import.meta.glob, same reasoning as
// loadSpellData.js: the file set grows as more sourcebooks get processed,
// and a new data/feats/<book>.json is picked up automatically.
const featModules = import.meta.glob('../../data/feats/*.json', { eager: true })

// Keyed by each entry's own printed "name" — the level-up feat picker
// joins against this by name to show prerequisites/benefit text next to
// the mechanical feat it's about to add, rather than duplicating rulebook
// text into src/data/feats/*.json.
export const featReferenceByName = {}

for (const path of Object.keys(featModules).sort()) {
  const mod = featModules[path]
  const entries = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : []
  for (const entry of entries) {
    featReferenceByName[entry.name] = entry
  }
}
