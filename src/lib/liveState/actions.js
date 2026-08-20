// Pure state-transform functions. UI components call these through
// useLiveState().update(...) rather than mutating tracker state directly.
export function applyDamage(state, amount) {
  const { current, temp } = state.hp
  const tempAbsorbed = Math.min(temp, amount)
  return {
    ...state,
    hp: { current: current - (amount - tempAbsorbed), temp: temp - tempAbsorbed },
  }
}

export function applyHeal(state, amount, hpMax) {
  return { ...state, hp: { ...state.hp, current: Math.min(state.hp.current + amount, hpMax) } }
}

export function setCurrentHp(state, value) {
  return { ...state, hp: { ...state.hp, current: value } }
}

export function setTempHp(state, value) {
  return { ...state, hp: { ...state.hp, temp: Math.max(0, value) } }
}

export function setSpellSlotUsed(state, level, used) {
  return { ...state, spellSlotsUsed: { ...state.spellSlotsUsed, [level]: used } }
}

export function setPreparedSpell(state, level, index, value) {
  const slots = [...(state.preparedSpells[level] ?? [])]
  slots[index] = value
  return { ...state, preparedSpells: { ...state.preparedSpells, [level]: slots } }
}

export function setWildShapeUsed(state, used) {
  return { ...state, wildShapeUsed: used }
}

export function setDailyUse(state, id, used) {
  return { ...state, dailyUses: { ...state.dailyUses, [id]: used } }
}

export function setCompanionHp(state, current) {
  return { ...state, companionHp: { current } }
}

// Assuming a form costs 1 daily use, or 2 for elemental/outsider forms
// (CLAUDE.md > Wild Shape). Reverting never refunds the use it cost.
export function assumeWildShapeForm(state, creatureName, cost, maxUses) {
  return {
    ...state,
    wildShapeUsed: Math.min(maxUses, state.wildShapeUsed + cost),
    activeWildShapeForm: { creatureName, cost },
  }
}

export function revertWildShapeForm(state) {
  return { ...state, activeWildShapeForm: null }
}

// A summon is a group of one or more identical creatures from a single
// casting — shared stat block and duration, but each member takes damage
// separately (state.activeSummons[].members[]: { id, hp, tempHp, status }).
export function addActiveSummon(state, summon) {
  return { ...state, activeSummons: [...state.activeSummons, summon] }
}

export function updateSummonDuration(state, summonId, remainingRounds) {
  return {
    ...state,
    activeSummons: state.activeSummons.map((s) =>
      s.id === summonId ? { ...s, remainingRounds } : s,
    ),
  }
}

export function removeActiveSummon(state, summonId) {
  return { ...state, activeSummons: state.activeSummons.filter((s) => s.id !== summonId) }
}

export function updateSummonMember(state, summonId, memberId, updates) {
  return {
    ...state,
    activeSummons: state.activeSummons.map((s) =>
      s.id !== summonId
        ? s
        : { ...s, members: s.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)) },
    ),
  }
}

// Anarchic template overlay — a single active/inactive toggle (the Lyra-tab
// checkbox pays both the spell-slot and wild-shape-use costs at once; the
// cast/invoke-window distinction is documented as reference material on the
// Reference tab but isn't separately tracked in live state). smiteLawUsed is
// deliberately untouched by activateAnarchic/deactivateAnarchic: it's a
// 1/day resource independent of any one activation, only cleared by Long
// Rest (part of getDefaultLiveState).
export function activateAnarchic(state, durationMinutes) {
  return {
    ...state,
    anarchicTemplate: { ...state.anarchicTemplate, active: true, durationMinutesRemaining: durationMinutes },
  }
}

export function deactivateAnarchic(state) {
  return {
    ...state,
    anarchicTemplate: { ...state.anarchicTemplate, active: false, durationMinutesRemaining: 0 },
  }
}

export function setAnarchicDurationMinutes(state, minutes) {
  return {
    ...state,
    anarchicTemplate: { ...state.anarchicTemplate, durationMinutesRemaining: Math.max(0, minutes) },
  }
}

