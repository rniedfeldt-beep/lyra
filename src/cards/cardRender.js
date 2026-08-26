// Rendering/formatting helpers ported from spell-cards-v2.html (the
// reference implementation) — see CLAUDE.md > Spell cards (/cards).
// Kept as close to the original as the React adaptation allows: same
// markdown-lite syntax, same SVGs, same auto-fit thresholds and step order.

// `**bold**` / `*italic*`, blank line starts a new paragraph.
export function fmt(s) {
  return (s || '')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .split('\n\n')
    .filter(Boolean)
}

export const SIGIL = `<svg width="16" height="15.5" viewBox="0 0 26 25" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2.7" y="2.5" width="13.2" height="18.8" rx="2"/>
  <path d="M6.5 3.4v17"/>
  <rect x="8.9" y="6.2" width="5.1" height="6" rx="0.8"/>
  <path d="M11.45 7.5l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z" fill="currentColor" stroke="none"/>
  <rect x="11.6" y="14.4" width="2.4" height="2.4" rx="0.5"/>
  <path d="M20.4 1.2l.85 2.1 2.1.85-2.1.85-.85 2.1-.85-2.1-2.1-.85 2.1-.85z" fill="currentColor" stroke="none"/>
  <path d="M23.5 8.1l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" fill="currentColor" stroke="none"/></svg>`

// Level hexagon — a regular pointy-top hexagon, tilted clockwise by
// HEX_ROTATE_DEG. The tilt is baked into these vertex coordinates rather
// than applied as a CSS transform on the rendered SVG: a CSS-rotated
// element needs a box bigger than its own content to avoid clipping by
// .card's overflow:hidden, and getting that box's size right for an
// arbitrary rotation angle by eye is exactly how this went wrong the first
// time (stretched, clipped). Baking the rotation into the points instead
// means the viewBox can be sized to exactly fit the rotated shape (plus
// half the stroke width, so the stroke itself isn't clipped), so two
// vertices land tangent to the card's top and right edges by construction.
// No preserveAspectRatio="none": the viewBox fits the shape's own
// proportions, nothing is stretched to force it square.
//
// The level numeral is a <text> element inside this same SVG, at (0,0) —
// the hexagon's own geometric center, since HEX_POINTS is symmetric about
// the origin by construction. Not a separate HTML <span> positioned by CSS
// grid centering: that was the second bug (see CLAUDE.md > Spell cards >
// Level hexagon) — two elements centered via two different mechanisms
// (SVG viewBox math vs. CSS grid placement) can drift apart, which is
// exactly what happened when .level svg's position:absolute got dropped
// and the grid placed the SVG and the span in separate implicit rows
// instead of stacking them. A <text> at the polygon's own origin can't
// drift from it — there's only one coordinate system. It also needs no
// counter-rotation: since the tilt is baked into the polygon's points
// rather than applied as a transform on the SVG (or a <g> around it), the
// text was never rotated to begin with.
const HEX_ROTATE_DEG = 20
const HEX_R = 30
const HEX_STROKE = 2.4
const HEX_BOX_W_IN = 0.48
const HEX_NUMERAL_PT = 16

function hexPolygonPoints(rotateDeg, r) {
  const toRad = (d) => (d * Math.PI) / 180
  const rot = toRad(rotateDeg)
  const cosR = Math.cos(rot)
  const sinR = Math.sin(rot)
  const points = []
  for (let k = 0; k < 6; k++) {
    const a = toRad(k * 60)
    const x = r * Math.sin(a)
    const y = -r * Math.cos(a)
    points.push([x * cosR - y * sinR, x * sinR + y * cosR])
  }
  return points
}

const HEX_POINTS = hexPolygonPoints(HEX_ROTATE_DEG, HEX_R)
const HEX_MAX_X = Math.max(...HEX_POINTS.map((p) => Math.abs(p[0])))
const HEX_MAX_Y = Math.max(...HEX_POINTS.map((p) => Math.abs(p[1])))
const HEX_PAD = HEX_STROKE / 2 + 0.3
const HEX_VB_W = (HEX_MAX_X + HEX_PAD) * 2
const HEX_VB_H = (HEX_MAX_Y + HEX_PAD) * 2

