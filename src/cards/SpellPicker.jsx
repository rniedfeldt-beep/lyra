import { useMemo, useState } from 'react'
import { spellGroups } from '../lib/spellReferenceData'

// Search-and-pick, sourced straight from data/spells/ (via the same
// spellGroups the Spell Reference tab uses) — Lyra's druid list only, a
// convenience for her cards specifically. A spell with no match here (any
// of Vaelith's sorcerer spells, say) simply won't show up in search —
// paste its text into Paste to Fill instead. savedNames (spell names with
// a saved card for the *current* character, from Supabase) drives the
// "has card" badge, not anything in data/spells/ — a card is per-character
// now, so "has card" has to be too.
export default function SpellPicker({ onSelect, savedNames }) {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    return spellGroups.filter((g) => g.name.toLowerCase().includes(query)).slice(0, 40)
  }, [q])

  return (
    <div className="panel">
      <h2>Find a Spell</h2>
      <input
        type="text"
        className="field-search"
        placeholder="Search spell name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((g) => {
            const printing = g.printings.find((p) => p.full) ?? g.printings[0]
            const hasCard = savedNames?.has(g.name.toLowerCase())
            return (
              <li key={g.name}>
                <button type="button" onClick={() => onSelect(g)}>
                  <span>
                    {g.name}
                    {hasCard && <span className="has-card">has card</span>}
                  </span>
                  <span className="lvl">Lv {printing?.spellLevelDruid ?? '—'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
