import { lazy, Suspense, useEffect, useState } from 'react'
import './spellRef.css'
import { getResolvedSpellLookup, loadSpellLookup } from '../../lib/spellLookup'
import { normalizeSpellName, splitBySpellMentions } from '../../lib/spellMentions'

const SpellDescription = lazy(() => import('./SpellDescription'))

// Expandable spell references, for anywhere the app names a spell. Collapsed
// by default; expanding shows the same full entry as the Spells tab. A name
// with no entry in data/spells/ is left as plain text — no toggle, no empty
// block — since most arcane spells a creature or item names aren't extracted.

function useSpellLookup() {
  const [lookup, setLookup] = useState(getResolvedSpellLookup)
  useEffect(() => {
    if (lookup) return undefined
    let cancelled = false
    loadSpellLookup().then((l) => {
      if (!cancelled) setLookup(l)
    })
    return () => {
      cancelled = true
    }
  }, [lookup])
  return lookup
}

function SpellToggle({ label, open, onClick, className = '' }) {
  return (
    <button type="button" className={`spell-ref-toggle ${className}`} aria-expanded={open} onClick={onClick}>
      <span className={`chevron${open ? '' : ' collapsed'}`}>▾</span>
      {label}
    </button>
  )
}

function SpellBlock({ group }) {
  return (
    <div className="spell-ref-block">
      <Suspense fallback={<p className="note">Loading description…</p>}>
        <SpellDescription group={group} />
      </Suspense>
    </div>
  )
}

// The pieces for one named spell, for callers that need to place the toggle
// and the expanded block in different spots (a label, a table row).
function useSpellRef(name) {
  const lookup = useSpellLookup()
  const [open, setOpen] = useState(false)
  const group = lookup?.find(name) ?? null
  return {
    nameNode: group ? <SpellToggle label={name} open={open} onClick={() => setOpen((o) => !o)} /> : name,
    block: group && open ? <SpellBlock group={group} /> : null,
  }
}

// children(nameNode) lays the name out; the expanded block follows it.
export function SpellRefWith({ name, children }) {
  const { nameNode, block } = useSpellRef(name)
  return (
    <>
      {children(nameNode)}
      {block}
    </>
  )
}

// One spell name inline, with optional trailing text kept next to it.
export function SpellRef({ name, children }) {
  return (
    <SpellRefWith name={name}>
      {(nameNode) => (
        <span className="spell-ref">
          {nameNode}
          {children}
        </span>
      )}
    </SpellRefWith>
  )
}

function useOpenSet() {
  const [open, setOpen] = useState({})
  return [open, (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))]
}

function OpenBlocks({ lookup, open, order }) {
  return order
    .filter((key) => open[key])
    .map((key) => {
      const group = lookup.find(key)
      return group ? <SpellBlock key={key} group={group} /> : null
    })
}

// A row of spell-name pills (the always-available conversions), each
// expandable; expanded entries stack below the row.
export function SpellPillGroup({ label, names }) {
  const lookup = useSpellLookup()
  const [open, toggle] = useOpenSet()
  const keys = names.map(normalizeSpellName)
  return (
    <>
      <div className="spontaneous-conversions">
        <span className="spontaneous-label">{label}</span>
        <ul>
          {names.map((name, i) => (
            <li key={name}>
              {lookup?.find(name) ? (
                <SpellToggle label={name} open={!!open[keys[i]]} onClick={() => toggle(keys[i])} />
              ) : (
                name
              )}
            </li>
          ))}
        </ul>
      </div>
      {lookup && <OpenBlocks lookup={lookup} open={open} order={keys} />}
    </>
  )
}

// Free text naming spells somewhere inside it (a creature's "blink (Su, as the
// blink spell…)"): each spell found becomes expandable, in place.
export function AbilityText({ text }) {
  const lookup = useSpellLookup()
  const [open, toggle] = useOpenSet()
  if (!lookup) return text
  const parts = splitBySpellMentions(text, lookup.known)
  const order = []
  const inline = parts.map((part, i) => {
    if (!part.spell) return part.text
    if (!order.includes(part.spell)) order.push(part.spell)
    return (
      <SpellToggle
        key={i}
        label={part.text}
        open={!!open[part.spell]}
        onClick={() => toggle(part.spell)}
        className="spell-ref-inline"
      />
    )
  })
  return (
    <>
      {inline}
      <OpenBlocks lookup={lookup} open={open} order={order} />
    </>
  )
}

// `*italic*` markup in data descriptions: italics, and when the italicised
// words name a spell ("*misty step*"), an expandable reference.
export function RichText({ text }) {
  const lookup = useSpellLookup()
  const [open, toggle] = useOpenSet()
  const order = []
  const inline = text.split(/\*([^*]+)\*/g).map((part, i) => {
    if (i % 2 === 0) return part
    const key = normalizeSpellName(part)
    if (!lookup?.find(part)) return <em key={i}>{part}</em>
    if (!order.includes(key)) order.push(key)
    return (
      <em key={i}>
        <SpellToggle label={part} open={!!open[key]} onClick={() => toggle(key)} className="spell-ref-inline" />
      </em>
    )
  })
  return (
    <>
      {inline}
      {lookup && <OpenBlocks lookup={lookup} open={open} order={order} />}
    </>
  )
}
