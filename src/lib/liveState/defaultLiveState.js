// The character's leveling progress — everything that changes only via the
// XP/level-up flow (never via daily play), kept separate from the
// short-lived trackers below so Long Rest can reset those without touching
// this. Seeded once from the static character.json, then lives entirely in
// Supabase from that point on; the static file is never read again for
// these fields once a save has happened.
export function getDefaultCharacterProgress(character) {
  return {
    level: character.level,
    xp: character.xp,
    hpRolls: character.hpRolls.map((r) => ({ ...r })),
    skills: JSON.parse(JSON.stringify(character.skills)),
    trueBaseAbilityScores: { ...character.trueBaseAbilityScores },
    abilityAdjustments: character.abilityAdjustments.map((a) => ({ ...a })),
    feats: [...character.feats],
    classFeatures: [],
    wildShapeUsesPerDay: character.wildShape.usesPerDay,
  }
}

// A loaded characterProgress may predate a field added after it was last
// saved (e.g. trueBaseAbilityScores) — shallow-merging it onto the fresh
// default backfills anything missing without touching anything present, the
// same backfill mergeWithDefaults does for the rest of the state. Used
// wherever a loaded/imported characterProgress is about to be read, not
// just where it's stored, since computeEffectiveSheet needs every field to
// exist up front.
export function mergeCharacterProgress(loaded, character) {
  const defaults = getDefaultCharacterProgress(character)
  return loaded ? { ...defaults, ...loaded } : defaults
}

// The single shape all live/session state takes, freshly derived from the
// computed sheet + companion + daily-ability list. Long Rest just re-runs
// this function, so a new tracker added anywhere upstream resets correctly
// with no extra reset logic to maintain. characterProgress is passed through
// as-is (never rederived here) since Long Rest must not touch XP/level/etc.
export function getDefaultLiveState({ sheet, dailyAbilities, companion, characterProgress }) {
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
    characterProgress,
    hp: { current: sheet.character.hp.max, temp: 0 },
    spellSlotsUsed,
    preparedSpells,
    wildShapeUsed: 0,
    activeWildShapeForm: null,
    dailyUses,
    companionHp: { current: companion.hp.max },
    activeSummons: [],
    // Anarchic template overlay (Iconic Manifestation) — a single
    // active/inactive toggle on the Lyra tab. Deliberately not tied to
    // activeWildShapeForm: it's an overlay on Lyra, not a form modifier, so
    // it must survive assuming/reverting wild shape untouched.
    anarchicTemplate: {
      active: false,
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
    characterProgress: { ...defaults.characterProgress, ...loaded.characterProgress },
    hp: { ...defaults.hp, ...loaded.hp },
    spellSlotsUsed: { ...defaults.spellSlotsUsed, ...loaded.spellSlotsUsed },
    preparedSpells: { ...defaults.preparedSpells, ...loaded.preparedSpells },
    dailyUses: { ...defaults.dailyUses, ...loaded.dailyUses },
    companionHp: { ...defaults.companionHp, ...loaded.companionHp },
    anarchicTemplate: { ...defaults.anarchicTemplate, ...loaded.anarchicTemplate },
  }
}
