import { abilityMod } from './abilities'
import { computeSaves } from './saves'
import { SIZE_MODIFIER, sizeAtMost, parseHitDice } from '../rules/dnd35'

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
// plus the size/HD caps from her wildShape data.
export function getEligibleWildShapeForms({ monsterManual, characterLevel, maxSize, maxHd }) {
  return monsterManual.filter((creature) => {
    if (creature.wildShapeMinLevel == null || creature.wildShapeMinLevel > characterLevel) {
      return false
    }
    if (!sizeAtMost(creature.size, maxSize)) return false
    const { count } = parseHitDice(creature.hitDice)
    if (count > maxHd) return false
    return true
  })
}

function computeFormAttackRoutine({ bab, creature, strMod }) {
  const sizeMod = SIZE_MODIFIER[creature.size]
  const attackBonusBase = bab + strMod + sizeMod
  const singleWeapon = creature.attacks.length === 1

  return creature.attacks.map((atk) => {
    const strMult = singleWeapon ? 1.5 : atk.primary ? 1 : 0.5
    const damageStrMod = Math.floor(strMod * strMult)
    return {
      name: atk.name,
      count: atk.count ?? 1,
      primary: atk.primary,
      attackBonus: attackBonusBase - (atk.primary ? 0 : 5),
      damage: {
        die: atk.damage,
        bonus: damageStrMod,
        crit: atk.crit,
      },
    }
  })
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
    str: { ...abilityScores.str, mod: strMod },
    dex: { ...abilityScores.dex, mod: dexMod },
    con: { ...abilityScores.con, mod: conMod },
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
  }
}
