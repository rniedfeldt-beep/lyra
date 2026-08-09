import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { setCompanionHp } from '../../lib/liveState/actions'
import { DamageHealRow } from '../trackers/TrackersPanel'
import { formatMod } from '../../lib/format'
import { computeCompanionStatBlock } from '../../lib/calc/companion'

export default function CompanionPanel({ companion }) {
  const { state, update } = useLiveState()
  const hpMax = companion.hp.max
  const { ac, saves, attackRoutine, speed } = computeCompanionStatBlock(companion)

  return (
    <>
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

      <div className="tracker-block">
        <h3>Armor Class</h3>
        <div className="stat-row-group">
          <div className="stat-pill stat-pill-large">
            <span className="stat-pill-label">AC</span>
            <span className="stat-pill-value">{ac.total}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Touch</span>
            <span className="stat-pill-value">{ac.touch}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Flat-footed</span>
            <span className="stat-pill-value">{ac.flatFooted}</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-label">Speed</span>
            <span className="stat-pill-value">{speed} ft.</span>
          </div>
        </div>
      </div>

      <div className="tracker-block">
        <h3>Saves</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th></th>
              <th>Base</th>
              <th>Ability</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Fortitude', saves.fort],
              ['Reflex', saves.ref],
              ['Will', saves.will],
            ].map(([label, s]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{formatMod(s.base)}</td>
                <td>{formatMod(s.abilityMod)}</td>
                <td className="total-cell">{formatMod(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {companion.specialAbilityNotes?.Devotion && (
          <p className="breakdown">Devotion: {companion.specialAbilityNotes.Devotion}</p>
        )}
      </div>

      <div className="tracker-block">
        <h3>Attack Routine</h3>
        <div className="stat-row-group">
          {attackRoutine.map((atk) => (
            <div className="stat-pill" key={atk.name}>
              <span className="stat-pill-label">
                {atk.count > 1 ? `${atk.count} × ` : ''}
                {atk.name}
              </span>
              <span className="stat-pill-value">
                {formatMod(atk.attackBonus)} ({atk.damage.die}
                {atk.damage.bonus ? formatMod(atk.damage.bonus) : ''}, {atk.damage.crit})
              </span>
            </div>
          ))}
        </div>
        {companion.specialAttackNotes?.trip && (
          <p className="breakdown">Trip: {companion.specialAttackNotes.trip}</p>
        )}
      </div>

      {companion.skillNotes?.length > 0 && (
        <div className="tracker-block">
          <h3>Skills</h3>
          <ul className="sub-list">
            {companion.skillNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {companion.feats?.length > 0 && (
        <div className="tracker-block">
          <h3>Feats</h3>
          <ul className="sub-list">
            {companion.feats.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {companion.knownTricks?.length > 0 && (
        <div className="tracker-block">
          <h3>Known Tricks</h3>
          <ul className="sub-list">
            {companion.knownTricks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