// .level's own box must share this aspect ratio, or the SVG stretches to
// fill it — same bug as preserveAspectRatio="none" did. Computed and
// inlined by headHTML() below rather than hardcoded in spellCards.css, so
// changing HEX_ROTATE_DEG/HEX_R/HEX_BOX_W_IN can't silently fall out of
// sync with a separately-hand-tuned CSS size.
export const HEX_ASPECT = HEX_VB_W / HEX_VB_H
export const HEX_BOX_H_IN = HEX_BOX_W_IN / HEX_ASPECT

// 16pt is the numeral's physical size regardless of how big the hexagon
// itself is drawn — converts that target through this SVG's own
// units-per-inch (HEX_VB_W spans HEX_BOX_W_IN once placed on the card).
const HEX_NUMERAL_SVG_SIZE = (HEX_NUMERAL_PT / 72) * (HEX_VB_W / HEX_BOX_W_IN)

const HEX_POLYGON_POINTS_ATTR = HEX_POINTS.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ')

export function hexSvg(level) {
  return `<svg viewBox="${-HEX_VB_W / 2} ${-HEX_VB_H / 2} ${HEX_VB_W} ${HEX_VB_H}" aria-hidden="true">
  <polygon points="${HEX_POLYGON_POINTS_ATTR}"
    fill="none" stroke="currentColor" stroke-width="${HEX_STROKE}" stroke-linejoin="round"/>
  <text x="0" y="0" text-anchor="middle" dominant-baseline="central"
    font-family="'Fira Mono', monospace" font-weight="700"
    font-size="${HEX_NUMERAL_SVG_SIZE.toFixed(2)}" fill="currentColor">${level}</text>
</svg>`
}

export function schoolLine(s) {
  let o = s.school || ''
  if (s.subschool) o += ` <em>(${s.subschool})</em>`
  if (s.descriptors?.length) o += ` <span class="desc">[${s.descriptors.join(', ')}]</span>`
  return o
}

// A card's range value ("Close (25 ft. + 5 ft./2 levels)") reads better on
// the card split across two lines the way the template's stat cells do —
// main distance on top, the qualifying parenthetical smaller underneath
// (.stat .v small is display:block at 7pt). This wraps whatever's inside
// the first "(...)" in <small> rather than reproducing the reference demo's
// own hand-typed abbreviations ("100'" vs "100 ft.") — the real field value
// from data/spells/ is used verbatim, just laid out the same way.
export function statValueHTML(value) {
  if (!value) return '—'
  const i = value.indexOf('(')
  if (i === -1) return value
  const main = value.slice(0, i).trim()
  const rest = value.slice(i)
  return main ? `${main}<small>${rest}</small>` : `<small>${rest}</small>`
}

export function bodyHTML(c) {
  if (!c) return ''
  let h = ''
  if (c.flavor) h += fmt(c.flavor)
    .map((p) => `<p class="flavor">${p}</p>`)
    .join('')
  if (c.primary) h += fmt(c.primary)
    .map((p) => `<p class="primary">${p}</p>`)
    .join('')
  if (c.table?.head?.length) {
    h +=
      `<table><tr>${c.table.head.map((x) => `<th>${x}</th>`).join('')}</tr>` +
      (c.table.rows || []).map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('') +
      `</table>`
  }
  if (c.secondary) h += fmt(c.secondary)
    .map((p) => `<p class="secondary">${p}</p>`)
    .join('')
  if (c.note) h += fmt(c.note)
    .map((p) => `<p class="note">${p}</p>`)
    .join('')
  return h
}

