import { useMemo, useState } from 'react'
import { spellGroups } from '../lib/spellReferenceData'

// Search-and-pick, sourced straight from data/spells/ (via the same
// spellGroups the Spell Reference tab uses) — no separate card-only spell
// list to keep in sync.
export default function SpellPicker({ onSelect }) {
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
            const hasCard = !!printing?.full?.card
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
