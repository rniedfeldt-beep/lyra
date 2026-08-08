// Applies feat-effect save bonuses on top of base saves + ability mods.
// A feat that touches saves declares a "save_bonus" effect; this engine
// reads it rather than any component special-casing a named feat.
export function computeSaves({ baseSaves, abilityScores, feats }) {
  const bonuses = { fort: [], ref: [], will: [] }
  for (const feat of feats) {
    for (const effect of feat.effects ?? []) {
      if (effect.type === 'save_bonus') {
        bonuses[effect.save].push({ source: feat.name, value: effect.value, bonusType: effect.bonusType })
      }
    }
  }

  const build = (save, abilityMod) => {
    const featTotal = bonuses[save].reduce((sum, b) => sum + b.value, 0)
    return {
      base: baseSaves[save],
      abilityMod,
      featBonus: featTotal,
      total: baseSaves[save] + abilityMod + featTotal,
      sources: bonuses[save],
    }
  }

  return {
    fort: build('fort', abilityScores.con.mod),
    ref: build('ref', abilityScores.dex.mod),
    will: build('will', abilityScores.wis.mod),
  }
}