export function headHTML(s) {
  const hasStSr = !!(s.savingThrow || s.spellResistance)
  const stsr = hasStSr
    ? `<div class="st-sr">ST: <i>${s.savingThrow || '—'}</i> SR: <i>${s.spellResistance || '—'}</i></div>`
    : ''
  return `
  <div class="card-head${hasStSr ? ' has-stsr' : ''}">
    <div class="sigil">${SIGIL}<span>SPELL</span></div>
    <h1 class="card-name"><span>${s.name}</span></h1>
    <div class="level-spacer"></div>
    ${stsr}
  </div>
  <div class="level" style="width:${HEX_BOX_W_IN}in;height:${HEX_BOX_H_IN.toFixed(4)}in">${hexSvg(s.level)}</div>
  <div class="band">
    <span class="school"><span>${schoolLine(s)}</span></span>
    <span class="tag">LEVEL &amp; TYPE</span>
  </div>
  <div class="stat-row">
    <div class="stat"><span class="k">CASTING TIME</span><span class="v">${statValueHTML(s.castingTime)}</span></div>
    <div class="stat"><span class="k">RANGE</span><span class="v">${statValueHTML(s.range)}</span></div>
  </div>
  <div class="stat-row">
    <div class="stat"><span class="k">COMPONENTS</span><span class="v comp">${s.components || '—'}</span></div>
    <div class="stat"><span class="k">DURATION</span><span class="v">${statValueHTML(s.duration)}</span></div>
  </div>
  <div class="desc-tag">SPELL DESCRIPTION</div>`
}

/* ── auto-fit ──────────────────────────────────────────────────────
   Ported verbatim: nine steps, 11pt down to a 7pt floor, narrowing
   through Fira Sans → Condensed → Extra Condensed as it goes.
   Hierarchy holds throughout: flavor > mechanics > qualifiers > components.
   Only run once document.fonts.ready has resolved — see CLAUDE.md. */
export const NAME_SIZES = [17.8, 16.5, 15, 13.5, 12, 11, 10, 9, 8]
export const SCHOOL_SIZES = [13.6, 12.5, 11.5, 10.5, 9.5, 8.5, 7.5, 6.5]

const SANS = '"Fira Sans", sans-serif'
const COND = '"Fira Sans Condensed", sans-serif'
const XCND = '"Fira Sans Extra Condensed", sans-serif'

export const SCALE = [
  { f: 11, p: 10, s: 9, n: 8, ff: SANS },
  { f: 10.5, p: 9.5, s: 8.5, n: 7.5, ff: SANS },
  { f: 10, p: 9, s: 8, n: 7, ff: SANS },
  { f: 10.5, p: 9.5, s: 8.5, n: 7.5, ff: COND },
  { f: 10, p: 9, s: 8, n: 7, ff: COND },
  { f: 9.5, p: 8.5, s: 7.5, n: 6.5, ff: COND },
  { f: 9, p: 8.5, s: 7.5, n: 6.5, ff: XCND },
  { f: 8, p: 7.5, s: 7, n: 6, ff: XCND },
  { f: 7, p: 7, s: 7, n: 6, ff: XCND },
]

// Shrinks box.firstElementChild's text until it fits box, trying each size
// in order. Used for the spell name and school line, both of which vary
// wildly in length ("Read Magic" vs "Conjuration (Summoning) [Scales]").
export function shrinkToFit(box, sizes) {
  const inner = box.firstElementChild
  if (!inner) return sizes[0]
  for (const pt of sizes) {
    inner.style.fontSize = pt + 'pt'
    if (box.scrollHeight <= box.clientHeight + 1 && inner.scrollWidth <= box.clientWidth + 1) return pt
  }
  return sizes[sizes.length - 1]
}

export function setStep(cardEl, i) {
  const b = cardEl.querySelector('.body')
  if (!b) return
  const t = SCALE[i]
  b.style.setProperty('--fs-flavor', t.f + 'pt')
  b.style.setProperty('--fs-primary', t.p + 'pt')
  b.style.setProperty('--fs-secondary', t.s + 'pt')
  b.style.setProperty('--fs-note', t.n + 'pt')
  b.style.setProperty('--ff-body', t.ff)
}

export function fitStep(cardEl) {
  const b = cardEl.querySelector('.body')
  if (!b) return SCALE.length - 1
  for (let i = 0; i < SCALE.length; i++) {
    setStep(cardEl, i)
    if (b.scrollHeight <= b.clientHeight + 1) return i
  }
  return SCALE.length - 1
}

