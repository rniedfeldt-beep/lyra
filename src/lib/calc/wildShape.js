import { abilityMod } from './abilities'
import { computeSaves } from './saves'
import { SIZE_MODIFIER, sizeAtMost, parseHitDice, averageDamage } from '../rules/dnd35'

// Which special qualities/attacks are available below Planar Shepherd 9
// (character level 14): only Extraordinary (Ex). Animals never have Su/Sp
// abilities in 3.5e, so their full lists are always safe to show. For other
// types, spell-like abilities are filtered generically, plus a small
// explicit exclusion list for known Supernatural abilities on the handful
// of non-animal forms currently reachable.
const KNOWN_SU_ABILITIES = {
  Unicorn: new Set(['magic circle against evil']),
}

function isSpellLike(name) {
  return /spell-like/i.test(name)
}

export function computeAvailableAbilities(creature, characterLevel) {
  const all = [...(creature.specialQualities ?? []), ...(creature.specialAttacks ?? [])]
  if (characterLevel >= 14) return all // PS9+: full Ex/Su/Sp per CLAUDE.md
  if (creature.type === 'Animal') return all
  const excluded = KNOWN_SU_ABILITIES[creature.name] ?? new Set()
  return all.filter((a) => !isSpellLike(a) && !excluded.has(a))
}

// Forms Lyra can currently assume: type-access gated by wildShapeMinLevel,
// the size/HD caps from her wildShape data, and lyraFamiliar (has she ever
// plausibly encountered this creature — common Greyhawk animals, anything
// on a Summon Nature's Ally list she can currently cast, or a DM-approved
// Feywild form).
export function getEligibleWildShapeForms({ monsterManual, characterLevel, maxSize, maxHd }) {
  return monsterManual.filter((creature) => {
    if (creature.wildShapeMinLevel == null || creature.wildShapeMinLevel > characterLevel) {
      return false
    }
    if (!creature.lyraFamiliar) return false
    if (!sizeAtMost(creature.size, maxSize)) return false
    const { count } = parseHitDice(creature.hitDice)
    if (count > maxHd) return false
    return true
  })
}

function buildFormAttack(atk, { attackBonusBase, strMod, singleWeapon, forceCount1 }) {
  // A sole natural weapon normally gets the full 1.5x, unless the source
  // text explicitly writes it up as a secondary attack anyway (e.g.
  // Ur'Epona's hoof) — that override always wins.
  const strMult = atk.primary === false ? 0.5 : singleWeapon ? 1.5 : 1
  const damageStrMod = Math.floor(strMod * strMult)
  return {
    name: atk.name,
    count: forceCount1 ? 1 : (atk.count ?? 1),
    primary: atk.primary,
    attackBonus: attackBonusBase - (atk.primary ? 0 : 5),
    damage: {
      die: atk.damage,
      bonus: damageStrMod,
      crit: atk.crit,
    },
  }
}

// Single attack (standard action, best primary weapon only) vs. full attack
// (full-round action, primary at full count plus all secondaries at -5).
function computeFormAttackRoutine({ bab, creature, strMod }) {
  // A few forms (Bat, Toad — real 3.5e stat blocks, not a data gap) list no
  // attacks at all. Unlike a summon, wild shape has no Greenbound-style
  // fallback to grant one — a druid shaped into a bat genuinely has no
  // attack option in that form.
  if (creature.attacks.length === 0) return { single: [], full: [], hasSecondaries: false }

  const sizeMod = SIZE_MODIFIER[creature.size]
  const attackBonusBase = bab + strMod + sizeMod
  const singleWeapon = creature.attacks.length === 1

  const full = creature.attacks.map((atk) =>
    buildFormAttack(atk, { attackBonusBase, strMod, singleWeapon }),
  )

  const primaries = creature.attacks.filter((a) => a.primary !== false)
  const bestPrimary = primaries.reduce(
    (best, atk) => (averageDamage(atk.damage) > averageDamage(best.damage) ? atk : best),
    primaries[0],
  )
  const single = [
    buildFormAttack(bestPrimary, { attackBonusBase, strMod, singleWeapon, forceCount1: true }),
  ]

  const hasSecondaries = creature.attacks.length > 1 || (creature.attacks[0].count ?? 1) > 1

  return { single, full, hasSecondaries }
}

// The polymorph swap: retained stats (BAB, base saves, HP, skill ranks,
// feats, Int/Wis/Cha) stay Lyra's own; taken-from-form stats (Str/Dex/Con,
// size, natural armor, speed, natural attacks) come from the creature.
export function computeWildShapeStatBlock({ sheet, creature }) {
  const { character, abilityScores, progression, feats } = sheet
  const strMod = abilityMod(creature.abilities.str)
  const dexMod = abilityMod(creature.abilities.dex)
  const conMod = abilityMod(creature.abilities.con)
  const sizeMod = SIZE_MODIFIER[creature.size]

  const deflection = sheet.items.ring?.acBonus ?? 0
  const ac = {
    total: 10 + sizeMod + dexMod + creature.naturalArmor + deflection,
    touch: 10 + sizeMod + dexMod + deflection,
    flatFooted: 10 + sizeMod + creature.naturalArmor + deflection + (dexMod > 0 ? 0 : dexMod),
  }

  const formAbilityScores = {
    ...abilityScores,
    str: { ...abilityScores.str, score: creature.abilities.str, mod: strMod },
    dex: { ...abilityScores.dex, score: creature.abilities.dex, mod: dexMod },
    con: { ...abilityScores.con, score: creature.abilities.con, mod: conMod },
  }
  const saves = computeSaves({ baseSaves: progression, abilityScores: formAbilityScores, feats })

  const landSpeed = creature.speed.land != null ? creature.speed.land + (creature.isCanine ? 20 : 0) : undefined
  const speed = { ...creature.speed, ...(landSpeed !== undefined ? { land: landSpeed } : {}) }

  const attackRoutine = computeFormAttackRoutine({ bab: progression.bab, creature, strMod })

  return {
    creature,
    hp: character.hp.max,
    ac,
    saves,
    speed,
    attackRoutine,
    abilities: computeAvailableAbilities(creature, character.level),
    // Str/Dex/Con come from the form; Int/Wis/Cha pass through unchanged —
    // consumers that need to show "what stays the same" can read either
    // straight off this object without special-casing which three moved.
    abilityScores: formAbilityScores,
    initiative: dexMod,
  }
}

// Looks up the active form (if any) from characterProgress's
// activeWildShapeForm by name and computes its full stat block in one call —
// the single source both the collapsible Wild Shape card and the main sheet
// components (which need the *same* numbers, not a recomputed copy) call
// into, so there's exactly one wild-shape-active-or-not branch to reason
// about anywhere in the app.
export function getActiveWildShapeStatBlock({ sheet, activeForm, monsterManual }) {
  if (!activeForm) return null
  const creature = monsterManual.find((c) => c.name === activeForm.creatureName)
  if (!creature) return null
  return computeWildShapeStatBlock({ sheet, creature })
}
