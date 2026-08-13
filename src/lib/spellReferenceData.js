import { rawSpells, spellFileCounts } from './loadSpellData'
import { mergeSpellEntries } from './calc/spellReference'

export { spellFileCounts }
export const spellGroups = mergeSpellEntries(rawSpells)
export const totalRawSpellCount = rawSpells.length
export const sourceBooks = [...new Set(rawSpells.map((s) => s.source).filter(Boolean))].sort()
