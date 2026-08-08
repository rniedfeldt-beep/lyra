// AC is built from whatever's actually equipped, read generically by
// acBonusType, so swapping armor/shield/rings never touches this file.
export function computeAC({ equippedItems, dexMod }) {
  const breakdown = [{ label: 'Base', value: 10 }]

  for (const item of equippedItems) {
    if (!item || !item.acBonus) continue
    breakdown.push({ label: item.name, value: item.acBonus, type: item.acBonusType })
  }
  breakdown.push({ label: 'Dex', value: dexMod, type: 'dex' })

  const total = breakdown.reduce((sum, b) => sum + b.value, 0)

  const touch = breakdown
    .filter((b) => b.type !== 'armor' && b.type !== 'shield' && b.type !== 'natural')
    .reduce((sum, b) => sum + b.value, 0)

  const flatFooted = total - (dexMod > 0 ? dexMod : 0)

  return { total, touch, flatFooted, breakdown }
}
