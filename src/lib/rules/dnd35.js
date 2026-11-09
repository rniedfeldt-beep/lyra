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

// Grapple checks use a different size scale than AC/attack (PHB p.155).
export const GRAPPLE_SIZE_MODIFIER = {
  Fine: -16,
  Diminutive: -12,
  Tiny: -8,
  Small: -4,
  Medium: 0,
  Large: 4,
  Huge: 8,
  Gargantuan: 12,
  Colossal: 16,
}

// Size names as the books print them are not always the 3.5 spelling: 3.0
// books say "Medium-size" (or "Medium-Size"). Every size read from data goes
// through here — trim, drop a "-size" suffix, match case-insensitively — so
// "Medium-Size", "medium-size" and " MEDIUM " all mean Medium. An unrecognised
// name comes back trimmed and unchanged (and fails the lookups loudly).
export function normalizeSize(size) {
  if (typeof size !== 'string') return size
  const cleaned = size.trim().replace(/-size$/i, '').trim()
  return SIZE_ORDER.find((s) => s.toLowerCase() === cleaned.toLowerCase()) ?? cleaned
}

export function sizeModifier(size) {
  return SIZE_MODIFIER[normalizeSize(size)]
}

export function grappleSizeModifier(size) {
  return GRAPPLE_SIZE_MODIFIER[normalizeSize(size)]
}

export function sizeIndex(size) {
  const i = SIZE_ORDER.indexOf(normalizeSize(size))
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

// Parses a Hit Dice string into { count, die, mod, pools }.
//  - "6d8+18" — one pool and a flat modifier.
//  - "1/2d6-1" — the fractional form (Tiny/Fine animals), count 0.5.
//  - "7d8+7+9" — separate flat terms are summed (Con plus Toughness).
//  - "8d10+7d8+75" — mixed pools (racial Hit Dice plus class levels): every
//    pool is read and listed in `pools`; `count` is the total number of dice
//    and `die` the size of the biggest pool.
export function parseHitDice(hitDice) {
  const text = String(hitDice ?? '').replace(/\s+/g, '')
  const term = /([+-]?)(?:(\d+)(?:\/(\d+))?d(\d+)|(\d+))/y
  const pools = []
  let mod = 0
  let at = 0
  while (at < text.length) {
    term.lastIndex = at
    const m = term.exec(text)
    // After the first term every term needs its sign ("7d8+75", not "7d875").
    if (!m || (at > 0 && !m[1])) throw new Error(`Unrecognized hit dice format "${hitDice}"`)
    const sign = m[1] === '-' ? -1 : 1
    if (m[4] != null) {
      pools.push({ count: (sign * Number(m[2])) / Number(m[3] ?? 1), die: Number(m[4]) })
    } else {
      mod += sign * Number(m[5])
    }
    at = term.lastIndex
  }
  if (pools.length === 0) throw new Error(`Unrecognized hit dice format "${hitDice}"`)
  const count = pools.reduce((n, p) => n + p.count, 0)
  const die = pools.reduce((best, p) => (p.count > best.count ? p : best), pools[0]).die
  return { count, die, mod, pools }
}

// Average hit points exactly as the Hit Dice line prints them: each pool's
// dice average plus the printed flat modifier (so Toughness and the like are
// included, unlike averageHp below, which rebuilds the bonus from Con).
export function printedAverageHp(hitDice) {
  const { pools, mod } = parseHitDice(hitDice)
  const dice = pools.reduce((n, p) => n + Math.floor(p.count * (p.die / 2 + 0.5)), 0)
  return Math.max(1, dice + mod)
}

// Average hit points for a full set of HD at a given die size and Con mod,
// using the standard floor(count * (die/2 + 0.5)) + count * conMod approach.
export function averageHp(hdCount, die, conMod) {
  return Math.floor(hdCount * (die / 2 + 0.5)) + Math.round(hdCount * conMod)
}

// The same for a Hit Dice string that may mix dice (8d10+7d8): each pool's
// average at its own die, plus the Con bonus on every die. For a single pool
// this is exactly averageHp.
export function averageHpForPools(pools, conMod) {
  const count = pools.reduce((n, p) => n + p.count, 0)
  const dice = pools.reduce((n, p) => n + Math.floor(p.count * (p.die / 2 + 0.5)), 0)
  return dice + Math.round(count * conMod)
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
