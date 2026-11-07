import { abilityMod } from './abilities'
import { SIZE_MODIFIER, parseHitDice, monsterBaseSaves } from '../rules/dnd35'

function weaponFocusBonus(creature, attackName) {
  const pattern = new RegExp(`^Weapon Focus \\(${attackName}\\)$`, 'i')
  return (creature.feats ?? []).some((f) => pattern.test(f)) ? 1 : 0
}

// The progression-table row (companion.progressionTable) that applies at a
// character level. Planar Shepherd levels stack with druid levels for
// companion abilities, so Quen's effective druid level is the character level
// (CLAUDE.md > Quen). A level past the table's last row uses the last row.
export function companionProgressionRow(companion, characterLevel) {
  const rows = companion.progressionTable.map((row) => {
    const [lo, hi] = row.levelRange.split('-').map(Number)
    return { row, lo, hi: hi ?? lo }
  })
  const match = rows.find(({ lo, hi }) => characterLevel >= lo && characterLevel <= hi)
  return (match ?? (characterLevel < rows[0].lo ? rows[0] : rows[rows.length - 1])).row
}

// Quen's effective ability scores at a character level: his base wolf's
// scores plus the progression row's Str/Dex adjustment. Computed rather than
// read from the record's own `abilities`, which only holds the values as they
// stood at level 8.
export function computeCompanionAbilities(companion, characterLevel) {
  const { abilityAdjustment } = companionProgressionRow(companion, characterLevel)
  const base = companion.baseCreature.abilities
  return { ...base, str: base.str + abilityAdjustment, dex: base.dex + abilityAdjustment }
}

// Abilities follow the character level via the progression table. Natural
// armor, Hit Dice, BAB and max HP are still the record's level-8 values —
// recomputing those as Quen levels up isn't wired yet — so everything below
// is a straightforward stat-block build, not a swap.
export function computeCompanionStatBlock(companion, characterLevel) {
  const abilities =
    characterLevel == null ? companion.abilities : computeCompanionAbilities(companion, characterLevel)
  companion = { ...companion, abilities }
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
  const base = monsterBaseSaves('Animal', hd)
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

  const initiative = dexMod

  return { ac, saves, attackRoutine, speed, abilities, initiative }
}
