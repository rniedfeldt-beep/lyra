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
// the fractional form).
export function parseHitDice(hitDice) {
  const fractional = hitDice.match(/^(\d+)\/(\d+)d(\d+)$/)
  if (fractional) {
    const [, num, den, die] = fractional
    return { count: Number(num) / Number(den), die: Number(die), mod: 0 }
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

// Character level -> effective druid class level. Diverges from character
// level once Planar Shepherd levels start stacking in (CLAUDE.md > Class
// Progression). Druid resumes advancing past character level 15.
export function druidLevel(charLevel) {
  if (charLevel <= 5) return charLevel
  if (charLevel <= 15) return 5
  return charLevel - 10
}
