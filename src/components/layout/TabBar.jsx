import './tabBar.css'

const TABS = [
  { id: 'lyra', label: 'Lyra' },
  { id: 'companions', label: 'Companions' },
  { id: 'reference', label: 'Reference' },
  { id: 'spells', label: 'Spells' },
]

// Sticky just below the combat bar, so switching tabs never requires
// scrolling back to the top first.
export default function TabBar({ active, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab-bar-button${t.id === active ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}
