import { abilityMod } from './abilities'
import {
  SIZE_MODIFIER,
  stepSize,
  stepDamageDie,
  parseHitDice,
  averageHp,
  averageDamage,
  druidLevel,
} from '../rules/dnd35'

// Creatures Greenbound Summoning can apply to at all (CLAUDE.md > Summoning
// > Greenbound template) and that have a Summon Nature's Ally spell level.
export function getGreenboundEligibleCreatures(monsterManual, greenboundTemplate) {
  return monsterManual.filter(
    (c) => greenboundTemplate.appliesToTypes.includes(c.type) && c.summonNaturesAllyLevel != null,
  )
}

function spellLevelCost(creature, templateId, simpleTemplates, greenboundTemplate) {
  const simpleDelta = templateId ? simpleTemplates[templateId].spellLevelCostDelta : 0
  return creature.summonNaturesAllyLevel + simpleDelta + greenboundTemplate.spellLevelCostDelta
}

// young/advanced/giant trades are canines-only in this campaign (Totemic
// Summons synergy) — Greenbound itself applies more broadly.
function availableTemplateIds(creature, simpleTemplates) {
  const ids = [null]
  if (creature.isCanine) ids.push('young', 'advanced', 'giant')
  return ids.filter((id) => {
    if (id == null) return true
    if (simpleTemplates[id].colossalRestricted && creature.size === 'Colossal') return false
    return true
  })
}

// For a chosen spell slot level, every creature/template combo that lands
// exactly on that level, sorted alphabetically by creature name.
export function getReachableLoadouts({ monsterManual, greenboundTemplate, simpleTemplates, spellLevel }) {
  const eligible = getGreenboundEligibleCreatures(monsterManual, greenboundTemplate)
  const loadouts = []
  for (const creature of eligible) {
    for (const templateId of availableTemplateIds(creature, simpleTemplates)) {
      if (spellLevelCost(creature, templateId, simpleTemplates, greenboundTemplate) === spellLevel) {
        loadouts.push({ creature, templateId })
      }
    }
  }
  return loadouts.sort((a, b) => a.creature.name.localeCompare(b.creature.name))
}

function applySimpleTemplate(creature, templateId, simpleTemplates) {
  const tmpl = templateId ? simpleTemplates[templateId] : null
  const size = tmpl ? stepSize(creature.size, tmpl.sizeSteps) : creature.size

  const abilities = { ...creature.abilities }
  if (tmpl) {
    for (const [key, delta] of Object.entries(tmpl.abilityAdjustments)) {
      abilities[key] = (abilities[key] ?? 10) + delta
    }
  }

  let naturalArmor = creature.naturalArmor + (tmpl?.naturalArmorBonus ?? 0)
  if (tmpl?.naturalArmorMin != null) naturalArmor = Math.max(naturalArmor, tmpl.naturalArmorMin)

  const attacks = creature.attacks.map((atk) => ({
    ...atk,
    damage: tmpl ? stepDamageDie(atk.damage, tmpl.damageDieSteps) : atk.damage,
  }))

  return { size, abilities, naturalArmor, attacks }
}

function applyGreenbound(intermediate, creature, greenboundTemplate) {
  const abilities = { ...intermediate.abilities }
  for (const [key, delta] of Object.entries(greenboundTemplate.abilityAdjustments)) {
    abilities[key] = (abilities[key] ?? 10) + delta
  }

  const naturalArmor = intermediate.naturalArmor + greenboundTemplate.naturalArmorBonus

  const { count: hdCount } = parseHitDice(creature.hitDice)
  const conMod = abilityMod(abilities.con)
  const hp = averageHp(hdCount, greenboundTemplate.hitDieOverride, conMod)

  const tableSlamDie = greenboundTemplate.slamDamageBySize[intermediate.size]
  const existingSlam = intermediate.attacks.find((a) => a.name === 'slam')
  const slamDie =
    existingSlam && averageDamage(existingSlam.damage) > averageDamage(tableSlamDie)
      ? existingSlam.damage
      : tableSlamDie

  return {
    size: intermediate.size,
    abilities,
    naturalArmor,
    hp,
    naturalAttacks: intermediate.attacks,
    slamAttack: { name: 'slam', natural: true, primary: true, damage: slamDie, crit: '20/x2' },
    type: `Plant (augmented ${creature.type})`,
  }
}

function weaponFocusBonus(creature, attackName) {
  const pattern = new RegExp(`^Weapon Focus \\(${attackName}\\)$`, 'i')
  return (creature.feats ?? []).some((f) => pattern.test(f)) ? 1 : 0
}

