// Standard 3.5e XP-to-level table: level N needs 1000 * (N-1) * N / 2 XP
// (the "increment grows by 1,000 each level" triangular progression — DMG
// p.135). A pure formula, not a lookup table, since it's regular and
// unbounded (works for any level, not just 1-20).
export function xpForLevel(level) {
  if (level <= 1) return 0
  return (1000 * (level - 1) * level) / 2
}

// Highest level whose XP threshold `xp` has met or passed.
export function levelForXp(xp) {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

export function xpToNextLevel(xp, currentLevel) {
  return Math.max(0, xpForLevel(currentLevel + 1) - xp)
}

// Progress toward the next level as a 0-1 fraction, measured from the
// current level's own threshold (not from 0) — matches how XP bars are
// normally drawn, each level's bar starts empty at that level's minimum.
export function xpProgressFraction(xp, currentLevel) {
  const floor = xpForLevel(currentLevel)
  const ceil = xpForLevel(currentLevel + 1)
  if (ceil <= floor) return 1
  return Math.min(1, Math.max(0, (xp - floor) / (ceil - floor)))
}

// 3.5e forbids spending XP that would drop you below your current level's
// minimum (DMG p.30, "XP shouldn't go below the minimum for a character's
// current level") — but a DM can rule otherwise, so this is a warning to
// surface and confirm, never a hard block.
export function wouldDropBelowCurrentLevelMinimum(currentXp, cost, currentLevel) {
  return currentXp - cost < xpForLevel(currentLevel)
}

// HP: sum of each level's own die roll + that level's Con modifier
// (current Con mod applied uniformly across the history — this app doesn't
// track historical ability scores separately, so a Con increase retroactively
// raises HP for every past level too; a known, deliberate simplification),
// plus any flat feat-granted bonus (Toughness et al., via hp_bonus effects).
export function computeMaxHp(hpRolls, conMod, featHpBonus) {
  const rollTotal = hpRolls.reduce((sum, r) => sum + r.roll, 0)
  const conTotal = hpRolls.length * conMod
  return rollTotal + conTotal + featHpBonus
}

export function collectFeatHpBonus(feats) {
  let bonus = 0
  for (const feat of feats) {
    for (const effect of feat.effects ?? []) {
      if (effect.type === 'hp_bonus') bonus += effect.value
    }
  }
  return bonus
}

// Skill points gained per level: 4 + Int mod (PHB druid), minimum 1.
export function skillPointsForLevel(intMod) {
  return Math.max(1, 4 + intMod)
}

// Max ranks a skill can carry at a given character level: level + 3 for a
// class skill, half that (rounded down) for cross-class (PHB p.63).
export function maxSkillRank(characterLevel, isClassSkill) {
  const classCap = characterLevel + 3
  return isClassSkill ? classCap : Math.floor(classCap / 2)
}

// Cost in skill points to buy one rank: 1 for a class skill, 2 (cross-class)
// otherwise.
export function skillRankCost(isClassSkill) {
  return isClassSkill ? 1 : 2
}

// Which class's skill list applies to the level being taken — CLAUDE.md >
// Class Progression: levels 1-5 are Druid, 6-15 are Planar Shepherd
// (capped at PS 10), 16-20 resume Druid.
export function classTakenAtLevel(characterLevel) {
  if (characterLevel <= 5) return 'druid'
  if (characterLevel <= 15) return 'planarShepherd'
  return 'druid'
}

export function isClassSkillFor(skillId, characterLevel, classSkillsTable) {
  const cls = classTakenAtLevel(characterLevel)
  return classSkillsTable[cls].skills.includes(skillId)
}

// Character levels at which a druid/any class gets a +1 ability score
// increase (PHB p.22, every 4 levels).
export const ABILITY_INCREASE_LEVELS = [4, 8, 12, 16, 20]

export function isAbilityIncreaseLevel(characterLevel) {
  return ABILITY_INCREASE_LEVELS.includes(characterLevel)
}

// Druid class levels breakdown for display ("Druid 5 / Planar Shepherd 4"),
// derived the same way druidLevel() is — never stored separately, so it
// can't drift out of sync with character.level.
export function classLevelsBreakdown(characterLevel, druidLevelFn) {
  const druid = druidLevelFn(characterLevel)
  const planarShepherd = characterLevel <= 5 ? 0 : Math.min(characterLevel - 5, 10)
  const classes = [{ name: 'Druid', levels: druid }]
  if (planarShepherd > 0) classes.push({ name: 'Planar Shepherd', levels: planarShepherd })
  return classes
}
