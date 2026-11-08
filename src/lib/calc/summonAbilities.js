// Limited-use abilities of a summoned creature, and the notes worth showing
// on its stat block.
//
// Creature stat blocks keep their special attacks and qualities as printed
// text ("charm person (Sp, 3/day, as the spell, ...)", "spell-like abilities
// (caster level 8th): 1/day -- entangle, dispel magic ..."), so the daily
// limits are read out of that text. Only limits per DAY are tracked — "once
// every 10 minutes" or "once per round" are cooldowns, not a daily budget.

const DASH = '(?:--|—|–|-|:)'

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

// Splits on `sep` only where it isn't inside (...) or [...] — annotations
// like "(smoke cloud only, DC 15)" or "[caster level 12th, 1 hour]" keep
// their own commas and semicolons.
function splitTopLevel(text, sep) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    else if (ch === sep && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

// A comma-separated list of spell-like abilities, e.g.
// "greater teleport, within its home forest only" — a fragment that reads as
// a qualifier ("within…", "DC 21", "as a free action") belongs to the item
// before it, as part of its annotation.
const QUALIFIER_START = /^(?:within|as|only|self|caster|by|in|on|to|with|when|usable|DC)\b/i

function splitAbilityList(text) {
  const items = []
  for (const raw of splitTopLevel(text, ',')) {
    const piece = raw.trim().replace(/^and\s+/i, '').replace(/\.$/, '').trim()
    if (!piece) continue
    if (items.length > 0 && QUALIFIER_START.test(piece)) {
      items[items.length - 1].qualifiers.push(piece)
    } else {
      items.push({ text: piece, qualifiers: [] })
    }
  }
  return items.map(({ text: item, qualifiers }) => {
    const m = item.match(/^(.*?)\s*([[(].*[\])])?$/s)
    const name = (m?.[1] ?? item).trim()
    const annotation = [item.slice(name.length).trim(), ...qualifiers].filter(Boolean).join(', ')
    return { name, annotation }
  })
}

// "spell-like abilities (caster level 3rd, Cha-based DCs): at will -- a, b; 3/day -- c"
// "Spell-like abilities (1/day—fog cloud, improved invisibility; caster level 11th, ...)"
// "spell-like abilities: pass without trace at will (...); jump and mirror image, each 1/day (...)"
function parseSpellLikeBlock(text) {
  let body = text.replace(/^spell-like abilities\s*/i, '')
  const header = body.match(/^\([^)]*\)\s*:\s*/)
  if (header) {
    body = body.slice(header[0].length)
  } else if (body.startsWith(':')) {
    body = body.slice(1).trim()
  } else if (body.startsWith('(')) {
    body = body.slice(1)
    if (body.endsWith(')')) body = body.slice(0, -1)
  }

  const found = []
  for (const segment of splitTopLevel(body, ';')) {
    const seg = segment.trim()

    // "3/day -- a, b, c" (a frequency, then the abilities it covers)
    const prefixed = seg.match(new RegExp(`^(?:at will|(\\d+)\\s*/\\s*day)\\s*${DASH}\\s*(.+)$`, 'is'))
    if (prefixed) {
      if (prefixed[1]) {
        for (const item of splitAbilityList(prefixed[2])) found.push({ ...item, usesPerDay: Number(prefixed[1]) })
      }
      continue
    }

    // "a, b, and c, each 1/day" / "cure light wounds 3/day and cure moderate wounds 1/day"
    let cut = 0
    for (const m of seg.matchAll(/(?:\beach\s+)?(\d+)\s*\/\s*day/gi)) {
      const names = seg.slice(cut, m.index).replace(/^[\s,]*(?:and\s+)?/i, '').replace(/[\s,]+$/, '')
      cut = m.index + m[0].length
      for (const item of splitAbilityList(names)) found.push({ ...item, usesPerDay: Number(m[1]) })
    }
  }
  return found
}

const WORD_COUNTS = { once: 1, twice: 2 }

// "water breathing (Sp -- 4/day, as a 12th-level sorcerer)" — one named
// ability whose own parenthetical states its daily limit.
function parseSingleAbility(text) {
  const m = text.match(
    /^([^(]+?)\s*\((?:Sp|Su|Ex)\b[^)]*?(?:(\d+)\s*\/\s*day|\b(once|twice)\s+(?:per|a)\s+day)/i,
  )
  if (!m) return null
  return { name: m[1].trim(), annotation: '', usesPerDay: m[2] ? Number(m[2]) : WORD_COUNTS[m[3].toLowerCase()] }
}

function creatureLimitedAbilities(creature) {
  const texts = [...(creature.specialAttacks ?? []), ...(creature.specialQualities ?? [])]
  const found = []
  for (const text of texts) {
    if (/^spell-like abilities\b/i.test(text)) {
      found.push(...parseSpellLikeBlock(text))
      continue
    }
    const single = parseSingleAbility(text)
    if (single) found.push(single)
  }
  return found
}

// Every limited-use ability a summoned creature has, from any source: the
// Greenbound template's per-day spell-like abilities (only when that
// template was applied) and the creature's own printed abilities. Returns
// [{ key, name, annotation, usesPerDay, source: 'creature' | 'greenbound' }];
// `key` is stable for a given creature + template, so a member's recorded
// uses stay attached to the right ability.
export function limitedUseAbilities(statBlock) {
  const abilities = []
  const seen = new Map()
  const add = (source, item) => {
    const base = `${source}:${slug(item.name)}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    abilities.push({
      key: n === 1 ? base : `${base}-${n}`,
      name: capitalize(item.name),
      annotation: item.annotation,
      usesPerDay: item.usesPerDay,
      source,
    })
  }

  for (const s of statBlock.spellLikeAbilities?.perDay ?? []) {
    add('greenbound', { name: s.spell, annotation: '', usesPerDay: s.usesPerDay })
  }
  for (const item of creatureLimitedAbilities(statBlock.creature)) add('creature', item)
  return abilities
}

// How many uses of an ability a summon member has spent. Summons cast before
// per-ability tracking existed recorded wall of thorns as a boolean.
export function usedUses(member, ability) {
  const recorded = member.abilityUses?.[ability.key]
  if (recorded != null) return recorded
  if (ability.key === 'greenbound:wall-of-thorns' && member.wallOfThornsUsed) return 1
  return 0
}

// Creature notes carry two kinds of sentence: things worth knowing at the
// table (a misprinted save, how a swarm squeezes through gaps) and notes on
// how the entry was compiled (which list it was added to, which field was
// left empty). Only the first kind belongs on a stat block.
const COMPILATION_NOTE =
  /summonNaturesAllyLevel|wildShapeMinLevel|feywildNative|baseAttackBonus|specialAttacks|specialQualities|\bnull\b|Dragon Magazine|Task list|reachable only through|never a wild shape form|not by summon nature's ally|creature entry is on p\.|also reachable through|Player's Handbook summon nature's ally|comes from Dragon|^The summon nature's ally [IVX]+ |naturalArmor|back-solves?|Hit Dice printed as|confirmed as|verified directly/i

export function noteSentences(creature) {
  if (!creature.note) return []
  return creature.note
    .split(/(?<=\.)\s+(?=[A-Z]|wildShapeMinLevel|feywildNative|specialAttacks|summonNaturesAllyLevel|baseAttackBonus)/)
    .map((s) => capitalize(s.trim().replace(/^Note:\s*/, '')))
    .filter((s) => s && !COMPILATION_NOTE.test(s))
}
