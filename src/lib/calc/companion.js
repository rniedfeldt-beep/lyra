import { abilityMod } from './abilities'
import { SIZE_MODIFIER, parseHitDice } from '../rules/dnd35'

// Standard 3.5e monster base-save progression for the Animal type: good
// Fort/Ref, poor Will. Good = 2 + floor(HD/2), poor = floor(HD/3). Quen is
// always an Animal (Wolf Shaman's Nature Bond requires a wolf), so this
// isn't generalized to other creature types — nothing else needs it yet.
function animalBaseSaves(hd) {
  return {
    fort: 2 + Math.floor(hd / 2),
    ref: 2 + Math.floor(hd / 2),
    will: Math.floor(hd / 3),
  }
}

function weaponFocusBonus(creature, attackName) {
  const pattern = new RegExp(`^Weapon Focus \\(${attackName}\\)$`, 'i')
  return (creature.feats ?? []).some((f) => pattern.test(f)) ? 1 : 0
}

// The `abilities`/`naturalArmor`/`baseAttackBonus` fields on the companion
// record are already the effective values at its current companionLevel
// (progressionTable is stored for future level recompute, not applied
// here yet) — so this is a straightforward stat-block build, not a swap.
export function computeCompanionStatBlock(companion) {
  const strMod = abilityMod(companion.abilities.str)
  const dexMod = abilityMod(companion.abilities.dex)
  const conMod = abilityMod(companion.abilities.con)
  const wisMod = abilityMod(companion.abilities.wis)
  const sizeMod = SIZE_MODIFIER[companion.size]

  const armorBonus = companion.armor?.armorBonus ?? 0
  const ac = {
    total: 10 + sizeMod + dexMod + companion.naturalArmor + armorBonus,
    touch: 10 + sizeMod + dexMod,
    flatFooted: 10 + sizeMod + companion.naturalArmor + armorBonus + (dexMod > 0 ? 0 : dexMod),
  }

  const { count: hd } = parseHitDice(companion.hitDice)
  const base = animalBaseSaves(hd)
  const saves = {
    fort: { base: base.fort, abilityMod: conMod, total: base.fort + conMod },
    ref: { base: base.ref, abilityMod: dexMod, total: base.ref + dexMod },
    will: { base: base.will, abilityMod: wisMod, total: base.will + wisMod },
  }

  const attackBonusBase = companion.baseAttackBonus + strMod + sizeMod
  const singleWeapon = companion.attacks.length === 1
  const attackRoutine = companion.attacks.map((atk) => {
    const strMult = atk.primary === false ? 0.5 : singleWeapon ? 1.5 : 1
    const focus = weaponFocusBonus(companion, atk.name)
    return {
      name: atk.name,
      count: atk.count ?? 1,
      primary: atk.primary,
      attackBonus: attackBonusBase - (atk.primary ? 0 : 5) + focus,
      damage: { die: atk.damage, bonus: Math.floor(strMod * strMult), crit: atk.crit },
    }
  })

  const speed = companion.armor?.speed ?? companion.speed.land

  return { ac, saves, attackRoutine, speed }
}
