import { lazy, Suspense, useEffect, useState } from 'react'
import { findSpellGroup, loadSpellGroups, suggestSpells } from '../../lib/preparedSpellSearch'

const SpellDescription = lazy(() => import('../spells/SpellDescription'))

// One prepared-spell slot (an orison counts as level 0): a plain text input
// that also offers a pick-list of matching spells at this slot's level.
// Typing is always saved as typed — a pick just fills in the canonical name,
// and text matching nothing is kept untouched (the DM gifts spells from
// books that aren't extracted, so unmatched is normal, not an error). A slot
// whose text names an extracted spell gets a collapsed description block
// beneath it; anything else gets none.
export default function PreparedSpellSlot({ level, index, value, onChange }) {
  const [groups, setGroups] = useState(null)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadSpellGroups().then((g) => {
      if (!cancelled) setGroups(g)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const matched = groups ? findSpellGroup(groups, value) : null
  const suggestions = groups && focused && !dismissed ? suggestSpells(groups, value, level) : []
  const showDetails = open && matched

  function pick(group) {
    onChange(group.name)
    setDismissed(true)
    setHighlight(-1)
  }

  function handleKeyDown(e) {
    if (suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(suggestions[highlight])
    } else if (e.key === 'Escape') {
      setDismissed(true)
    }
  }

  return (
    <div className={`prepared-slot${showDetails ? ' prepared-slot-open' : ''}`}>
      <div className="prepared-slot-field">
        <input
          type="text"
          placeholder={`Slot ${index + 1}`}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          onChange={(e) => {
            onChange(e.target.value)
            setDismissed(false)
            setHighlight(-1)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
        />
        {matched && (
          <button
            type="button"
            className="prepared-slot-toggle"
            aria-expanded={open}
            title={open ? 'Hide description' : 'Show description'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={`chevron${open ? '' : ' collapsed'}`}>▾</span>
          </button>
        )}
        {suggestions.length > 0 && (
          <ul className="prepared-slot-suggestions" role="listbox">
            {suggestions.map((g, i) => (
              <li
                key={g.name}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'highlighted' : ''}
                // mousedown, not click: the input's blur would otherwise
                // hide the list before the click lands.
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(g)
                }}
              >
                {g.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {showDetails && (
        <div className="prepared-slot-details">
          <Suspense fallback={<p className="note">Loading description…</p>}>
            <SpellDescription group={matched} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
