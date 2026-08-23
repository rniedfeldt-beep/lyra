// Loads every extracted sourcebook spell file from the project-root
// /data/spells folder (Phase 6 ingestion — see CLAUDE.md > Spell extraction
// conventions). import.meta.glob rather than named imports (contrast
// loadCreatureData.js) because this file set keeps growing as more
// sourcebooks get processed — dropping in a new data/spells/<book>.json
// file is picked up automatically, no loader edit required.
import { groupedSourceLabel } from './calc/spellReference'

const spellModules = import.meta.glob('../../data/spells/*.json', { eager: true })

// { bookTitle: spellCount }, in file order — surfaced by the Spell Reference
// tab so a truncated or malformed extraction is easy to spot at a glance,
// per the instruction to report load counts per file. Keyed by each file's
// own "source" field run through groupedSourceLabel (so a multi-issue file
// like dragon-magazine.json reports as one "Dragon Magazine" title rather
// than whichever issue happened to be its first entry) rather than its
// filename, since that's what's actually useful to read; falls back to the
// filename only if a file loaded with no entries at all to parse a title from.
// Counts every raw entry the file has, even ones later skipped by
// validateSpellEntry below, since this is a truncation check — "did the
// file load N entries" — separate from "were they well-formed."
export const spellFileCounts = {}

// { bookTitle: { issueSource: count } } — only populated for a file whose
// entries span more than one distinct literal "source" (i.e. a multi-issue
// anthology like dragon-magazine.json, grouped above under one bookTitle).
// Lets the Sourcebooks panel expand that one row into the actual issues it
// contains instead of crediting them all to a single arbitrary issue.
export const spellFileIssueBreakdown = {}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// otherPrintings entries are minor citations, not the spell's own data —
// one malformed citation shouldn't drop the whole spell, so this filters
// rather than rejects.
function sanitizeOtherPrintings(otherPrintings, context) {
  if (otherPrintings == null) return []
  if (!Array.isArray(otherPrintings)) {
    console.warn(`Spell data: "${context}" has a non-array otherPrintings — dropped.`, otherPrintings)
    return []
  }
  return otherPrintings.filter((op) => {
    if (isPlainObject(op) && typeof op.source === 'string' && op.source.trim()) return true
    console.warn(`Spell data: "${context}" has a malformed otherPrintings entry — skipped.`, op)
    return false
  })
}

const STRING_FIELDS = [
  'source',
  'description',
  'note',
  'school',
  'subschool',
  'castingTime',
  'range',
  'duration',
  'savingThrow',
  'spellResistance',
  'usage',
  'abilityType',
]
const ARRAY_FIELDS = ['descriptors', 'components']

// Validates the field shapes the render pipeline (SpellReferenceTab.jsx,
// src/lib/calc/spellReference.js) actually assumes — a string where a
// string is read, an array where one is mapped/joined, an object for
// targetAreaEffect. Returns the entry (with otherPrintings sanitized) or
// null. A null here means the entry is dropped and logged rather than
// pushed into rawSpells, so one malformed entry in one file can't reach
// rendering and blank the whole tab — the root-cause fix and the
// skip-and-log behavior are the same check.
function validateSpellEntry(entry, fileName) {
  if (!isPlainObject(entry)) {
    console.warn(`Spell data: an entry in ${fileName} is not an object — skipped.`, entry)
    return null
  }
  if (typeof entry.name !== 'string' || !entry.name.trim()) {
    console.warn(`Spell data: an entry in ${fileName} has no valid "name" — skipped.`, entry)
    return null
  }
  for (const field of STRING_FIELDS) {
    if (entry[field] != null && typeof entry[field] !== 'string') {
      console.warn(`Spell data: "${entry.name}" in ${fileName} has a non-string "${field}" — skipped.`, entry[field])
      return null
    }
  }
  for (const field of ARRAY_FIELDS) {
    if (entry[field] != null && !Array.isArray(entry[field])) {
      console.warn(`Spell data: "${entry.name}" in ${fileName} has a non-array "${field}" — skipped.`, entry[field])
      return null
    }
  }
  if (entry.targetAreaEffect != null && !isPlainObject(entry.targetAreaEffect)) {
    console.warn(
      `Spell data: "${entry.name}" in ${fileName} has a malformed "targetAreaEffect" — skipped.`,
      entry.targetAreaEffect,
    )
    return null
  }
  if (entry.spellLevelDruid != null && typeof entry.spellLevelDruid !== 'number') {
    console.warn(
      `Spell data: "${entry.name}" in ${fileName} has a non-numeric "spellLevelDruid" — skipped.`,
      entry.spellLevelDruid,
    )
    return null
  }
  return { ...entry, otherPrintings: sanitizeOtherPrintings(entry.otherPrintings, `${entry.name} (${fileName})`) }
}

const rawSpells = []
for (const path of Object.keys(spellModules).sort()) {
  const fileName = path.split('/').pop()
  const mod = spellModules[path]
  const entries = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : []
  const bookTitle = groupedSourceLabel(entries[0]?.source) ?? fileName
  spellFileCounts[bookTitle] = entries.length

  const issueCounts = {}
  for (const entry of entries) {
    if (typeof entry?.source === 'string' && entry.source.trim()) {
      issueCounts[entry.source] = (issueCounts[entry.source] ?? 0) + 1
    }
  }
  if (Object.keys(issueCounts).length > 1) {
    spellFileIssueBreakdown[bookTitle] = issueCounts
  }

  for (const entry of entries) {
    const valid = validateSpellEntry(entry, fileName)
    if (valid) rawSpells.push(valid)
  }
}

export { rawSpells }