// Fits every .card-name / .band .school / .card / .fold within `root`.
// A fold pair fits both halves to the same (larger) step so the two cards
// of one spell read consistently. Returns the set of cards left overflowing
// at the 7pt floor — the spell needs a second card.
export function fitWithin(root) {
  if (!root) return new Set()
  root.querySelectorAll('.card-name').forEach((n) => shrinkToFit(n, NAME_SIZES))
  root.querySelectorAll('.band .school').forEach((n) => shrinkToFit(n, SCHOOL_SIZES))

  root.querySelectorAll('.fold').forEach((pair) => {
    const cards = [...pair.querySelectorAll('.card')]
    const step = Math.max(...cards.map(fitStep))
    cards.forEach((c) => setStep(c, step))
  })
  root.querySelectorAll('.card').forEach((c) => {
    if (!c.closest('.fold')) setStep(c, fitStep(c))
  })

  const overflowing = new Set()
  root.querySelectorAll('.overflow-flag').forEach((e) => e.remove())
  root.querySelectorAll('.body').forEach((b) => {
    const card = b.closest('.card')
    card.classList.remove('overflowing')
    if (b.scrollHeight > b.clientHeight + 1) {
      overflowing.add(card)
      card.classList.add('overflowing')
      card.insertAdjacentHTML('beforeend', '<span class="overflow-flag">TEXT CLIPPED</span>')
    }
  })
  return overflowing
}

let fontsReadyPromise = null
export function fontsReady() {
  if (!fontsReadyPromise) {
    fontsReadyPromise =
      typeof document !== 'undefined' && document.fonts?.ready ? document.fonts.ready : Promise.resolve()
  }
  return fontsReadyPromise
}

/* ── card unit / page HTML ────────────────────────────────────────
   Ported verbatim from spell-cards-v2.html's cardEl/unitEl and the
   pagination loop underneath it — six upright cards per sheet (two
   rows of three card-widths), fold pairs (continued cards) counting
   as width 2 and kept together on one row. */
export function cardHTML(spell, continued) {
  const block = continued ? spell.card?.continued : spell.card
  return `<article class="card" data-school="${(spell.school || '').toLowerCase()}">
    ${headHTML(spell)}<div class="body">${bodyHTML(block)}</div>
  </article>`
}

export function unitHTML(spell) {
  return spell.card?.continued
    ? `<div class="fold">${cardHTML(spell, false)}${cardHTML(spell, true)}</div>`
    : cardHTML(spell, false)
}

export function paginate(spells) {
  const queue = spells.map((s) => ({ s, w: s.card?.continued ? 2 : 1 }))
  const pages = []
  while (queue.length) {
    const rows = [[], []]
    for (const row of rows) {
      let w = 0
      while (queue.length && w + queue[0].w <= 3) {
        w += queue[0].w
        row.push(queue.shift())
      }
    }
    pages.push(rows)
  }
  return pages
}

export function sheetsHTMLFromPages(pages) {
  return pages
    .map(
      (rows) => `<div class="sheet">
    ${rows
      .filter((r) => r.length)
      .map((r) => `<div class="row">${r.map((u) => unitHTML(u.s)).join('')}</div>`)
      .join('')}
  </div>`,
    )
    .join('')
}

/* ── spell ↔ card data plumbing ───────────────────────────────────
   Everything above `card` (name, level, school…) already exists in
   data/spells/*.json — this reads it out of a spellGroups entry
   (src/lib/spellReferenceData.js) into the flat shape the render
   functions above expect, matching the reference SPELLS array. */
export function canonicalMechFields(group) {
  const printing = group.printings.find((p) => p.full) ?? group.printings[0]
  const full = printing?.full
  return {
    name: group.name,
    level: printing?.spellLevelDruid ?? full?.spellLevelDruid ?? 0,
    school: full?.school ?? '',
    subschool: full?.subschool ?? null,
    descriptors: full?.descriptors ?? [],
    castingTime: full?.castingTime ?? '',
    range: full?.range ?? '',
    components: full?.components?.length ? full.components.join(' ') : '',
    duration: full?.duration ?? '',
    savingThrow: full?.savingThrow ?? null,
    spellResistance: full?.spellResistance ?? null,
    existingCard: full?.card ?? null,
  }
}

export function buildCardSpell(mechFields, card) {
  return {
    name: mechFields.name,
    level: mechFields.level,
    school: mechFields.school,
    subschool: mechFields.subschool,
    descriptors: mechFields.descriptors,
    castingTime: mechFields.castingTime,
    range: mechFields.range,
    components: mechFields.components,
    duration: mechFields.duration,
    savingThrow: mechFields.savingThrow,
    spellResistance: mechFields.spellResistance,
    card,
  }
}

