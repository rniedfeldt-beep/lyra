import { useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { addXp, subtractXp } from '../../lib/liveState/actions'
import {
  xpForLevel,
  xpToNextLevel,
  xpProgressFraction,
  levelForXp,
  wouldDropBelowCurrentLevelMinimum,
} from '../../lib/calc/leveling'
import './leveling.css'

function parsePositiveAmount(raw) {
  const amount = Number(raw)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export default function XpTracker({ sheet, onLevelUp }) {
  const { state, update } = useLiveState()
  const { character } = sheet
  const [addAmount, setAddAmount] = useState('')
  const [subtractAmount, setSubtractAmount] = useState('')

  const xp = state.characterProgress.xp
  const level = character.level
  const nextLevelXp = xpForLevel(level + 1)
  const toNext = xpToNextLevel(xp, level)
  const progress = xpProgressFraction(xp, level)
  const eligible = levelForXp(xp) > level

  function handleAdd() {
    const amount = parsePositiveAmount(addAmount)
    if (amount === null) return
    update((s) => addXp(s, amount))
    setAddAmount('')
  }

  function handleSubtract() {
    const amount = parsePositiveAmount(subtractAmount)
    if (amount === null) return
    if (wouldDropBelowCurrentLevelMinimum(xp, amount, level)) {
      const ok = window.confirm(
        `Spending ${amount} XP would drop Lyra below the minimum for level ${level} (${xpForLevel(level)} XP). ` +
          `3.5e forbids this, but your DM may rule otherwise. Spend anyway?`,
      )
      if (!ok) return
    }
    update((s) => subtractXp(s, amount))
    setSubtractAmount('')
  }

  return (
    <div className="tracker-block xp-tracker">
      <h3>Experience</h3>
      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">XP</span>
          <span className="stat-pill-value">{xp.toLocaleString()}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Next Level</span>
          <span className="stat-pill-value">{nextLevelXp.toLocaleString()}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">To Go</span>
          <span className="stat-pill-value">{toNext.toLocaleString()}</span>
        </div>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>

      <div className="tracker-row">
        <input
          type="number"
          inputMode="numeric"
          placeholder="Add XP"
          value={addAmount}
          onChange={(e) => setAddAmount(e.target.value)}
        />
        <button type="button" onClick={handleAdd}>
          Add
        </button>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Spend XP"
          value={subtractAmount}
          onChange={(e) => setSubtractAmount(e.target.value)}
        />
        <button type="button" onClick={handleSubtract}>
          Spend
        </button>
      </div>

      {eligible && (
        <div className="xp-eligible-banner">
          <span>Eligible to level up to {level + 1}!</span>
          <button type="button" className="confirm-button" onClick={onLevelUp}>
            Level Up
          </button>
        </div>
      )}
    </div>
  )
}