export function setAnarchicSmiteLawUsed(state, used) {
  return { ...state, anarchicTemplate: { ...state.anarchicTemplate, smiteLawUsed: used } }
}

// --- Leveling / characterProgress -----------------------------------------
// XP add/subtract are pure arithmetic; the "would drop below current level's
// minimum" guard (CLAUDE.md > XP) is a warn-and-confirm check the UI runs
// before calling subtractXp, not something enforced here.
export function addXp(state, amount) {
  return { ...state, characterProgress: { ...state.characterProgress, xp: state.characterProgress.xp + amount } }
}

export function subtractXp(state, amount) {
  return {
    ...state,
    characterProgress: { ...state.characterProgress, xp: Math.max(0, state.characterProgress.xp - amount) },
  }
}

export function addHpRoll(state, level, roll) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      hpRolls: [...state.characterProgress.hpRolls, { level, roll }],
    },
  }
}

export function updateHpRoll(state, level, roll) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      hpRolls: state.characterProgress.hpRolls.map((r) => (r.level === level ? { ...r, roll } : r)),
    },
  }
}

export function addAbilityAdjustment(state, adjustment) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      abilityAdjustments: [...state.characterProgress.abilityAdjustments, adjustment],
    },
  }
}

// index into characterProgress.abilityAdjustments — the array has no stable
// ids, so editing/removing addresses an entry positionally (fine: nothing
// reorders it elsewhere).
export function updateAbilityAdjustment(state, index, updates) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      abilityAdjustments: state.characterProgress.abilityAdjustments.map((a, i) =>
        i === index ? { ...a, ...updates } : a,
      ),
    },
  }
}

export function removeAbilityAdjustment(state, index) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      abilityAdjustments: state.characterProgress.abilityAdjustments.filter((_, i) => i !== index),
    },
  }
}

export function setBaseAbilityScore(state, ability, value) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      trueBaseAbilityScores: { ...state.characterProgress.trueBaseAbilityScores, [ability]: value },
    },
  }
}

export function addFeat(state, featId) {
  if (state.characterProgress.feats.includes(featId)) return state
  return {
    ...state,
    characterProgress: { ...state.characterProgress, feats: [...state.characterProgress.feats, featId] },
  }
}

export function addClassFeature(state, description) {
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      classFeatures: [...state.characterProgress.classFeatures, description],
    },
  }
}

// Creates the skill entry (defaulting miscBonus/conditionalBonuses to none)
// if this is the character's first rank in it.
export function setSkillRanks(state, skillId, ranks, ability) {
  const existing = state.characterProgress.skills[skillId]
  return {
    ...state,
    characterProgress: {
      ...state.characterProgress,
      skills: {
        ...state.characterProgress.skills,
        [skillId]: { ...(existing ?? { ability, ranks: 0 }), ranks },
      },
    },
  }
}

export function setWildShapeUsesPerDay(state, uses) {
  return { ...state, characterProgress: { ...state.characterProgress, wildShapeUsesPerDay: uses } }
}

// Compound level-up action: bumps level, records this level's HP roll, and
// (only at ability-increase levels) appends the ability bump. Skill ranks,
// feats, and class features are recorded separately via the actions above —
// the level-up flow calls all of these together, but they stay independent
// so each can be edited later without re-running the whole level-up.
export function applyLevelUp(state, { newLevel, hpRoll, wildShapeUsesPerDay, abilityIncrease }) {
  let next = {
    ...state,
    characterProgress: { ...state.characterProgress, level: newLevel },
  }
  next = addHpRoll(next, newLevel, hpRoll)
  if (wildShapeUsesPerDay != null) next = setWildShapeUsesPerDay(next, wildShapeUsesPerDay)
  if (abilityIncrease) {
    next = addAbilityAdjustment(next, {
      ability: abilityIncrease.ability,
      value: 1,
      bonusType: 'level',
      source: `Level ${newLevel} ability increase`,
      active: true,
    })
  }
  return next
}
