// Core 3.5e system constants shared across wild shape and summoning — these
// are fixed game rules (not campaign data), so they live as code, not JSON.

export const SIZE_ORDER = [
  'Fine',
  'Diminutive',
  'Tiny',
  'Small',
  'Medium',
  'Large',
  'Huge',
  'Gargantuan',
  'Colossal',
]

// Same table serves both AC and attack-roll size modifiers in 3.5e.
export const SIZE_MODIFIER = {
  Fine: 8,
  Diminutive: 4,
  Tiny: 2,
  Small: 1,
  Medium: 0,
  Large: -1,
  Huge: -2,
  Gargantuan: -4,
  Colossal: -8,
}

export function sizeIndex(size) {
  const i = SIZE_ORDER.indexOf(size)
  if (i === -1) throw new Error(`Unknown size "${size}"`)
  return i
}

export function sizeAtMost(size, maxSize) {
  return sizeIndex(size) <= sizeIndex(maxSize)
}

export function stepSize(size, steps) {
  const next = sizeIndex(size) + steps
  if (next < 0 || next >= SIZE_ORDER.length) {
    throw new Error(`Cannot step size "${size}" by ${steps}`)
  }
  return SIZE_ORDER[next]
}

// Parses a hit-dice string like "6d8+18" or the fractional "1/2d8" form used
// for Tiny/Fine animals into { count, die, mod }. count is a number (0.5 for
// the fractional form). The fractional form can carry a modifier too
// ("1/2d6-1", Jermlaine) — this used to throw on that shape.
export function parseHitDice(hitDice) {
  const fractional = hitDice.match(/^(\d+)\/(\d+)d(\d+)([+-]\d+)?$/)
  if (fractional) {
    const [, num, den, die, mod] = fractional
    return { count: Number(num) / Number(den), die: Number(die), mod: mod ? Number(mod) : 0 }
  }
  const match = hitDice.match(/^(\d+)d(\d+)([+-]\d+)?$/)
  if (!match) throw new Error(`Unrecognized hit dice format "${hitDice}"`)
  const [, count, die, mod] = match
  return { count: Number(count), die: Number(die), mod: mod ? Number(mod) : 0 }
}

// Average hit points for a full set of HD at a given die size and Con mod,
// using the standard floor(count * (die/2 + 0.5)) + count * conMod approach.
export function averageHp(hdCount, die, conMod) {
  return Math.floor(hdCount * (die / 2 + 0.5)) + Math.round(hdCount * conMod)
}

const DAMAGE_DIE_LADDER = ['1d2', '1d3', '1d4', '1d6', '1d8', '2d6', '2d8', '3d6', '3d8']

export function stepDamageDie(die, steps) {
  const i = DAMAGE_DIE_LADDER.indexOf(die)
  if (i === -1) return die // non-standard die (e.g. "0" for a grapple-only attack) — leave as-is
  const next = i + steps
  if (next < 0) return DAMAGE_DIE_LADDER[0]
  if (next >= DAMAGE_DIE_LADDER.length) return DAMAGE_DIE_LADDER[DAMAGE_DIE_LADDER.length - 1]
  return DAMAGE_DIE_LADDER[next]
}

// Greenbound slam damage by size (CLAUDE.md > Summoning > Greenbound template).
export const GREENBOUND_SLAM_DAMAGE = {
  Fine: '1',
  Diminutive: '1d2',
  Tiny: '1d3',
  Small: '1d4',
  Medium: '1d6',
  Large: '1d8',
  Huge: '2d6',
  Gargantuan: '2d8',
  Colossal: '4d6',
}

// Average damage from a "NdM" (or flat "N") string, for comparing dice.
export function averageDamage(die) {
  const flat = die.match(/^(\d+)$/)
  if (flat) return Number(flat[1])
  const match = die.match(/^(\d+)d(\d+)$/)
  if (!match) return 0
  const [, count, sides] = match
  return Number(count) * (Number(sides) / 2 + 0.5)
}

