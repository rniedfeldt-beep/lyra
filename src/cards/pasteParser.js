// Offline, rule-based parser for spell text pasted out of a PDF (a full 3.5e
// stat block plus description) — no API calls, just the SRD's own regular
// structure. See CLAUDE.md > Spell cards (/cards) > Paste to fill.

/* ── cleanup ───────────────────────────────────────────────────── */

// A curated list of common spell-text words that contain an fi/fl/ff
// ligature — PDF extraction sometimes renders the ligature glyph as a
// stray space, splitting the word. Fixing this generically (any letters +
// space + fi/fl/ff + letters) is too eager: it would mangle perfectly
// correct text like "to flee" or "is fine". A small known-word list avoids
// that false-positive risk entirely, at the cost of only fixing words on
// the list — acceptable for a personal tool where you fix the rest by hand.
const LIGATURE_WORDS = [
  'reflex', 'reflexes', 'effect', 'effects', 'effective', 'ineffective',
  'difficult', 'sufficient', 'insufficient', 'efficient', 'inefficient',
  'flame', 'flames', 'flesh', 'fly', 'flying', 'flee', 'fled', 'flask',
  'flat', 'flicker', 'flickering', 'flight', 'float', 'floating', 'flood',
  'floor', 'flow', 'flower', 'fluid', 'flush', 'flux', 'influence',
  'influenced', 'afflict', 'afflicted', 'affliction', 'office', 'officer',
  'offer', 'offering', 'buff', 'buffer', 'cliff', 'differ', 'different',
  'difference', 'staff', 'stiff', 'stiffen', 'stuff', 'suffer',
  'suffering', 'sniff', 'snuff', 'whiff', 'fire', 'fireball', 'first',
  'fist', 'fit', 'five', 'fix', 'fixed', 'finger', 'fingers', 'fine',
  'final',
]

function fixLigatures(text) {
  let out = text
  for (const word of LIGATURE_WORDS) {
    const m = word.match(/fl|ffi|ffl|ff|fi/)
    if (!m) continue
    const idx = m.index
    const lig = m[0]
    const before = word.slice(0, idx)
    const after = word.slice(idx + lig.length)
    const patterns = []
    if (before) patterns.push(`${before}\\s+${lig}${after}`)
    if (after) patterns.push(`${before}${lig}\\s+${after}`)
    for (const pattern of patterns) {
      const re = new RegExp(`\\b${pattern}\\b`, 'gi')
      out = out.replace(re, (matched) => (/^[A-Z]/.test(matched) ? word[0].toUpperCase() + word.slice(1) : word))
    }
  }
  return out
}

function normalizePunctuation(text) {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
}

// A PDF copy/paste routinely carries non-breaking or other Unicode space
// variants (most often U+00A0, e.g. between a number and its unit) and,
// less often, zero-width characters left over from ligature substitution
// or a BOM. Both look identical to a normal space or nothing at all once
// rendered, but neither is stripped by String.prototype.trim() the way a
// caller might expect for the *zero-width* ones — and both, if they land
// in a value later compared exactly (school → card colour, see
// normalizeSchoolKey in cardRender.js), silently break that match even
// though the text reads as correct everywhere it's displayed.
function normalizeInvisibleChars(text) {
  return text
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
}

// Standalone page numbers and short all-caps running headers, each on
// their own line — never legitimate content in a spell's stat block or
// description, which is always title-case prose.
function stripPageNoise(text) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (t === '') return true
      if (/^\d+$/.test(t)) return false
      const words = t.split(/\s+/)
      // Strip a trailing version fragment ("v3.5") before the all-caps
      // check — a running header like "PLAYER'S HANDBOOK v3.5" is still a
      // header even though that suffix isn't itself all-caps.
      const letters = t.replace(/\s*v?\d[\d.]*\s*$/i, '').replace(/[^A-Za-z]/g, '')
      if (words.length <= 8 && letters.length > 0 && letters === letters.toUpperCase()) return false
      return true
    })
    .join('\n')
}

export function cleanPastedText(raw) {
  let text = (raw || '').replace(/\r\n?/g, '\n')
  text = normalizeInvisibleChars(text)
  text = normalizePunctuation(text)
  text = fixLigatures(text)
  text = stripPageNoise(text)
  return text
}

/* ── stat block ────────────────────────────────────────────────── */