function buildAttackRoutine({ creature, attacks, statBlock, luckBonus }) {
  const strMod = abilityMod(statBlock.abilities.str)
  const sizeMod = SIZE_MODIFIER[statBlock.size]
  const attackBonusBase = creature.baseAttackBonus + strMod + sizeMod
  const singleWeapon = attacks.length === 1

  return attacks.map((atk) => {
    const strMult = singleWeapon ? 1.5 : atk.primary ? 1 : 0.5
    const focus = weaponFocusBonus(creature, atk.name)
    return {
      name: atk.name,
      count: atk.count ?? 1,
      primary: atk.primary,
      attackBonus: attackBonusBase - (atk.primary ? 0 : 5) + focus + luckBonus,
      damage: { die: atk.damage, bonus: Math.floor(strMod * strMult), crit: atk.crit },
    }
  })
}

// Feat effects Lyra already has drive these bonuses (Ashbound) — nothing
// about the summon builder hardcodes a named feat's numbers.
function collectSummonFeatBonuses(feats) {
  let durationMultiplier = 1
  let luckAttackBonus = 0
  for (const feat of feats) {
    for (const effect of feat.effects ?? []) {
      if (effect.type === 'summon_duration_multiplier') durationMultiplier *= effect.value
      if (effect.type === 'summon_attack_bonus') luckAttackBonus += effect.value
    }
  }
  return { durationMultiplier, luckAttackBonus }
}

// Full pipeline: simple template -> Greenbound -> Ashbound/Totemic Summons.
// Order matters — Greenbound's slam-vs-size comparison must run at final
// (post-simple-template) size (CLAUDE.md > Summoning > Pipeline order).
export function computeSummonStatBlock({ sheet, creature, templateId, simpleTemplates, greenboundTemplate }) {
  const character = sheet.character
  const afterSimple = applySimpleTemplate(creature, templateId, simpleTemplates)
  const afterGreenbound = applyGreenbound(afterSimple, creature, greenboundTemplate)

  const { durationMultiplier, luckAttackBonus } = collectSummonFeatBonuses(sheet.feats)

  const naturalWeaponRoutine = buildAttackRoutine({
    creature,
    attacks: afterGreenbound.naturalAttacks,
    statBlock: afterGreenbound,
    luckBonus: luckAttackBonus,
  })
  const slamRoutine = buildAttackRoutine({
    creature,
    attacks: [afterGreenbound.slamAttack],
    statBlock: afterGreenbound,
    luckBonus: luckAttackBonus,
  })

  const sizeMod = SIZE_MODIFIER[afterGreenbound.size]
  const dexMod = abilityMod(afterGreenbound.abilities.dex)
  const chaMod = abilityMod(afterGreenbound.abilities.cha)
  const ac = {
    total: 10 + sizeMod + dexMod + afterGreenbound.naturalArmor,
    touch: 10 + sizeMod + dexMod,
    flatFooted: 10 + sizeMod + afterGreenbound.naturalArmor + (dexMod > 0 ? 0 : dexMod),
  }

  const totemic = character.wolfShaman.totemicSummons
  const totemicActive = creature.isCanine && character.level >= totemic.activeFromCharacterLevel
  const tempHp = totemicActive && totemic.canineTempHpEqualsDruidLevel ? druidLevel(character.level) : 0

  const baseDurationRounds = character.casterLevel.druid
  const totalDurationRounds = baseDurationRounds * durationMultiplier

  const spellLevel = spellLevelCost(creature, templateId, simpleTemplates, greenboundTemplate)

  return {
    creature,
    templateId,
    spellLevel,
    size: afterGreenbound.size,
    type: afterGreenbound.type,
    abilities: afterGreenbound.abilities,
    hp: afterGreenbound.hp,
    tempHp,
    ac,
    naturalWeaponRoutine,
    slamRoutine,
    spellLikeAbilities: greenboundTemplate.spellLikeAbilities,
    chaMod,
    durationRounds: totalDurationRounds,
    castAsStandardAction: totemicActive && totemic.canineSummonCastTime === 'standard action',
    qualities: {
      damageReduction: greenboundTemplate.damageReduction,
      fastHealing: greenboundTemplate.fastHealing,
      grappleBonus: greenboundTemplate.grappleBonus,
      resistances: greenboundTemplate.resistances,
      tremorsenseFt: greenboundTemplate.tremorsenseFt,
      racialSkillBonus: greenboundTemplate.racialSkillBonus,
    },
  }
}