const MECH_KEYS = [
  'level',
  'school',
  'subschool',
  'castingTime',
  'range',
  'components',
  'duration',
  'savingThrow',
  'spellResistance',
]

// The mechanical fields as shown/edited on one particular card — distinct
// from canonicalMechFields()'s JSON-derived values, since a card can show a
// different class's level (paste-to-fill's whole point: Lyra's data is
// druid-only, but a card can be made for a sorcerer too) or a hand-fixed
// value, without touching the spell's own JSON entry. Starts from a
// previously-saved card.mech if there is one, else from the canonical
// fields, falling back per-field in case an older saved mech is missing a
// key added since.
export function initialMechDraft(canonical) {
  const saved = canonical.existingCard?.mech
  const pick = (key) => (saved && saved[key] !== undefined ? saved[key] : canonical[key])
  const draft = {}
  for (const key of MECH_KEYS) draft[key] = pick(key)
  draft.descriptors = pick('descriptors') ?? []
  return draft
}

export function mechFieldsEqual(a, b) {
  if (!a || !b) return a === b
  if ((a.descriptors || []).join(',') !== (b.descriptors || []).join(',')) return false
  return MECH_KEYS.every((k) => (a[k] ?? null) === (b[k] ?? null))
}

// Layers a paste-to-fill result onto an existing mechDraft/card block —
// only where the parse actually found something. A field it didn't find
// (blank string, null level, empty descriptors) leaves the existing value
// alone rather than blanking out an already-correct canonical field or a
// previously hand-typed one — "fill what you can" shouldn't mean "erase
// what you already had."
export function applyMechPatch(base, patch) {
  const out = { ...base }
  if (patch.level != null) out.level = patch.level
  if (patch.school) out.school = patch.school
  if (patch.subschool) out.subschool = patch.subschool
  if (patch.descriptors?.length) out.descriptors = patch.descriptors
  if (patch.castingTime) out.castingTime = patch.castingTime
  if (patch.range) out.range = patch.range
  if (patch.components) out.components = patch.components
  if (patch.duration) out.duration = patch.duration
  if (patch.savingThrow) out.savingThrow = patch.savingThrow
  if (patch.spellResistance) out.spellResistance = patch.spellResistance
  return out
}

export function applyCardPatch(base, patch) {
  return {
    ...base,
    flavor: patch.flavor || base.flavor,
    primary: patch.primary || base.primary,
    note: patch.note || base.note,
  }
}

export function blankCardBlock() {
  return { flavor: '', primary: '', secondary: '', note: '', table: null, continued: null }
}

// Strips empty fields before persisting, and drops an entirely-empty block
// to null rather than writing `{}` or `{ continued: {} }` into the JSON.
function cleanBlock(block) {
  if (!block) return null
  const out = {}
  if (block.flavor?.trim()) out.flavor = block.flavor.trim()
  if (block.primary?.trim()) out.primary = block.primary.trim()
  if (block.secondary?.trim()) out.secondary = block.secondary.trim()
  if (block.note?.trim()) out.note = block.note.trim()
  if (block.table?.head?.length) {
    const rows = (block.table.rows ?? []).filter((r) => r.some((c) => c && String(c).trim()))
    out.table = { head: block.table.head, rows }
  }
  return Object.keys(out).length ? out : null
}

export function cleanCard(draft) {
  const base = cleanBlock(draft)
  if (!base) return null
  const continued = cleanBlock(draft?.continued)
  if (continued) base.continued = continued
  return base
}

// What actually gets persisted into data/spells/<file>.json's "card" field:
// the cleaned description block, plus a `mech` override only when the
// current mechanical fields differ from the spell's own canonical values —
// omitted otherwise, so a card nobody's touched doesn't carry a redundant
// copy of data that's already in the entry proper.
export function buildCardToSave(draft, mechDraft, canonicalMech) {
  const base = cleanCard(draft) || {}
  if (!mechFieldsEqual(mechDraft, canonicalMech)) {
    base.mech = { ...mechDraft }
  }
  return Object.keys(base).length ? base : null
}