const LABELS = [
  { key: 'level', re: /^level\s*:\s*/i },
  { key: 'components', re: /^components?\s*:\s*/i },
  { key: 'castingTime', re: /^casting\s*time\s*:\s*/i },
  { key: 'range', re: /^range\s*:\s*/i },
  { key: 'target', re: /^target\s*:\s*/i },
  { key: 'area', re: /^area\s*:\s*/i },
  { key: 'effect', re: /^effect\s*:\s*/i },
  { key: 'duration', re: /^duration\s*:\s*/i },
  { key: 'savingThrow', re: /^saving\s*throw\s*:\s*/i },
  { key: 'spellResistance', re: /^spell\s*resistance\s*:\s*/i },
]

// A stat-field value that hard-wrapped mid-phrase, with nothing else
// downstream to bound it against (see the last field's handling below),
// almost always breaks at an unclosed parenthetical ("Long (400 ft. +" /
// "40 ft./level)") or a trailing connector. Anything else that looks like
// a complete clause is left alone, since guessing wrong there would
// swallow the first line of the description into the last stat field
// instead — worse than leaving an odd wrap-tail for a manual fix.
function looksIncomplete(value) {
  const opens = (value.match(/\(/g) || []).length
  const closes = (value.match(/\)/g) || []).length
  if (opens > closes) return true
  return /[+\-/,]$|\b(and|or)$/i.test(value.trim())
}

// Finds every label line up front rather than walking sequentially and
// giving up at the first surprise — a field whose value wraps onto a line
// that doesn't itself look like a continuation (no unclosed paren, no
// trailing connector) would otherwise abort the whole scan right there,
// losing every label still to come. Bounding each field's value by the
// *next known label's* position instead is fully reliable for every field
// but the last, whatever its wrap-tail looks like; only the last field —
// with no further label to bound it against — falls back to
// looksIncomplete() to decide where its value ends and the description
// begins.
function scanStatBlock(lines) {
  const firstLabelIdx = lines.findIndex((l) => LABELS.some((L) => L.re.test(l.trim())))
  if (firstLabelIdx === -1) return { fields: {}, headerLines: lines, bodyStartIdx: lines.length }

  const labelIdxs = []
  for (let i = firstLabelIdx; i < lines.length; i++) {
    if (LABELS.some((L) => L.re.test(lines[i].trim()))) labelIdxs.push(i)
  }

  // Every field but the last is bounded by the next known label — fully
  // reliable regardless of how its wrap-tail reads. The last field has no
  // next label to bound it, so it starts out as just its own line; the
  // looksIncomplete()-gated loop below is what may extend it further.
  const fields = {}
  for (let n = 0; n < labelIdxs.length; n++) {
    const idx = labelIdxs[n]
    const label = LABELS.find((L) => L.re.test(lines[idx].trim()))
    const ownValue = lines[idx].trim().replace(label.re, '')
    if (n + 1 < labelIdxs.length) {
      const boundIdx = labelIdxs[n + 1]
      const valueLines = [ownValue]
      for (let j = idx + 1; j < boundIdx; j++) {
        if (lines[j].trim() === '') break
        valueLines.push(lines[j].trim())
      }
      fields[label.key] = valueLines.filter(Boolean).join(' ').trim()
    } else {
      fields[label.key] = ownValue.trim()
    }
  }

  const lastIdx = labelIdxs[labelIdxs.length - 1]
  const lastLabel = LABELS.find((L) => L.re.test(lines[lastIdx].trim()))
  let bodyStartIdx = lastIdx + 1
  while (bodyStartIdx < lines.length && lines[bodyStartIdx].trim() !== '' && looksIncomplete(fields[lastLabel.key])) {
    fields[lastLabel.key] = (fields[lastLabel.key] + ' ' + lines[bodyStartIdx].trim()).trim()
    bodyStartIdx++
  }
  while (bodyStartIdx < lines.length && lines[bodyStartIdx].trim() === '') bodyStartIdx++

  return { fields, headerLines: lines.slice(0, firstLabelIdx), bodyStartIdx }
}

// "Transmutation" / "Conjuration (Creation)" / "Evocation [Cold]" /
// "Conjuration (Creation) [Fire]" — parenthesized is subschool, bracketed
// is descriptors (comma-split).
function parseSchoolLine(line) {
  const bracketMatch = line.match(/\[([^\]]+)\]/)
  const descriptors = bracketMatch
    ? bracketMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : []
  let rest = line.replace(/\[[^\]]+\]/, '').trim()
  const parenMatch = rest.match(/\(([^)]+)\)/)
  const subschool = parenMatch ? parenMatch[1].trim() : null
  const school = rest.replace(/\([^)]+\)/, '').trim()
  return { school, subschool, descriptors }
}

