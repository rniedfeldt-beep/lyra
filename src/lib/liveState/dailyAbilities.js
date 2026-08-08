function humanizeSpellId(id) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Gathers every 1x/day (or Nx/day) ability that lives outside the normal
// spell-slot economy — necklace spells, feat-granted dailies, class
// abilities — into one flat list. Sourced from data, not named here, so a
// new necklace spell or a new feat effect shows up as a tracker for free.
export function collectDailyAbilities({ character, feats, items }) {
  const abilities = []

  for (const s of items.necklace?.grantedSpells ?? []) {
    abilities.push({
      id: s.spell,
      label: humanizeSpellId(s.spell),
      usesPerDay: s.usesPerDay,
      source: items.necklace.name,
    })
  }

  for (const feat of feats) {
    for (const effect of feat.effects ?? []) {
      if (effect.type === 'grants_daily_spell') {
        abilities.push({
          id: effect.spell,
          label: humanizeSpellId(effect.spell),
          usesPerDay: effect.usesPerDay,
          source: feat.name,
        })
      }
    }
  }

  for (const a of character.planarShepherdAbilities ?? []) {
    abilities.push({ id: a.id, label: a.name, usesPerDay: a.usesPerDay, source: 'Planar Shepherd' })
  }

  return abilities
}
