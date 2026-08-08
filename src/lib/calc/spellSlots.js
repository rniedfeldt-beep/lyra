// Standard bonus-spell-per-day formula from ability modifier. A pure system
// rule, not campaign data, so it stays a formula rather than a JSON table.
export function bonusSpellsForLevel(abilityMod, spellLevel) {
  if (spellLevel < 1) return 0
  if (abilityMod < spellLevel) return 0
  return Math.floor((abilityMod - spellLevel) / 4) + 1
}

// Spell slots are computed from level + Wisdom, never hardcoded, so the
// incoming Wisdom-boosting tome recomputes everything downstream for free.
//
// Orisons (level 0) are prepared, at-will spells for this campaign — no
// slot economy, no daily tracker — so they're split out separately from the
// leveled slot calculator, which only ever deals with levels 1+.
export function computeSpellSlots({ level, castingAbilityMod, spellSlotsBaseTable }) {
  const base = spellSlotsBaseTable.byLevel[String(level)]
  if (!base) throw new Error(`No base spell slot entry for level ${level}`)

  const orisons = { spellLevel: 0, prepared: base[0] }

  const slots = base.slice(1).map((baseSlots, i) => {
    const spellLevel = i + 1
    const bonus = bonusSpellsForLevel(castingAbilityMod, spellLevel)
    return {
      spellLevel,
      base: baseSlots,
      bonus,
      total: baseSlots + bonus,
    }
  })

  return { orisons, slots }
}
