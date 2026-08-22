import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { formatMod } from '../../lib/format'
import './combatBar.css'

// Pinned to the top of the page so Lyra's most-referenced numbers are
// always visible, no matter which section is scrolled into view below.
// AC and Initiative swap to the assumed form's values while wild shaped
// (same numbers shown in the main stat block further down), with the base
// value struck through beside them so what reverting gives back is never
// more than a glance away.
export default function CombatBar({ sheet, wildShapeStatBlock }) {
  const { state } = useLiveState()
  const wild = !!wildShapeStatBlock
  const currentAc = wild ? wildShapeStatBlock.ac.total : sheet.ac.total
  const currentInit = wild ? wildShapeStatBlock.initiative : sheet.initiative

  return (
    <div className="combat-bar">
      <span className="combat-bar-name">
        {sheet.character.name}
        {wild && (
          <span className="combat-bar-form" title="Currently wild shaped">
            🐾 {wildShapeStatBlock.creature.name}
          </span>
        )}
      </span>
      <div className="combat-bar-stats">
        <span className="combat-bar-stat">
          <span className="combat-bar-label">HP</span>
          <span className="combat-bar-value">
            {state.hp.current}/{sheet.character.hp.max}
          </span>
        </span>
        <span className="combat-bar-stat">
          <span className="combat-bar-label">AC</span>
          <span className="combat-bar-value">{currentAc}</span>
          {wild && (
            <s className="combat-bar-base" title={`Base AC (no wild shape): ${sheet.ac.total}`}>
              {sheet.ac.total}
            </s>
          )}
        </span>
        <span className="combat-bar-stat">
          <span className="combat-bar-label">Init</span>
          <span className="combat-bar-value">{formatMod(currentInit)}</span>
          {wild && (
            <s className="combat-bar-base" title={`Base Initiative (no wild shape): ${formatMod(sheet.initiative)}`}>
              {formatMod(sheet.initiative)}
            </s>
          )}
        </span>
      </div>
    </div>
  )
}
