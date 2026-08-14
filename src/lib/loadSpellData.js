// Loads every extracted sourcebook spell file from the project-root
// /data/spells folder (Phase 6 ingestion — see CLAUDE.md > Spell extraction
// conventions). import.meta.glob rather than named imports (contrast
// loadCreatureData.js) because this file set keeps growing as more
// sourcebooks get processed — dropping in a new data/spells/<book>.json
// file is picked up automatically, no loader edit required.
const spellModules = import.meta.glob('../../data/spells/*.json', { eager: true })

// { bookTitle: spellCount }, in file order — surfaced by the Spell Reference
// tab so a truncated or malformed extraction is easy to spot at a glance,
// per the instruction to report load counts per file. Keyed by each file's
// own "source" field (every entry in a file shares one) rather than its
// filename, since that's what's actually useful to read; falls back to the
// filename only if a file loaded with no entries at all to parse a title from.
export const spellFileCounts = {}

const rawSpells = []
for (const path of Object.keys(spellModules).sort()) {
  const fileName = path.split('/').pop()
  const mod = spellModules[path]
  const entries = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : []
  const bookTitle = entries[0]?.source ?? fileName
  spellFileCounts[bookTitle] = entries.length
  rawSpells.push(...entries)
}

export { rawSpells }
