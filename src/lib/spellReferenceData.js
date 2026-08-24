import { rawSpells, referenceSpells, spellFileCounts, spellFileIssueBreakdown } from './loadSpellData'
import { mergeSpellEntries, groupedSourceLabel, normalizeSourceKey } from './calc/spellReference'

export { spellFileCounts, spellFileIssueBreakdown }
export const spellGroups = mergeSpellEntries(rawSpells)
export const totalRawSpellCount = rawSpells.length
// Grouped for the filter dropdown (e.g. every Dragon Magazine issue
// collapses to one "Dragon Magazine" option) — individual spell printings
// still show their own full source text regardless of this grouping.
export const sourceBooks = [...new Set(rawSpells.map((s) => groupedSourceLabel(s.source)).filter(Boolean))].sort()

const spellGroupsByName = new Map(spellGroups.map((g) => [g.name.toLowerCase(), g]))
const referenceSpellsByName = new Map(referenceSpells.map((s) => [s.name.toLowerCase(), s]))

// Resolves a functionsAs reference ({ spellName, source }) to a printing-shaped
// object PrintingBlock can render directly, so an inline expansion looks exactly
// like any other printing. Two pools: a name already in the main spell list (e.g.
// Regenerate Light Wounds, cited by its own book's higher-level variants) returns
// that book's actual printing off the merged group; a name that's reference-only
// (excluded from spellGroups — see loadSpellData.js) gets a synthetic single
// printing built straight from its referenced-spells.json entry. Returns null only
// if the name isn't in either pool, which shouldn't happen for any functionsAs
// entry that carries a non-null source — the caller still handles it gracefully.
export function resolveFunctionsAs({ spellName, source }) {
  const key = spellName.toLowerCase()
  const group = spellGroupsByName.get(key)
  if (group) {
    const sourceKey = source ? normalizeSourceKey(source) : null
    return group.printings.find((p) => normalizeSourceKey(p.source) === sourceKey) ?? group.printings[0] ?? null
  }
  const refSpell = referenceSpellsByName.get(key)
  if (refSpell) {
    return {
      source: refSpell.source,
      page: refSpell.page ?? null,
      spellLevelDruid: null,
      note: null,
      full: refSpell,
      abilityType: refSpell.abilityType ?? 'spell',
      usage: refSpell.usage ?? null,
    }
  }
  return null
}
