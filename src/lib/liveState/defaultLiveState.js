// The single shape all live/session state takes, freshly derived from the
// computed sheet + companion + daily-ability list. Long Rest just re-runs
// this function, so a new tracker added anywhere upstream resets correctly
// with no extra reset logic to maintain.
export function getDefaultLiveState({ sheet, dailyAbilities, companion }) {
  const spellSlotsUsed = {}
  for (const slot of sheet.spellSlots.slots) {
    if (slot.total > 0) spellSlotsUsed[slot.spellLevel] = 0
  }

  const dailyUses = {}
  for (const ability of dailyAbilities) {
    dailyUses[ability.id] = 0
  }

  return {
    hp: { current: sheet.character.hp.max, temp: 0 },
    spellSlotsUsed,
    wildShapeUsed: 0,
    dailyUses,
    companionHp: { current: companion.hp.max },
    updatedAt: null,
  }
}

// Backfills any state loaded from storage (Supabase, localStorage, an
// imported file — including a stray empty `{}` row) against the current
// default shape, so a missing or partial tracker key never crashes the UI;
// it just falls back to its default until the player sets it.
export function mergeWithDefaults(loaded, defaults) {
  if (!loaded) return defaults
  return {
    ...defaults,
    ...loaded,
    hp: { ...defaults.hp, ...loaded.hp },
    spellSlotsUsed: { ...defaults.spellSlotsUsed, ...loaded.spellSlotsUsed },
    dailyUses: { ...defaults.dailyUses, ...loaded.dailyUses },
    companionHp: { ...defaults.companionHp, ...loaded.companionHp },
  }
}
