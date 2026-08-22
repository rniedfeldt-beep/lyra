import { lyra, getItem, spellSlotsBaseTable } from './loadData'
import { animalCompanion } from './loadCreatureData'

// Static ingredients only — level/xp/hpRolls/skills/feats/abilityAdjustments
// live in characterProgress (Supabase) instead, so the actual sheet is
// computed reactively inside LiveStateProvider, not here.
export const character = lyra

export const resolvedItems = {
  armor: getItem(lyra.equipment.armor),
  shield: getItem(lyra.equipment.shield),
  ring: getItem(lyra.equipment.ring),
  cloak: getItem(lyra.equipment.cloak),
  necklace: getItem(lyra.equipment.necklace),
  weapon: getItem(lyra.equipment.weapon),
}

export { spellSlotsBaseTable }
export const companion = animalCompanion
