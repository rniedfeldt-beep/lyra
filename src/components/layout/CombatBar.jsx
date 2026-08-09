import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { formatMod } from '../../lib/format'
import './combatBar.css'

// Pinned to the top of the page so Lyra's most-referenced numbers are
// always visible, no matter which section is scrolled into view below.
export default function CombatBar({ sheet }) {
  const { state } = useLiveState()

  return (
    <div className="combat-bar">
      <span className="combat-bar-name">{sheet.character.name}</span>
      <div className="combat-bar-stats">
        <span className="combat-bar-stat">
          <span className="combat-bar-label">HP</span>
          <span className="combat-bar-value">
            {state.hp.current}/{sheet.character.hp.max}
          </span>
        </span>
        <span className="combat-bar-stat">
          <span className="combat-bar-label">AC</span>
          <span className="combat-bar-value">{sheet.ac.total}</span>
        </span>
        <span className="combat-bar-stat">
          <span className="combat-bar-label">Init</span>
          <span className="combat-bar-value">{formatMod(sheet.initiative)}</span>
        </span>
      </div>
    </div>
  )
}
