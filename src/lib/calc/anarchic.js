// Anarchic template overlay (Manual of the Planes p.198), granted via Iconic
// Manifestation. This is an overlay on Lyra, never a form modifier: her Hit
// Dice for template purposes is always her own character level, in base
// form or wild shaped alike, since standard wild shape rules never change
// HD (BAB/saves/HP/skills/feats all stay hers — CLAUDE.md > Wild Shape).
// That's why every function here takes character level directly rather
// than looking at whatever creature she's currently shaped into.

export function computeAnarchicWindowMinutes(casterLevel, template) {
  return casterLevel * template.castWindowMinutesPerCasterLevel
}

export function computeAnarchicInvokedMinutes(casterLevel, template) {
  return casterLevel * template.invokedDurationMinutesPerCasterLevel
}

export function computeSmiteLawBonus(hd, template) {
  return Math.min(hd * template.smiteLaw.bonusDamagePerHd, template.smiteLaw.maxBonusDamage)
}

export function drFastHealingForHd(hd, template) {
  const bracket = template.drFastHealingByHd.find((b) => hd >= b.minHd && (b.maxHd == null || hd <= b.maxHd))
  return bracket ?? { damageReduction: null, fastHealing: 0 }
}

// "If the base creature already has fast healing or DR, use the better
// value" — compared by DR amount alone (bypass type isn't modeled anywhere
// else in this app's creature data yet, so there's nothing to reconcile).
function betterDamageReduction(existing, granted) {
  if (!existing) return granted
  if (!granted) return existing
  return granted.amount > existing.amount ? granted : existing
}

// hd: Lyra's character level, always — see file header.
// existingDamageReduction/existingFastHealing: whatever the current stat
// block (base sheet or active wild shape form) already has, if anything;
// neither currently models these, so callers can omit them.
// creatureType: the active wild shape form's type, if shaped; undefined in
// base form (Lyra herself is never an Animal, so no type-change note).
export function computeAnarchicOverlay({
  hd,
  existingDamageReduction = null,
  existingFastHealing = 0,
  creatureType,
  template,
}) {
  const bracket = drFastHealingForHd(hd, template)
  return {
    darkvisionFt: template.darkvisionFt,
    resistances: template.resistances,
    immunities: template.immunities,
    damageReduction: betterDamageReduction(existingDamageReduction, bracket.damageReduction),
    fastHealing: Math.max(existingFastHealing, bracket.fastHealing),
    smiteLawBonus: computeSmiteLawBonus(hd, template),
    typeChangeNote: template.typeChange.from.includes(creatureType)
      ? `${creatureType} → ${template.typeChange.to} while this template is active`
      : null,
  }
}
