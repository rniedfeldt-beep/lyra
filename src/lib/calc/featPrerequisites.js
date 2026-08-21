// Checks a feat's prerequisites — the schema used throughout the
// project-root /data/feats/<book>.json reference catalog: { abilityScores,
// baseAttackBonus, skills, feats, classFeatures, casterLevel, other } —
// against Lyra's current computed sheet. Ability score, BAB, skill-rank,
// and known-feat prerequisites are checked automatically; classFeatures
// and other (free text like "Ability to spontaneously cast summon nature's
// ally" or "Race/region: ...") have no data source in this app to verify,
// so they resolve as unverifiable rather than being silently assumed true
// or false — a feat blocked only on an unverifiable prerequisite still
// needs a human to actually check the book.
function normalizeSkillLabel(label) {
  return label
    .toLowerCase()
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z]/g, '')
}

export function buildFeatQualificationContext({ abilityScores, progression, casterLevel, feats: knownFeats, skills }) {
  const skillRanksByLabel = {}
  for (const [id, skill] of Object.entries(skills)) {
    const label = skill.label ?? id.charAt(0).toUpperCase() + id.slice(1)
    skillRanksByLabel[normalizeSkillLabel(label)] = skill.ranks
  }
  return {
    abilityScores,
    bab: progression.bab,
    casterLevel,
    knownFeatNames: knownFeats.map((f) => f.name),
    skillRanksByLabel,
  }
}

// status: 'qualifies' (every prerequisite met), 'unqualified' (at least one
// definitely unmet), 'needs-check' (nothing definitely unmet, but at least
// one prerequisite can't be checked automatically).
export function checkFeatQualification(prerequisites, context) {
  const p = prerequisites ?? {}
  const results = []

  for (const req of p.abilityScores ?? []) {
    const ability = req.ability.toLowerCase()
    results.push({
      label: `${req.ability} ${req.minimum}`,
      met: (context.abilityScores[ability]?.score ?? 0) >= req.minimum,
    })
  }

  if (p.baseAttackBonus != null) {
    results.push({ label: `BAB +${p.baseAttackBonus}`, met: context.bab >= p.baseAttackBonus })
  }

  for (const req of p.skills ?? []) {
    results.push({
      label: `${req.skill} ${req.ranks} ranks`,
      met: (context.skillRanksByLabel[normalizeSkillLabel(req.skill)] ?? 0) >= req.ranks,
    })
  }

  if (p.casterLevel != null) {
    results.push({ label: `Caster level ${p.casterLevel}`, met: context.casterLevel >= p.casterLevel })
  }

  for (const req of p.feats ?? []) {
    const label = typeof req === 'string' ? req : (req.name ?? req.feat)
    results.push({ label, met: context.knownFeatNames.includes(label) })
  }

  for (const label of p.classFeatures ?? []) {
    results.push({ label, met: null })
  }

  for (const label of p.other ?? []) {
    results.push({ label, met: null })
  }

  const hasUnmet = results.some((r) => r.met === false)
  const hasUnverifiable = results.some((r) => r.met === null)
  const status = hasUnmet ? 'unqualified' : hasUnverifiable ? 'needs-check' : 'qualifies'
  return { results, status }
}
