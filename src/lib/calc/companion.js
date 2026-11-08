import { abilityMod } from './abilities'
import {
  grappleSizeModifier,
  sizeModifier,
  parseHitDice,
  monsterBaseSaves,
  threeQuarterBabForLevel,
} from '../rules/dnd35'

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

// Bonus Hit Dice Quen gains between two character levels — the number of d8
// HP rolls a level-up has to ask for. Never negative.
export function companionHdGained(companion, fromLevel, toLevel) {
  const gained =
    companionProgressionRow(companion, toLevel).bonusHD - companionProgressionRow(companion, fromLevel).bonusHD
  return Math.max(0, gained)
}

// Every special ability granted at or below a character level. The table
// lists each row's *new* abilities, so they accumulate.
function specialAbilitiesAt(companion, characterLevel) {
  const row = companionProgressionRow(companion, characterLevel)
  const upTo = companion.progressionTable.indexOf(row)
  return companion.progressionTable.slice(0, upTo + 1).flatMap((r) => r.special)
}

// The companion as it stands at a character level — every column of the
// progression table applied to the base wolf — so nothing downstream reads a
// stale level-8 snapshot. The record's own `abilities`, `hitDice`,
// `naturalArmor`, `baseAttackBonus`, `bonusHD`, `bonusTricks`,
// `specialAbilities` and `companionLevel` fields are that snapshot (as of
// companionLevel 8) and are all overridden here; `hp.max` is the one snapshot
// value that's *kept*, as the HP total at the snapshot, because HP comes from
// rolled dice and can't be derived. Each bonus Hit Die gained past the
// snapshot adds its own d8 roll (`hdRolls`, [{ level, roll }], entered at
// level-up) plus Con. Dice with no roll recorded yet add nothing and are
// reported as `hdPending` rather than guessed.
export function computeEffectiveCompanion(companion, characterLevel, hdRolls = []) {
  // `snapshot` keeps the original record reachable, so this is safe to call
  // again on an already-effective companion (the level-up preview does).
  const snapshot = companion.snapshot ?? companion
  const row = companionProgressionRow(companion, characterLevel)
  const base = companion.baseCreature
  const { abilityAdjustment } = row
  const abilities = { ...base.abilities, str: base.abilities.str + abilityAdjustment, dex: base.abilities.dex + abilityAdjustment }

  const baseHd = parseHitDice(base.hitDice).count
  const hdTotal = baseHd + row.bonusHD
  const conMod = abilityMod(abilities.con)

  const hdSinceSnapshot = Math.max(0, row.bonusHD - snapshot.bonusHD)
  const rolls = hdRolls.slice(0, hdSinceSnapshot)
  const hpMax = snapshot.hp.max + rolls.reduce((sum, r) => sum + r.roll + conMod, 0)

  return {
    ...companion,
    snapshot,
    abilities,
    abilityAdjustment,
    bonusHD: row.bonusHD,
    hitDice: `${hdTotal}d8${conMod * hdTotal >= 0 ? '+' : ''}${conMod * hdTotal}`,
    naturalArmor: base.naturalArmor + row.naturalArmor,
    baseAttackBonus: threeQuarterBabForLevel(hdTotal),
    hp: { ...companion.hp, max: hpMax },
    hdPending: hdSinceSnapshot - rolls.length,
    bonusTricks: row.bonusTricks,
    specialAbilities: specialAbilitiesAt(companion, characterLevel),
    companionLevel: characterLevel,
  }
}

// Straightforward stat-block build from an *effective* companion
// (computeEffectiveCompanion) — not a swap.
export function computeCompanionStatBlock(companion) {
  const strMod = abilityMod(companion.abilities.str)
  const dexMod = abilityMod(companion.abilities.dex)
  const conMod = abilityMod(companion.abilities.con)
  const wisMod = abilityMod(companion.abilities.wis)
  const sizeMod = sizeModifier(companion.size)

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
  const grapple = companion.baseAttackBonus + strMod + grappleSizeModifier(companion.size)

  return { ac, saves, attackRoutine, speed, abilities: companion.abilities, initiative, grapple }
}
