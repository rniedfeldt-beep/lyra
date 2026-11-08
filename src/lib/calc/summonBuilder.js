import { abilityMod } from './abilities'
import {
  sizeModifier,
  normalizeSize,
  stepSize,
  stepDamageDie,
  parseHitDice,
  averageHp,
  averageDamage,
  druidLevel,
  monsterBaseSaves,
  bareCreatureType,
  printedAverageHp,
} from '../rules/dnd35'

// Anything with a Summon Nature's Ally level is summonable, full stop —
// type is irrelevant here.
export function getSummonableCreatures(monsterManual) {
  return monsterManual.filter((c) => c.summonNaturesAllyLevel != null)
}

// Greenbound Summoning (Lost Empires of Faerûn) applies to every summon
// nature's ally result except elementals (DM-confirmed) — animals, fey,
// giants, humanoids, monstrous humanoids, vermin, magical beasts, and
// outsiders all get it (CLAUDE.md > Summoning > Greenbound template).
export function isGreenboundEligible(creature, greenboundTemplate) {
  return !greenboundTemplate.excludedTypes.includes(creature.type)
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
    if (simpleTemplates[id].colossalRestricted && normalizeSize(creature.size) === 'Colossal') return false
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

// ---------------------------------------------------------------------------
// Summon spells other than summon nature's ally (Summon Fey, Summon Dire
// Hawk, Summon Elementite Swarm). A creature names the spell(s) that produce
// it in `summonedBy`. These spells carry no template: the creature appears
// as printed, unless a per-spell effect flag (data/tables/summonSpells.json
// `effects`) is switched on — see SPELL_EFFECT_FEATS below.
// ---------------------------------------------------------------------------

// Which spell slot levels a summon spell can be cast from, given the levels
// Lyra has slots for. A scalable spell (Summon Fey) can use any slot from
// its base level up; the others are fixed.
export function spellSlotLevels(spell, availableSlotLevels) {
  if (spell.slotLevel == null) return availableSlotLevels.filter((l) => l >= 1)
  return availableSlotLevels.includes(spell.slotLevel) ? [spell.slotLevel] : []
}

// Every creature the spell can produce from the chosen slot. For a scalable
// spell the Hit Dice cap equals the slot level (a 1 HD fey from a 1st-level
// slot, a 5 HD fey from a 5th-level slot), so the pool is filtered the way
// the summon nature's ally builder filters by spell level.
export function getSpellSummonPool({ monsterManual, spell, slotLevel }) {
  return monsterManual
    .filter((c) => (c.summonedBy ?? []).includes(spell.name))
    .filter((c) => !spell.scalable || parseHitDice(c.hitDice).count <= slotLevel)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// The feats whose text names summon nature's ally. Each maps to the key in a
// spell's `effects` that switches it on for that spell.
const SPELL_EFFECT_FEATS = {
  greenboundSummoning: 'Greenbound Summoning',
  ashbound: 'Ashbound',
  totemicSummons: 'Totemic Summons',
}

const ALL_EFFECTS = { greenboundSummoning: true, ashbound: true, totemicSummons: true }

// Round count for a summon spell's duration at the caster's level.
export function spellDurationRounds(spell, casterLevel) {
  const { roundsPerCasterLevel, extraRounds } = spell.duration
  return casterLevel * roundsPerCasterLevel + extraRounds
}

function applySimpleTemplate(creature, templateId, simpleTemplates) {
  const tmpl = templateId ? simpleTemplates[templateId] : null
  const size = tmpl ? stepSize(creature.size, tmpl.sizeSteps) : normalizeSize(creature.size)

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

  const tableSlamDie = greenboundTemplate.slamDamageBySize[normalizeSize(intermediate.size)]
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
function skipGreenbound(intermediate, creature, { printedHp = false } = {}) {
  const { count: hdCount, die } = parseHitDice(creature.hitDice)
  const conMod = abilityMod(intermediate.abilities.con)
  return {
    size: intermediate.size,
    abilities: intermediate.abilities,
    naturalArmor: intermediate.naturalArmor,
    // A spell's creature appears exactly as printed, so its HP is the Hit
    // Dice line's own figure (Toughness and the like included).
    hp: printedHp ? printedAverageHp(creature.hitDice) : averageHp(hdCount, die, conMod),
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
  const sizeMod = sizeModifier(statBlock.size)
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
// Greenbound eligibility; Greenbound itself excludes elementals only.
//
// `spell` (with `slotLevel` set) is a non-summon-nature's-ally summon spell
// from data/tables/summonSpells.json; omitted, this is summon nature's ally
// with every feat effect on. The spell's `effects` flags decide which feat
// effects reach the creature — each feat names summon nature's ally, so by
// default none do and the creature is exactly as printed.
export function computeSummonStatBlock({
  sheet,
  creature,
  templateId,
  simpleTemplates,
  greenboundTemplate,
  spell = null,
}) {
  const character = sheet.character
  const flags = spell ? spell.effects : ALL_EFFECTS
  // Spell creatures can carry a parenthesised subtype ("Elemental (Air,
  // Swarm)"); the exclusion list names bare types.
  const typeExcluded = greenboundTemplate.excludedTypes.includes(
    spell ? bareCreatureType(creature.type) : creature.type,
  )
  const greenboundEligible = flags.greenboundSummoning && !typeExcluded
  const afterSimple = applySimpleTemplate(creature, templateId, simpleTemplates)
  const final = greenboundEligible
    ? applyGreenbound(afterSimple, creature, greenboundTemplate)
    : skipGreenbound(afterSimple, creature, { printedHp: spell != null })

  const featBonuses = collectSummonFeatBonuses(sheet.feats)
  const durationMultiplier = flags.ashbound ? featBonuses.durationMultiplier : 1
  const luckAttackBonus = flags.ashbound ? featBonuses.luckAttackBonus : 0

  // Some base creatures (Bat, Toad — real 3.5e stat blocks, not a data gap)
  // list no attacks at all. buildAttackRoutine assumes at least one entry
  // to pick a "best primary" from, so skip it entirely rather than call it
  // on an empty array — Greenbound-eligible creatures still get a slam
  // routine below regardless (it grants one "if it lacked one").
  const naturalWeaponRoutine =
    final.naturalAttacks.length > 0
      ? buildAttackRoutine({
          creature,
          attacks: final.naturalAttacks,
          statBlock: final,
          luckBonus: luckAttackBonus,
        })
      : null
  const slamRoutine = final.slamAttack
    ? buildAttackRoutine({ creature, attacks: [final.slamAttack], statBlock: final, luckBonus: luckAttackBonus })
    : null

  const sizeMod = sizeModifier(final.size)
  const dexMod = abilityMod(final.abilities.dex)
  const conMod = abilityMod(final.abilities.con)
  const wisMod = abilityMod(final.abilities.wis)
  const chaMod = abilityMod(final.abilities.cha)
  const ac = {
    total: 10 + sizeMod + dexMod + final.naturalArmor,
    touch: 10 + sizeMod + dexMod,
    flatFooted: 10 + sizeMod + final.naturalArmor + (dexMod > 0 ? 0 : dexMod),
  }

  // Saves are the summoned creature's own base progression by type/HD, not
  // Lyra's — unlike wild shape, a summon is a separate creature. Templates
  // don't change HD count, only HP die and ability scores, so HD comes from
  // the base creature's hit dice string regardless of pipeline stage.
  const { count: hdCount } = parseHitDice(creature.hitDice)
  const baseSaves = monsterBaseSaves(creature.type, hdCount, creature.name)
  const saves = {
    fort: { base: baseSaves.fort, abilityMod: conMod, total: baseSaves.fort + conMod },
    ref: { base: baseSaves.ref, abilityMod: dexMod, total: baseSaves.ref + dexMod },
    will: { base: baseSaves.will, abilityMod: wisMod, total: baseSaves.will + wisMod },
  }
  const initiative = dexMod

  const totemic = character.wolfShaman.totemicSummons
  const totemicActive =
    flags.totemicSummons && creature.isCanine && character.level >= totemic.activeFromCharacterLevel
  const tempHp = totemicActive && totemic.canineTempHpEqualsDruidLevel ? druidLevel(character.level) : 0

  const baseDurationRounds = spell
    ? spellDurationRounds(spell, character.casterLevel.druid)
    : character.casterLevel.druid
  const totalDurationRounds = baseDurationRounds * durationMultiplier

  const spellLevel = spell
    ? spell.slotLevel
    : spellLevelCost(creature, templateId, simpleTemplates, greenboundEligible, greenboundTemplate)

  const effects = buildEffectsLedger({
    spell,
    flags,
    creature,
    greenboundEligible,
    featBonuses,
    totemic,
    totemicActive,
    tempHp,
  })

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
    saves,
    initiative,
    speed: creature.speed,
    spell: spell
      ? {
          id: spell.id,
          name: spell.name,
          slotLevel: spell.slotLevel,
          castingTime: spell.castingTime,
          duration: spell.duration.label,
          concentration: spell.duration.concentration,
        }
      : null,
    effects,
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

// Which feat effects reached this summon and which did not, for the stat
// block to show at a glance. One row per feat that can touch a summon; a row
// that did not apply says why.
function buildEffectsLedger({
  spell,
  flags,
  creature,
  greenboundEligible,
  featBonuses,
  totemic,
  totemicActive,
  tempHp,
}) {
  const notForSpell = (key) => `${SPELL_EFFECT_FEATS[key]} names summon nature's ally only.`

  const greenbound = greenboundEligible
    ? { applied: true, detail: 'Plant type, d8 Hit Dice, slam, spell-like abilities and the other template qualities.' }
    : { applied: false, detail: flags.greenboundSummoning ? "Doesn't apply to elementals." : notForSpell('greenboundSummoning') }

  const ashboundParts = []
  if (featBonuses.durationMultiplier > 1) ashboundParts.push(`duration ×${featBonuses.durationMultiplier}`)
  if (featBonuses.luckAttackBonus > 0) ashboundParts.push(`+${featBonuses.luckAttackBonus} luck bonus on attack rolls`)
  const ashbound = flags.ashbound
    ? { applied: true, detail: ashboundParts.join(', ') }
    : { applied: false, detail: notForSpell('ashbound') }

  let totemicRow
  if (!flags.totemicSummons) {
    totemicRow = { applied: false, detail: notForSpell('totemicSummons') }
  } else if (!creature.isCanine) {
    totemicRow = { applied: false, detail: 'Canines only.' }
  } else if (!totemicActive) {
    totemicRow = { applied: false, detail: 'Not yet available at this level.' }
  } else {
    const parts = []
    if (tempHp > 0) parts.push(`+${tempHp} temporary hit points`)
    if (totemic.canineSummonCastTime === 'standard action') parts.push('cast as a standard action')
    totemicRow = { applied: true, detail: parts.join(', ') }
  }

  return [
    { id: 'greenboundSummoning', label: 'Greenbound Summoning', ...greenbound },
    { id: 'ashbound', label: 'Ashbound', ...ashbound },
    { id: 'totemicSummons', label: 'Totemic Summons', ...totemicRow },
  ].map((row) => ({ ...row, fromSpell: spell != null }))
}
