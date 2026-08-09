import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { setCompanionHp } from '../../lib/liveState/actions'
import { DamageHealRow } from '../trackers/TrackersPanel'

export default function CompanionPanel({ companion }) {
  const { state, update } = useLiveState()
  const hpMax = companion.hp.max

  return (
    <div className="tracker-block">
      <h3>Hit Points</h3>
      <div className="tracker-row">
        <label>
          Current
          <input
            type="number"
            value={state.companionHp.current}
            onChange={(e) => update((s) => setCompanionHp(s, Number(e.target.value)))}
          />
        </label>
        <span className="tracker-max">/ {hpMax}</span>
      </div>
      <DamageHealRow
        onDamage={(amount) => update((s) => setCompanionHp(s, s.companionHp.current - amount))}
        onHeal={(amount) => update((s) => setCompanionHp(s, Math.min(s.companionHp.current + amount, hpMax)))}
      />
    </div>
  )
}