// Standard 3.5e base-save-per-level formulas (PHB p.59 class table patterns)
// — fixed system math, not campaign data. A "good" save is 2 + floor(level/2),
// a "poor" save is floor(level/3), for any class or creature HD progression
// that uses those tracks.
export function goodSaveForLevel(level) {
  return 2 + Math.floor(level / 2)
}

export function poorSaveForLevel(level) {
  return Math.floor(level / 3)
}

// Standard 3/4 ("medium") base attack bonus progression — PHB p.59.
export function threeQuarterBabForLevel(level) {
  return Math.floor((level * 3) / 4)
}

// Base save progression by creature type — Monster Manual Table 4-1,
// Creature Improvement by Type (p.290). Fixed 3.5e rule, not campaign data.
// Two kinds of type don't fit a plain lookup:
//  - Elemental: which save is good depends on the element subtype (Air/Fire
//    -> Reflex, Earth/Water -> Fortitude), see ELEMENT_GOOD_SAVE below.
//  - Humanoid: "one good save, varies" per race — there is no type-wide
//    answer, so it's deliberately absent and throws rather than guessing.
// Beast is the 3.0-edition type MM2 still prints for a few dinosaurs; 3.5
// folds those into Animal, which has the same progression.
const GOOD_SAVES_BY_TYPE = {
  Aberration: ['will'],
  Animal: ['fort', 'ref'],
  Beast: ['fort', 'ref'],
  Construct: [],
  Dragon: ['fort', 'ref', 'will'],
  Fey: ['ref', 'will'],
  Giant: ['fort'],
  'Magical Beast': ['fort', 'ref'],
  'Monstrous Humanoid': ['ref', 'will'],
  Ooze: [],
  Outsider: ['fort', 'ref', 'will'],
  Plant: ['fort'],
  Undead: ['will'],
  Vermin: ['fort'],
}

const ELEMENT_GOOD_SAVE = { air: 'ref', fire: 'ref', earth: 'fort', water: 'fort' }

// A creature with two element subtypes (paraelementals: "Elemental (Earth,
// Fire)") gets the good save of each — the table doesn't say how to combine
// them, so this is the union. Bare "Elemental" entries carry their element
// in the name instead ("Elemental, Small Air"), so the name is the fallback.
function elementalGoodSaves(subtypes, name) {
  let elements = subtypes.map((s) => s.toLowerCase()).filter((s) => s in ELEMENT_GOOD_SAVE)
  if (elements.length === 0 && name) {
    elements = Object.keys(ELEMENT_GOOD_SAVE).filter((e) => new RegExp(`\\b${e}\\b`, 'i').test(name))
  }
  if (elements.length === 0) return null
  return [...new Set(elements.map((e) => ELEMENT_GOOD_SAVE[e]))]
}

// "Elemental (Air, Cold)" -> "Elemental". Anything comparing a creature's
// type against a plain name should go through this, since subtypes are
// printed in parentheses on the type.
export function bareCreatureType(type) {
  return type.replace(/\s*\(.*\)\s*$/, '')
}

export function monsterBaseSaves(type, hd, name) {
  const bareType = bareCreatureType(type)
  const subtypes = (type.match(/\((.*)\)/)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const good = bareType === 'Elemental' ? elementalGoodSaves(subtypes, name) : GOOD_SAVES_BY_TYPE[bareType]
  if (!good) {
    throw new Error(
      bareType === 'Elemental'
        ? `Can't tell which element "${name ?? type}" is, so its good save is unknown`
        : `No base save progression known for creature type "${type}"`,
    )
  }
  const goodSave = goodSaveForLevel(hd)
  const poorSave = poorSaveForLevel(hd)
  return {
    fort: good.includes('fort') ? goodSave : poorSave,
    ref: good.includes('ref') ? goodSave : poorSave,
    will: good.includes('will') ? goodSave : poorSave,
  }
}

// Character level -> effective druid class level. Diverges from character
// level once Planar Shepherd levels start stacking in (CLAUDE.md > Class
// Progression). Druid resumes advancing past character level 15.
export function druidLevel(charLevel) {
  if (charLevel <= 5) return charLevel
  if (charLevel <= 15) return 5
  return charLevel - 10
}
