import { computeAbilityScores } from './abilities'
import { computeProgression } from './progression'
import { computeSaves } from './saves'
import { computeAC } from './ac'
import { computeSkills } from './skills'
import { computeSpellSlots } from './spellSlots'
import { computeAttackRoutine } from './attackRoutine'
import { computeMaxHp, collectFeatHpBonus, classLevelsBreakdown } from './leveling'
import { druidLevel } from '../rules/dnd35'

export function computeCharacterSheet({ character, feats, items, spellSlotsBaseTable }) {
  const characterFeats = feats
  const abilityScores = computeAbilityScores(character, characterFeats)
  const progression = computeProgression(character.level)

  // HP, caster level, and class-level breakdown are derived from
  // character.level (+ hpRolls/Con) rather than trusted as static fields, so
  // leveling up recomputes them automatically. Wild shape uses/day is NOT
  // recomputed here — it's an uncertain-beyond-level-9 value the level-up
  // flow suggests and the player confirms, then it's carried on
  // character.wildShape.usesPerDay like any other live field.
  const maxHp = computeMaxHp(character.hpRolls, abilityScores.con.mod, collectFeatHpBonus(characterFeats))

  character = {
    ...character,
    hp: { ...character.hp, max: maxHp },
    casterLevel: { ...character.casterLevel, druid: character.level },
    druidLevel: druidLevel(character.level),
    classes: classLevelsBreakdown(character.level, druidLevel),
  }

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
  const spellAttackBonus = progression.bab + abilityScores.wis.mod

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
    spellAttackBonus,
    speed,
    items,
    feats: characterFeats,
  }
}
