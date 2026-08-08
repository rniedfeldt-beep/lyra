import { lyra, getFeats, getItem, progressionTable, spellSlotsBaseTable } from './loadData'
import { animalCompanion } from './loadCreatureData'
import { computeCharacterSheet } from './calc/computeCharacterSheet'
import { collectDailyAbilities } from './liveState/dailyAbilities'

const characterFeats = getFeats(lyra.feats)

const resolvedItems = {
  armor: getItem(lyra.equipment.armor),
  shield: getItem(lyra.equipment.shield),
  ring: getItem(lyra.equipment.ring),
  cloak: getItem(lyra.equipment.cloak),
  necklace: getItem(lyra.equipment.necklace),
  weapon: getItem(lyra.equipment.weapon),
}

export const lyraSheet = computeCharacterSheet({
  character: lyra,
  feats: characterFeats,
  items: resolvedItems,
  progressionTable,
  spellSlotsBaseTable,
})

export const dailyAbilities = collectDailyAbilities({
  character: lyra,
  feats: characterFeats,
  items: resolvedItems,
})

export const companion = animalCompanion
