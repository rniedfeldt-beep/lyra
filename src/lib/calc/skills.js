function humanizeSkillId(skillId) {
  const spaced = skillId.replace(/([A-Z])/g, ' $1')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

// Skill totals = ranks + ability mod + miscBonus (+ armor check penalty, for
// the skills it applies to). Every skill in the 3.5 skill list gets an entry,
// not just the ones Lyra has ranks in, so an untrained check's modifier is
// visible too; `skills` (character.skills) supplies her ranks, misc bonuses
// and label overrides. Each skill also carries its own conditionalBonuses
// (value + condition text) — situational, so reported alongside the flat
// total rather than folded into it.
//
// armorCheckPenalty is the summed (negative) penalty from worn armor and
// shield; skillTable says which skills it applies to and at what multiple
// (Swim takes double).
export function computeSkills({ skills, abilityScores, skillTable = [], armorCheckPenalty = 0 }) {
  const tableById = Object.fromEntries(skillTable.map((s) => [s.id, s]))
  const ids = [...new Set([...skillTable.map((s) => s.id), ...Object.keys(skills)])]

  const result = {}
  for (const skillId of ids) {
    const known = skills[skillId]
    const entry = tableById[skillId]
    const ability = known?.ability ?? entry?.ability ?? null
    const ranks = known?.ranks ?? 0
    const mod = ability ? abilityScores[ability].mod : 0
    const miscBonus = known?.miscBonus ?? 0
    const acp = (entry?.armorCheckPenalty ?? 0) * armorCheckPenalty
    const total = ranks + mod + miscBonus + acp

    result[skillId] = {
      label: known?.label ?? entry?.label ?? humanizeSkillId(skillId),
      ability,
      ranks,
      trained: ranks > 0,
      trainedOnly: entry?.trainedOnly ?? false,
      abilityMod: mod,
      miscBonus,
      armorCheckPenalty: acp,
      // No ability means no check at all (Speak Language).
      total: ability ? total : null,
      conditionalBonuses: (known?.conditionalBonuses ?? []).map((c) => ({
        value: c.value,
        condition: c.condition,
        total: total + c.value,
      })),
    }
  }
  return result
}
