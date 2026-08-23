import { rawSpells, spellFileCounts, spellFileIssueBreakdown } from './loadSpellData'
import { mergeSpellEntries, groupedSourceLabel } from './calc/spellReference'

export { spellFileCounts, spellFileIssueBreakdown }
export const spellGroups = mergeSpellEntries(rawSpells)
export const totalRawSpellCount = rawSpells.length
// Grouped for the filter dropdown (e.g. every Dragon Magazine issue
// collapses to one "Dragon Magazine" option) — individual spell printings
// still show their own full source text regardless of this grouping.
export const sourceBooks = [...new Set(rawSpells.map((s) => groupedSourceLabel(s.source)).filter(Boolean))].sort()