// "Drd 3, Rgr 2" -> [{ class: "Drd", level: 3 }, { class: "Rgr", level: 2 }]
function parseLevelField(raw) {
  return raw
    .split(',')
    .map((piece) => {
      const m = piece.trim().match(/^([A-Za-z/.\s]+?)\s+(\d+)$/)
      return m ? { class: m[1].trim(), level: Number(m[2]) } : null
    })
    .filter(Boolean)
}

// "V, S, M" -> "V S M" — matches the space-separated form the card
// template's COMPONENTS cell already uses (see canonicalMechFields).
function normalizeComponents(raw) {
  return raw.split(',').map((s) => s.trim()).filter(Boolean).join(' ')
}

/* ── description ───────────────────────────────────────────────── */

const NOTE_RE = /^(material component|arcane material component|divine focus|focus|xp cost|special)\s*:/i

function splitParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
}

/* ── main entry point ─────────────────────────────────────────────
   Returns everything parsed out of one spell's pasted text, plus a
   `missing` list of the labels/fields it couldn't find — never guesses a
   value it didn't actually see. */
export function parsePastedSpell(rawText) {
  const cleaned = cleanPastedText(rawText)
  const lines = cleaned.split('\n')

  const { fields, headerLines, bodyStartIdx } = scanStatBlock(lines)

  const headerNonEmpty = headerLines.filter((l) => l.trim() !== '')
  const name = (headerNonEmpty[0] || '').trim()
  const schoolLine = (headerNonEmpty[1] || '').trim()
  const { school, subschool, descriptors } = schoolLine
    ? parseSchoolLine(schoolLine)
    : { school: '', subschool: null, descriptors: [] }

  const levels = fields.level ? parseLevelField(fields.level) : []
  const components = fields.components ? normalizeComponents(fields.components) : ''
  const targetAreaEffect = fields.target
    ? { type: 'target', value: fields.target }
    : fields.area
      ? { type: 'area', value: fields.area }
      : fields.effect
        ? { type: 'effect', value: fields.effect }
        : null

  const bodyText = lines.slice(bodyStartIdx).join('\n')
  const paragraphs = splitParagraphs(bodyText)

  const notes = []
  const content = []
  for (const p of paragraphs) {
    if (NOTE_RE.test(p)) notes.push(p)
    else content.push(p)
  }
  const flavor = content[0] || ''
  const primary = content.slice(1).join('\n\n')
  const note = notes.join('\n\n')

  const missing = []
  if (!name) missing.push('Name')
  if (!school) missing.push('School')
  if (levels.length === 0) missing.push('Level')
  if (!fields.components) missing.push('Components')
  if (!fields.castingTime) missing.push('Casting Time')
  if (!fields.range) missing.push('Range')
  if (!fields.duration) missing.push('Duration')
  if (!fields.savingThrow) missing.push('Saving Throw')
  if (!fields.spellResistance) missing.push('Spell Resistance')
  if (!targetAreaEffect) missing.push('Target/Area/Effect')

  return {
    name,
    school,
    subschool,
    descriptors,
    levels,
    components,
    castingTime: fields.castingTime || '',
    range: fields.range || '',
    duration: fields.duration || '',
    savingThrow: fields.savingThrow || '',
    spellResistance: fields.spellResistance || '',
    targetAreaEffect,
    flavor,
    primary,
    note,
    missing,
  }
}

// Splits a paste of several spells' text (each with its own Name/School/
// Level: block) into one raw-text block per spell, anchored on each
// "Level:" line and walking back to the two non-empty lines before it
// (name, school). A paste with zero or one "Level:" line is left as a
// single block.
export function splitMultipleSpells(rawText) {
  const lines = (rawText || '').replace(/\r\n?/g, '\n').split('\n')
  const levelLineIdxs = []
  for (let i = 0; i < lines.length; i++) {
    if (/^level\s*:/i.test(lines[i].trim())) levelLineIdxs.push(i)
  }
  if (levelLineIdxs.length <= 1) return [rawText.trim()].filter(Boolean)

  const starts = levelLineIdxs.map((idx) => {
    let i = idx - 1
    let nonEmptyCount = 0
    while (i >= 0 && nonEmptyCount < 2) {
      if (lines[i].trim() !== '') nonEmptyCount++
      if (nonEmptyCount < 2) i--
    }
    return Math.max(i, 0)
  })
  const uniqueStarts = [...new Set(starts)].sort((a, b) => a - b)

  return uniqueStarts
    .map((start, idx) => {
      const end = idx + 1 < uniqueStarts.length ? uniqueStarts[idx + 1] : lines.length
      return lines.slice(start, end).join('\n').trim()
    })
    .filter(Boolean)
}
