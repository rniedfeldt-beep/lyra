// Finds spell names inside a creature ability's free text ("blink (Su, as the
// blink spell, ...)", "spell-like abilities (at will—alter self, detect
// magic; ...)") so they can be made expandable. Pure — it takes the set of
// known spell names rather than loading spell data itself.
//
// Matching spell names anywhere in a string would be wrong: plenty of
// ordinary words are also spells ("immune to sleep", "fly speed", "poison
// (Ex, claw ...)"). So only three zones are searched, each a place a spell
// is actually being named:
//  1. A leading ability name whose parenthetical starts Sp or Su
//     ("plane shift (Sp, ...)", "chill metal (Su, ...)") — the ability *is*
//     that spell. An (Ex) ability named like a spell ("poison (Ex ...)") isn't,
//     and neither is a long (Su) with mechanics of its own that merely shares
//     a name with a spell (an air elemental's whirlwind vs. the Whirlwind
//     spell): a Su only counts when its parenthetical is short or says it
//     works like a spell.
//  2. Right after a phrase that points at a spell: "as the blink spell",
//     "as speak with animals", "functions as enlarge person or reduce
//     person", "as though by a sleep spell", "like a fog cloud", "with charm
//     person, sleep, or fear" — a chain of names joined by commas/and/or.
//  3. The whole body of a "spell-like abilities ..." / "spells ..." entry,
//     which is a list of spell names.
// Anything not in `known` is left as plain text, which is expected: many of
// these are arcane spells outside the druid extraction.

export function normalizeSpellName(name) {
  return name
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const WORD = /[A-Za-z][A-Za-z'’-]*/g
const MAX_WORDS = 7

function tokenize(text) {
  return [...text.matchAll(WORD)].map((m) => ({ start: m.index, end: m.index + m[0].length }))
}

// Longest spell name starting at token i, or null.
function longestAt(text, tokens, i, known) {
  for (let n = Math.min(MAX_WORDS, tokens.length - i); n >= 1; n--) {
    const start = tokens[i].start
    const end = tokens[i + n - 1].end
    if (known.has(normalizeSpellName(text.slice(start, end))) && endsPhrase(text, end)) {
      return { start, end, next: i + n }
    }
  }
  return null
}

// A name only counts when it ends the phrase: "polymorph self" must not match
// the shorter "polymorph" and leave "self" dangling. What may follow is
// punctuation, a number, the end, or one of these filler words.
const FOLLOWERS = new Set([
  'at', 'each', 'and', 'or', 'as', 'by', 'within', 'with', 'only', 'once', 'per', 'in', 'on', 'to',
  'for', 'spell', 'cast', 'usable', 'that', 'which', 'but',
])

function endsPhrase(text, end) {
  const next = text.slice(end).match(/^ +([A-Za-z][A-Za-z'’-]*)/)
  return !next || FOLLOWERS.has(next[1].toLowerCase())
}

// Contents of the first parenthetical, balanced.
function firstParenthetical(text) {
  const open = text.indexOf('(')
  if (open === -1) return ''
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return text.slice(open + 1, i)
  }
  return text.slice(open + 1)
}

const POINTER = /\b(?:functions as|as though by|as cast by|as|like|with)\s+(?:(?:the|a|an)\s+)?(?:(?:druid|cleric|wizard|sorcerer|arcane|divine)\s+spell\s+)?/gi
const CHAIN_JOINER = /^(?:\s*,\s*(?:(?:or|and)\s+)?|\s+(?:or|and)\s+)/

export function findSpellMentions(text, known) {
  const found = []
  const tokens = tokenize(text)
  const tokenAt = (pos) => tokens.findIndex((t) => t.start >= pos)

  // Zone 3 — a list entry: every name in the string.
  if (/^\s*(?:spell-like abilities|spells)\b/i.test(text)) {
    for (let i = 0; i < tokens.length; ) {
      const hit = longestAt(text, tokens, i, known)
      if (hit) {
        found.push(hit)
        i = hit.next
      } else i++
    }
  } else {
    // Zone 1 — the ability's own name, when it's a Sp/Su.
    const lead = text.match(/^(\s*)([^(]+?)\s*\(\s*(?:Sp|Su)\b/)
    if (lead) {
      const start = lead[1].length
      const end = start + lead[2].length
      const inner = firstParenthetical(text)
      const isSu = /^\s*Su\b/.test(inner)
      const spellLike = !isSu || inner.length <= 70 || /\bspell\b|\bas (?:the )?\w|caster level/i.test(inner)
      if (spellLike && known.has(normalizeSpellName(lead[2]))) found.push({ start, end })
    }
  }

  // Zone 2 — names pointed at by "as ...", "with ...", etc.
  for (const m of text.matchAll(POINTER)) {
    let pos = m.index + m[0].length
    for (;;) {
      const ti = tokenAt(pos)
      if (ti === -1) break
      const hit = longestAt(text, tokens, ti, known)
      if (!hit) break
      found.push(hit)
      const joiner = text.slice(hit.end).match(CHAIN_JOINER)
      if (!joiner) break
      pos = hit.end + joiner[0].length
    }
  }

  // Drop overlaps, keep left-to-right order.
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const out = []
  for (const f of found) {
    if (out.length && f.start < out[out.length - 1].end) continue
    out.push({ start: f.start, end: f.end, name: text.slice(f.start, f.end) })
  }
  return out
}

// [{ text } | { text, spell }] — text split around the mentions.
export function splitBySpellMentions(text, known) {
  const parts = []
  let at = 0
  for (const m of findSpellMentions(text, known)) {
    if (m.start > at) parts.push({ text: text.slice(at, m.start) })
    parts.push({ text: m.name, spell: normalizeSpellName(m.name) })
    at = m.end
  }
  if (at < text.length) parts.push({ text: text.slice(at) })
  return parts
}
