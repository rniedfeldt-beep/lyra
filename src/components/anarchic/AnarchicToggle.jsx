import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  activateAnarchic,
  deactivateAnarchic,
  setAnarchicDurationMinutes,
  setAnarchicSmiteLawUsed,
  setSpellSlotUsed,
  setWildShapeUsed,
} from '../../lib/liveState/actions'
import { anarchicTemplate, monsterManual } from '../../lib/loadCreatureData'
import { computeAnarchicInvokedMinutes, computeAnarchicOverlay } from '../../lib/calc/anarchic'
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

// Lives inside the Wild Shape card. One checkbox pays both costs at once
// (a 4th-level slot and a wild shape use — see CLAUDE.md > Anarchic
// template); the full cast/invoke-window rules text lives on the
// Reference tab as material that's rarely needed mid-round. This is an
// overlay on Lyra, not a form modifier — it composes onto whatever her
// current stat block is and is untouched by assuming/reverting a form.
export default function AnarchicToggle({ sheet }) {
  const { state, update } = useLiveState()
  const anarchic = state.anarchicTemplate
  const casterLevel = sheet.character.casterLevel.druid
  const hd = sheet.character.level

  const slot4 = sheet.spellSlots.slots.find((s) => s.spellLevel === 4)
  const slot4Used = state.spellSlotsUsed[4] ?? 0
  const noSlotsLeft = !slot4 || slot4Used >= slot4.total
  const maxWildShapeUses = sheet.character.wildShape.usesPerDay
  const noUsesLeft = state.wildShapeUsed >= maxWildShapeUses
  const canActivate = !noSlotsLeft && !noUsesLeft

  const activeForm = state.activeWildShapeForm
  const activeCreatureType = activeForm
    ? monsterManual.find((c) => c.name === activeForm.creatureName)?.type
    : undefined

  function handleToggle(checked) {
    if (checked) {
      const durationMinutes = computeAnarchicInvokedMinutes(casterLevel, anarchicTemplate)
      update((s) => {
        const activated = activateAnarchic(s, durationMinutes)
        const withSlot = setSpellSlotUsed(activated, 4, (activated.spellSlotsUsed[4] ?? 0) + 1)
        return setWildShapeUsed(withSlot, withSlot.wildShapeUsed + 1)
      })
    } else {
      update((s) => deactivateAnarchic(s))
    }
  }

  const overlay = anarchic.active
    ? computeAnarchicOverlay({ hd, creatureType: activeCreatureType, template: anarchicTemplate })
    : null

  return (
    <div className="anarchic-toggle">
      <label className="anarchic-checkbox-label">
        <input
          type="checkbox"
          checked={anarchic.active}
          disabled={!anarchic.active && !canActivate}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        Iconic Manifestation active
      </label>
      {!anarchic.active && !canActivate && (
        <p className="warning">
          {noSlotsLeft ? 'No 4th-level slots remaining. ' : ''}
          {noUsesLeft ? 'No wild shape uses remaining.' : ''}
        </p>
      )}

      {anarchic.active && overlay && (
        <div className="anarchic-active-block">
          <MinuteStepper
            minutes={anarchic.durationMinutesRemaining}
            onChange={(m) => update((s) => setAnarchicDurationMinutes(s, m))}
          />
          <p className="breakdown">
            Darkvision {overlay.darkvisionFt} ft. · Resist{' '}
            {Object.entries(overlay.resistances)
              .map(([type, amount]) => `${amount} ${type}`)
              .join(', ')}
          </p>
          <p className="breakdown">
            Immune to {overlay.immunities.join(', ')} ·{' '}
            {overlay.damageReduction ? `DR ${overlay.damageReduction.amount}/${overlay.damageReduction.bypass}` : 'no DR'}
            {' · '}
            {overlay.fastHealing > 0 ? `fast healing ${overlay.fastHealing}` : 'no fast healing'}
          </p>
          {overlay.typeChangeNote && <p className="note">{overlay.typeChangeNote}</p>}
          <label className="anarchic-smite">
            <input
              type="checkbox"
              checked={anarchic.smiteLawUsed}
              onChange={(e) => update((s) => setAnarchicSmiteLawUsed(s, e.target.checked))}
            />
            Smite Law — {formatMod(overlay.smiteLawBonus)} damage vs. a lawful target (1/day)
          </label>
        </div>
      )}
    </div>
  )
}
