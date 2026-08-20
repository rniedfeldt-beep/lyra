import { getFeats } from '../loadData'
import { computeCharacterSheet } from '../calc/computeCharacterSheet'
import { collectDailyAbilities } from './dailyAbilities'

// Merges the live characterProgress (level, xp, hpRolls, skills,
// abilityAdjustments, feats, wild shape uses) onto the static character.json
// base, then re-runs the full compute pipeline. This is what makes leveling
// up actually change the sheet: everything downstream (HP, BAB, saves,
// skills, spell slots, AC) is a pure function of the merged character, so
// there's nothing else to recompute by hand.
export function computeEffectiveSheet({ character, items, progressionTable, spellSlotsBaseTable, characterProgress }) {
  const effectiveCharacter = {
    ...character,
    level: characterProgress.level,
    xp: characterProgress.xp,
    hpRolls: characterProgress.hpRolls,
    skills: characterProgress.skills,
    abilityAdjustments: characterProgress.abilityAdjustments,
    feats: characterProgress.feats,
    wildShape: { ...character.wildShape, usesPerDay: characterProgress.wildShapeUsesPerDay },
  }

  const feats = getFeats(characterProgress.feats)

  const sheet = computeCharacterSheet({
    character: effectiveCharacter,
    feats,
    items,
    progressionTable,
    spellSlotsBaseTable,
  })

  const dailyAbilities = collectDailyAbilities({ character: sheet.character, feats, items })

  return { sheet, dailyAbilities }
}
