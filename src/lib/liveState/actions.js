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

export function setWildShapeUsed(state, used) {
  return { ...state, wildShapeUsed: used }
}

export function setDailyUse(state, id, used) {
  return { ...state, dailyUses: { ...state.dailyUses, [id]: used } }
}

export function setCompanionHp(state, current) {
  return { ...state, companionHp: { current } }
}
