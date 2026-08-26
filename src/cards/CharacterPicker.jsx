import { useState } from 'react'

// Which character's cards are currently being browsed/edited/saved — every
// save is tagged with this, and every "has card" / Saved Cards lookup is
// scoped to it. Starts from Lyra + Vaelith (supabaseCards.js's defaults)
// plus whatever other characters already have a saved card; "Add" appends
// a new name locally and switches to it immediately — it doesn't need to
// exist in Supabase yet, since it will as soon as something's saved under it.
export default function CharacterPicker({ character, characters, onChange, onAdd }) {
  const [newName, setNewName] = useState('')

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    onAdd(name)
    setNewName('')
  }

  return (
    <div className="panel">
      <h2>Character</h2>
      <select className="field-input" value={character} onChange={(e) => onChange(e.target.value)}>
        {characters.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <div className="btn-row">
        <input
          type="text"
          className="field-input"
          placeholder="Add a character…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
        />
        <button type="button" className="btn btn-small" onClick={handleAdd} disabled={!newName.trim()}>
          Add
        </button>
      </div>
    </div>
  )
}
