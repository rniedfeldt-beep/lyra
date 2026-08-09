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

// Anything with a Summon Nature's Ally level is summonable, full stop —
// type is irrelevant here. Whether Greenbound also applies is a separate
// question (see isGreenboundEligible): Lyra can summon an arrowhawk, a
// xorn, or a unicorn same as a wolf, she just won't get Greenbound on it.
export function getSummonableCreatures(monsterManual) {
  return monsterManual.filter((c) => c.summonNaturesAllyLevel != null)
}

// Greenbound only applies to animal/fey/giant/humanoid/monstrous humanoid/
// vermin base creatures (CLAUDE.md > Summoning > Greenbound template).
// Magical beasts, outsiders, and elementals are summonable but never get it.
export function isGreenboundEligible(creature, greenboundTemplate) {
  return greenboundTemplate.appliesToTypes.includes(creature.type)
}

function spellLevelCost(creature, templateId, simpleTemplates, greenboundEligible, greenboundTemplate) {
  const simpleDelta = templateId ? simpleTemplates[templateId].spellLevelCostDelta : 0
  const greenboundDelta = greenboundEligible ? greenboundTemplate.spellLevelCostDelta : 0
  return creature.summonNaturesAllyLevel + simpleDelta + greenboundDelta
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
  const summonable = getSummonableCreatures(monsterManual)
  const loadouts = []
  for (const creature of summonable) {
    const greenboundEligible = isGreenboundEligible(creature, greenboundTemplate)
    for (const templateId of availableTemplateIds(creature, simpleTemplates)) {
      if (
        spellLevelCost(creature, templateId, simpleTemplates, greenboundEligible, greenboundTemplate) ===
        spellLevel
      ) {
        loadouts.push({ creature, templateId, greenboundEligible })
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

// No Greenbound: no type change, no ability/NA boost, no gained slam, HP
// uses the creature's own hit die (not forced to d8).
function skipGreenbound(intermediate, creature) {
  const { count: hdCount, die } = parseHitDice(creature.hitDice)
  const conMod = abilityMod(intermediate.abilities.con)
  return {
    size: intermediate.size,
    abilities: intermediate.abilities,
    naturalArmor: intermediate.naturalArmor,
    hp: averageHp(hdCount, die, conMod),
    naturalAttacks: intermediate.attacks,
    slamAttack: null,
    type: creature.type,
  }
}

function weaponFocusBonus(creature, attackName) {
  const pattern = new RegExp(`^Weapon Focus \\(${attackName}\\)$`, 'i')
  return (creature.feats ?? []).some((f) => pattern.test(f)) ? 1 : 0
}

function buildOneAttack(atk, { creature, attackBonusBase, strMod, singleWeapon, luckBonus, forceCount1 }) {
  // A sole natural weapon normally gets the full 1.5x, unless the source
  // text explicitly writes it up as a secondary attack anyway (e.g.
  // Ur'Epona's hoof) — that override always wins.
  const strMult = atk.primary === false ? 0.5 : singleWeapon ? 1.5 : 1
  const focus = weaponFocusBonus(creature, atk.name)
  return {
    name: atk.name,
    count: forceCount1 ? 1 : (atk.count ?? 1),
    primary: atk.primary,
    attackBonus: attackBonusBase - (atk.primary ? 0 : 5) + focus + luckBonus,
    damage: { die: atk.damage, bonus: Math.floor(strMod * strMult), crit: atk.crit },
  }
}

// Single attack (standard action, best primary weapon only) vs. full attack
// (full-round action, primary at full count plus all secondaries at -5).
function buildAttackRoutine({ creature, attacks, statBlock, luckBonus }) {
  const strMod = abilityMod(statBlock.abilities.str)
  const sizeMod = SIZE_MODIFIER[statBlock.size]
  const attackBonusBase = creature.baseAttackBonus + strMod + sizeMod
  const singleWeapon = attacks.length === 1

  const full = attacks.map((atk) =>
    buildOneAttack(atk, { creature, attackBonusBase, strMod, singleWeapon, luckBonus }),
  )

  const primaries = attacks.filter((a) => a.primary !== false)
  const bestPrimary = primaries.reduce(
    (best, atk) => (averageDamage(atk.damage) > averageDamage(best.damage) ? atk : best),
    primaries[0],
  )
  const single = [
    buildOneAttack(bestPrimary, {
      creature,
      attackBonusBase,
      strMod,
      singleWeapon,
      luckBonus,
      forceCount1: true,
    }),
  ]

  const hasSecondaries = attacks.length > 1 || (attacks[0].count ?? 1) > 1

  return { single, full, hasSecondaries }
}

// Feat effects Lyra already has drive these bonuses (Ashbound) — nothing
// about the summon builder hardcodes a named feat's numbers. These apply to
// every Summon Nature's Ally casting, Greenbound or not.
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

// Full pipeline: simple template -> Greenbound (if eligible) -> Ashbound/
// Totemic Summons. Order matters — Greenbound's slam-vs-size comparison
// must run at final (post-simple-template) size (CLAUDE.md > Summoning >
// Pipeline order). Ashbound and Totemic Summons apply regardless of
// Greenbound eligibility; Greenbound itself only applies to
// animal/fey/giant/humanoid/monstrous humanoid/vermin base creatures.
export function computeSummonStatBlock({ sheet, creature, templateId, simpleTemplates, greenboundTemplate }) {
  const character = sheet.character
  const greenboundEligible = isGreenboundEligible(creature, greenboundTemplate)
  const afterSimple = applySimpleTemplate(creature, templateId, simpleTemplates)
  const final = greenboundEligible
    ? applyGreenbound(afterSimple, creature, greenboundTemplate)
    : skipGreenbound(afterSimple, creature)

  const { durationMultiplier, luckAttackBonus } = collectSummonFeatBonuses(sheet.feats)

  const naturalWeaponRoutine = buildAttackRoutine({
    creature,
    attacks: final.naturalAttacks,
    statBlock: final,
    luckBonus: luckAttackBonus,
  })
  const slamRoutine = final.slamAttack
    ? buildAttackRoutine({ creature, attacks: [final.slamAttack], statBlock: final, luckBonus: luckAttackBonus })
    : null

  const sizeMod = SIZE_MODIFIER[final.size]
  const dexMod = abilityMod(final.abilities.dex)
  const chaMod = abilityMod(final.abilities.cha)
  const ac = {
    total: 10 + sizeMod + dexMod + final.naturalArmor,
    touch: 10 + sizeMod + dexMod,
    flatFooted: 10 + sizeMod + final.naturalArmor + (dexMod > 0 ? 0 : dexMod),
  }

  const totemic = character.wolfShaman.totemicSummons
  const totemicActive = creature.isCanine && character.level >= totemic.activeFromCharacterLevel
  const tempHp = totemicActive && totemic.canineTempHpEqualsDruidLevel ? druidLevel(character.level) : 0

  const baseDurationRounds = character.casterLevel.druid
  const totalDurationRounds = baseDurationRounds * durationMultiplier

  const spellLevel = spellLevelCost(creature, templateId, simpleTemplates, greenboundEligible, greenboundTemplate)

  return {
    creature,
    templateId,
    greenboundEligible,
    spellLevel,
    size: final.size,
    type: final.type,
    abilities: final.abilities,
    hp: final.hp,
    tempHp,
    ac,
    naturalWeaponRoutine,
    slamRoutine,
    spellLikeAbilities: greenboundEligible ? greenboundTemplate.spellLikeAbilities : null,
    chaMod,
    durationRounds: totalDurationRounds,
    castAsStandardAction: totemicActive && totemic.canineSummonCastTime === 'standard action',
    qualities: greenboundEligible
      ? {
          damageReduction: greenboundTemplate.damageReduction,
          fastHealing: greenboundTemplate.fastHealing,
          grappleBonus: greenboundTemplate.grappleBonus,
          resistances: greenboundTemplate.resistances,
          tremorsenseFt: greenboundTemplate.tremorsenseFt,
          racialSkillBonus: greenboundTemplate.racialSkillBonus,
        }
      : null,
  }
}
