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

  // One free-text slot per prepared spell — orisons plus each leveled slot
  // total (base + Wisdom bonus). Re-filled after every Long Rest, since
  // Lyra re-prepares from the full druid list each morning rather than
  // having a fixed spell list (CLAUDE.md > Spell preparation model).
  const preparedSpells = { 0: Array(sheet.spellSlots.orisons.prepared).fill('') }
  for (const slot of sheet.spellSlots.slots) {
    if (slot.total > 0) preparedSpells[slot.spellLevel] = Array(slot.total).fill('')
  }

  return {
    hp: { current: sheet.character.hp.max, temp: 0 },
    spellSlotsUsed,
    preparedSpells,
    wildShapeUsed: 0,
    activeWildShapeForm: null,
    dailyUses,
    companionHp: { current: companion.hp.max },
    activeSummons: [],
    // Anarchic template state machine (Iconic Manifestation) — two phases,
    // 'cast' (invocation window open) and 'invoked' (template active),
    // bookended by 'inactive'. Deliberately not tied to activeWildShapeForm:
    // it's an overlay on Lyra, not a form modifier, so it must survive
    // assuming/reverting wild shape untouched.
    anarchicTemplate: {
      phase: 'inactive',
      windowMinutesRemaining: 0,
      durationMinutesRemaining: 0,
      smiteLawUsed: false,
    },
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
    preparedSpells: { ...defaults.preparedSpells, ...loaded.preparedSpells },
    dailyUses: { ...defaults.dailyUses, ...loaded.dailyUses },
    companionHp: { ...defaults.companionHp, ...loaded.companionHp },
    anarchicTemplate: { ...defaults.anarchicTemplate, ...loaded.anarchicTemplate },
  }
}
