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
