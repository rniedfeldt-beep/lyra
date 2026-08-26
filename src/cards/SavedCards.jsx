// Every card saved for the current character (Supabase, via
// fetchCardsForCharacter in CardsApp.jsx) — the only way back to a card
// for a spell that isn't in data/spells/ (any of Vaelith's sorcerer
// spells, most likely), since SpellPicker's search can't find those at
// all. Clicking a row loads it into the editor for revision, same as
// picking a druid spell from search or re-pasting its text.
export default function SavedCards({ character, savedCards, onLoad }) {
  return (
    <div className="panel">
      <h2>Saved Cards — {character}</h2>
      {savedCards.length === 0 ? (
        <p className="queue-empty">No cards saved for {character} yet.</p>
      ) : (
        <ul className="search-results">
          {savedCards.map((row) => (
            <li key={row.spell_name}>
              <button type="button" onClick={() => onLoad(row)}>
                <span>{row.spell_name}</span>
                <span className="lvl">Lv {row.mech?.level ?? '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
