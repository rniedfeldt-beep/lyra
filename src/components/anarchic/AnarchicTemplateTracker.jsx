import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  startAnarchicCast,
  setAnarchicWindowMinutes,
  invokeAnarchic,
  setAnarchicDurationMinutes,
  endAnarchic,
  setAnarchicSmiteLawUsed,
  setSpellSlotUsed,
  setWildShapeUsed,
} from '../../lib/liveState/actions'
import { anarchicTemplate, monsterManual } from '../../lib/loadCreatureData'
import { computeAnarchicWindowMinutes, computeAnarchicInvokedMinutes, computeAnarchicOverlay } from '../../lib/calc/anarchic'
import { formatMod } from '../../lib/format'
import './anarchic.css'

function MinuteStepper({ minutes, onChange }) {
  return (
    <div className="stepper">
      <button type="button" disabled={minutes <= 0} onClick={() => onChange(minutes - 1)}>
        −
      </button>
      <span>{minutes} min</span>
      <button type="button" onClick={() => onChange(minutes + 1)}>
        +
      </button>
    </div>
  )
}

// The "added to the current stat block" view — resistances, immunities,
// DR/fast healing, and Smite Law, all in one place regardless of whether
// Lyra is in base form or wild shaped (it's an overlay on her, not the
// form — see calc/anarchic.js).
function ActiveEffects({ overlay, smiteLawUsed, onToggleSmiteLaw }) {
  return (
    <div className="anarchic-effects">
      <h3>Active Effects</h3>
      <p className="breakdown">
        Darkvision {overlay.darkvisionFt} ft. · Resist{' '}
        {Object.entries(overlay.resistances)
          .map(([type, amount]) => `${amount} ${type}`)
          .join(', ')}
      </p>
      <p className="breakdown">Immune to {overlay.immunities.join(', ')}</p>
      <p className="breakdown">
        {overlay.damageReduction ? `DR ${overlay.damageReduction.amount}/${overlay.damageReduction.bypass}` : 'DR —'}
        {' · '}
        {overlay.fastHealing > 0 ? `Fast healing ${overlay.fastHealing}` : 'No fast healing'}
      </p>
      {overlay.typeChangeNote && <p className="note">{overlay.typeChangeNote}</p>}

      <div className="anarchic-smite">
        <label>
          <input type="checkbox" checked={smiteLawUsed} onChange={(e) => onToggleSmiteLaw(e.target.checked)} />
          Smite Law — {formatMod(overlay.smiteLawBonus)} damage on one attack vs. a lawful target (1/day)
        </label>
        {smiteLawUsed && <span className="note">Used today</span>}
      </div>
    </div>
  )
}

export default function AnarchicTemplateTracker({ sheet }) {
  const { state, update } = useLiveState()
  const anarchic = state.anarchicTemplate
  const casterLevel = sheet.character.casterLevel.druid
  const hd = sheet.character.level

  const slot4 = sheet.spellSlots.slots.find((s) => s.spellLevel === 4)
  const slot4Used = state.spellSlotsUsed[4] ?? 0
  const canCast = slot4 && slot4Used < slot4.total

  const maxWildShapeUses = sheet.character.wildShape.usesPerDay
  const canInvoke = anarchic.windowMinutesRemaining > 0 && state.wildShapeUsed < maxWildShapeUses

  const activeForm = state.activeWildShapeForm
  const activeCreatureType = activeForm ? monsterManual.find((c) => c.name === activeForm.creatureName)?.type : undefined

  const overlay = computeAnarchicOverlay({
    hd,
    creatureType: activeCreatureType,
    template: anarchicTemplate,
  })

  function handleCast() {
    const windowMinutes = computeAnarchicWindowMinutes(casterLevel, anarchicTemplate)
    update((s) => {
      const cast = startAnarchicCast(s, windowMinutes)
      return setSpellSlotUsed(cast, 4, (cast.spellSlotsUsed[4] ?? 0) + 1)
    })
  }

  function handleInvoke() {
    const durationMinutes = computeAnarchicInvokedMinutes(casterLevel, anarchicTemplate)
    update((s) => {
      const invoked = invokeAnarchic(s, durationMinutes)
      return setWildShapeUsed(invoked, s.wildShapeUsed + 1)
    })
  }

  return (
    <section className="card">
      <h2>Anarchic Template</h2>
      <p className="breakdown">
        {anarchicTemplate.grantedBy} · Swift action to cast (4th-level slot), then invoke within the window
        (1 wild shape use) for the template to take effect. An overlay on Lyra herself — applies in base form or
        wild shaped, and survives assuming or reverting a form.
      </p>

      {anarchic.phase === 'inactive' && (
        <>
          <button type="button" disabled={!canCast} onClick={handleCast}>
            Cast (spends a 4th-level slot)
          </button>
          {!canCast && <p className="warning">No 4th-level slots remaining.</p>}
        </>
      )}

      {anarchic.phase === 'cast' && (
        <div className="anarchic-phase">
          <p className="breakdown">Invocation window open — invoke before it lapses.</p>
          <MinuteStepper
            minutes={anarchic.windowMinutesRemaining}
            onChange={(m) => update((s) => setAnarchicWindowMinutes(s, m))}
          />
          <div className="anarchic-actions">
            <button type="button" disabled={!canInvoke} onClick={handleInvoke}>
              Invoke (spends 1 wild shape use)
            </button>
            <button type="button" onClick={() => update((s) => endAnarchic(s))}>
              Let Window Lapse
            </button>
          </div>
          {state.wildShapeUsed >= maxWildShapeUses && (
            <p className="warning">No wild shape uses remaining today.</p>
          )}
        </div>
      )}

      {anarchic.phase === 'invoked' && (
        <div className="anarchic-phase">
          <p className="breakdown">Template active.</p>
          <MinuteStepper
            minutes={anarchic.durationMinutesRemaining}
            onChange={(m) => update((s) => setAnarchicDurationMinutes(s, m))}
          />
          <ActiveEffects
            overlay={overlay}
            smiteLawUsed={anarchic.smiteLawUsed}
            onToggleSmiteLaw={(used) => update((s) => setAnarchicSmiteLawUsed(s, used))}
          />
          <button type="button" onClick={() => update((s) => endAnarchic(s))}>
            End
          </button>
        </div>
      )}
    </section>
  )
}
