export function abilityMod(score) {
  return Math.floor((score - 10) / 2)
}

// Combines the character's true base scores with any active ability-score
// adjustments (feat effects, items, DM rulings) into effective scores.
// Nothing here is hardcoded per-score — add an adjustment source and the
// effective score and every derived stat recomputes.
export function computeAbilityScores(character, feats) {
  const totals = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
  const sources = { str: [], dex: [], con: [], int: [], wis: [], cha: [] }

  for (const feat of feats) {
    for (const effect of feat.effects ?? []) {
      if (effect.type === 'ability_bonus') {
        totals[effect.ability] += effect.value
        sources[effect.ability].push({ source: feat.name, value: effect.value, bonusType: effect.bonusType })
      }
    }
  }

  for (const adj of character.abilityAdjustments ?? []) {
    if (adj.active) {
      totals[adj.ability] += adj.value
      sources[adj.ability].push({ source: adj.source, value: adj.value, bonusType: adj.bonusType })
    }
  }

  const scores = {}
  for (const ability of Object.keys(character.trueBaseAbilityScores)) {
    const base = character.trueBaseAbilityScores[ability]
    const score = base + totals[ability]
    scores[ability] = {
      base,
      adjustment: totals[ability],
      score,
      mod: abilityMod(score),
      sources: sources[ability],
    }
  }
  return scores
}
