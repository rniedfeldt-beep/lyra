function humanizeSkillId(skillId) {
  const spaced = skillId.replace(/([A-Z])/g, ' $1')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Skill totals = ranks + ability mod + miscBonus. Each skill also carries its
// own conditionalBonuses (value + condition text) — these are situational,
// so they're reported alongside the flat total rather than folded into it.
export function computeSkills({ skills, abilityScores }) {
  const result = {}
  for (const [skillId, skill] of Object.entries(skills)) {
    const mod = abilityScores[skill.ability].mod
    const miscBonus = skill.miscBonus ?? 0
    const total = skill.ranks + mod + miscBonus

    result[skillId] = {
      label: skill.label ?? humanizeSkillId(skillId),
      ability: skill.ability,
      ranks: skill.ranks,
      abilityMod: mod,
      miscBonus,
      total,
      conditionalBonuses: (skill.conditionalBonuses ?? []).map((c) => ({
        value: c.value,
        condition: c.condition,
        total: total + c.value,
      })),
    }
  }
  return result
}
