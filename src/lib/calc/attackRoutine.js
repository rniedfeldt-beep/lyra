import { computeIterativeAttackBonuses } from './progression'

// Builds the attack routine from BAB plus whatever the weapon's properties
// inject. A "speed"-type property doesn't just add a number — it inserts an
// entire extra attack into the routine, so new weapon properties (or future
// weapons) plug in here without editing any UI code.
export function computeAttackRoutine({ bab, strMod, weapon }) {
  const enhancement = weapon.enhancementBonus ?? 0
  const attackBonus = strMod + enhancement

  const attacks = computeIterativeAttackBonuses(bab).map((b) => b + attackBonus)

  const warnings = []
  for (const property of weapon.properties ?? []) {
    if (property.effect?.type === 'extra_attack' && property.effect.trigger === 'full_attack') {
      if (property.effect.attackBonus === 'full_bab') {
        attacks.splice(1, 0, attacks[0])
      }
      if (property.warning) warnings.push(property.warning)
    }
  }

  return {
    singleAttack: attacks[0],
    fullAttack: attacks,
    damage: {
      die: weapon.damage.die,
      bonus: attackBonus,
      type: weapon.damage.type,
    },
    warnings,
  }
}
