import { computeAbilityScores } from './abilities'
import { getProgression } from './progression'
import { computeSaves } from './saves'
import { computeAC } from './ac'
import { computeSkills } from './skills'
import { computeSpellSlots } from './spellSlots'
import { computeAttackRoutine } from './attackRoutine'

export function computeCharacterSheet({ character, feats, items, progressionTable, spellSlotsBaseTable }) {
  const characterFeats = feats
  const abilityScores = computeAbilityScores(character, characterFeats)
  const progression = getProgression(character.level, progressionTable)

  const saves = computeSaves({
    baseSaves: progression,
    abilityScores,
    feats: characterFeats,
  })

  const equippedItems = [
    items.armor && { ...items.armor, acBonusType: 'armor' },
    items.shield && { ...items.shield, acBonusType: 'shield' },
    items.ring,
  ].filter(Boolean)

  const ac = computeAC({ equippedItems, dexMod: abilityScores.dex.mod })

  const skills = computeSkills({
    skills: character.skills,
    abilityScores,
  })

  const spellSlots = computeSpellSlots({
    level: character.level,
    castingAbilityMod: abilityScores.wis.mod,
    spellSlotsBaseTable,
  })

  const attackRoutine = items.weapon
    ? computeAttackRoutine({ bab: progression.bab, strMod: abilityScores.str.mod, weapon: items.weapon })
    : null

  const initiative = abilityScores.dex.mod

  const speed = {
    base: character.speed.land,
    enhancement: character.speed.enhancementBonus,
    enhancementSource: character.speed.enhancementSource,
    total: character.speed.land + character.speed.enhancementBonus,
  }

  return {
    character,
    abilityScores,
    progression,
    saves,
    ac,
    skills,
    spellSlots,
    attackRoutine,
    initiative,
    speed,
    items,
    feats: characterFeats,
  }
}
