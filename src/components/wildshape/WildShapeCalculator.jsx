import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { assumeWildShapeForm, revertWildShapeForm } from '../../lib/liveState/actions'
import { getEligibleWildShapeForms, computeWildShapeStatBlock } from '../../lib/calc/wildShape'
import { monsterManual } from '../../lib/loadCreatureData'
import { formatMod } from '../../lib/format'
import AnarchicToggle from '../anarchic/AnarchicToggle'
import '../trackers/trackers.css'
import './wildShape.css'

function wildShapeCost(creature) {
  return creature.type === 'Elemental' || creature.type === 'Outsider' ? 2 : 1
}

function byName(a, b) {
  return a.name.localeCompare(b.name)
}

// Canine forms get their own pinned-to-top group — they're the ones that
// carry the +20 ft. Totem Transformation bonus and see the most table use.
function groupFormsForPicker(forms) {
  const canine = forms.filter((c) => c.isCanine).sort(byName)
  const other = forms.filter((c) => !c.isCanine).sort(byName)
  return { canine, other }
}

function AttackEntry({ atk }) {
  return (
    <li>
      {atk.count > 1 ? `${atk.count} × ` : ''}
      {atk.name} {formatMod(atk.attackBonus)}, {atk.damage.die}
      {atk.damage.bonus ? formatMod(atk.damage.bonus) : ''}, crit {atk.damage.crit}
      {!atk.primary && <span className="note"> (secondary)</span>}
    </li>
  )
}

function AttackRoutine({ routine }) {
  if (routine.single.length === 0) {
    return (
      <>
        <h3>Attack Routine</h3>
        <p className="note">No attacks in this form.</p>
      </>
    )
  }

  return (
    <>
      <h3>Attack Routine</h3>
      <p className="action-type">Single attack — standard action</p>
      <ul className="wildshape-attacks">
        {routine.single.map((atk) => (
          <AttackEntry key={atk.name} atk={atk} />
        ))}
      </ul>
      {routine.hasSecondaries && (
        <>
          <p className="action-type">Full attack — full-round action</p>
          <ul className="wildshape-attacks">
            {routine.full.map((atk) => (
              <AttackEntry key={atk.name} atk={atk} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// Only used for the picker's preview of a form Lyra hasn't assumed yet —
// once a form is actually active, its numbers live in the main stat block
// (CombatStats/ArmorClass/Saves/AttackRoutine) instead of a second copy
// here, so this component never renders for the active case.
function StatBlock({ statBlock }) {
  const { creature, hp, ac, saves, speed, attackRoutine, abilities } = statBlock
  const speedText = Object.entries(speed)
    .map(([type, ft]) => `${type === 'land' ? '' : type + ' '}${ft} ft.`)
    .join(', ')

  return (
    <div className="wildshape-statblock">
      <p className="wildshape-title">
        {creature.name} — {creature.size} {creature.type}
      </p>

      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">HP</span>
          <span className="stat-pill-value">{hp}</span>
        </div>
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
      </div>

      <p className="breakdown">Speed: {speedText}</p>

      <table className="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Base</th>
            <th>Ability</th>
            <th>Misc</th>
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
              <td>{s.featBonus ? formatMod(s.featBonus) : '—'}</td>
              <td className="total-cell">{formatMod(s.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <AttackRoutine routine={attackRoutine} />

      {abilities.length > 0 && (
        <>
          <h3>Special Qualities &amp; Attacks</h3>
          <p className="breakdown">{abilities.join(', ')}</p>
        </>
      )}
    </div>
  )
}

export default function WildShapeCalculator({ sheet, wildShapeStatBlock }) {
  const { state, update } = useLiveState()
  const wildShapeConfig = sheet.character.wildShape
  const maxUses = wildShapeConfig.usesPerDay
  const [expanded, setExpanded] = useState(false)

  const eligibleForms = useMemo(
    () =>
      getEligibleWildShapeForms({
        monsterManual,
        characterLevel: sheet.character.level,
        maxSize: wildShapeConfig.maxSize,
        maxHd: wildShapeConfig.maxHd,
      }),
    [sheet.character.level, wildShapeConfig.maxSize, wildShapeConfig.maxHd],
  )

  const { canine, other } = useMemo(() => groupFormsForPicker(eligibleForms), [eligibleForms])

  const [selectedName, setSelectedName] = useState((canine[0] ?? other[0])?.name ?? '')

  const active = state.activeWildShapeForm

  const selectedCreature = eligibleForms.find((c) => c.name === selectedName)
  const selectedCost = selectedCreature ? wildShapeCost(selectedCreature) : 1
  const canAssume = !active && selectedCreature && state.wildShapeUsed + selectedCost <= maxUses

  return (
    <section className="card">
      <button type="button" className="collapsible-toggle wildshape-toggle" onClick={() => setExpanded((e) => !e)}>
        <span className={`chevron${expanded ? '' : ' collapsed'}`}>▾</span>
        Wild Shape
        {!expanded && wildShapeStatBlock && (
          <span className="wildshape-toggle-summary">🐾 {wildShapeStatBlock.creature.name}</span>
        )}
      </button>

      {expanded && (
        <div className="collapsible-body">
          <AnarchicToggle sheet={sheet} />

          {active && wildShapeStatBlock ? (
            <>
              <p className="breakdown">
                Currently wild shaped as <strong>{wildShapeStatBlock.creature.name}</strong> (
                {wildShapeStatBlock.creature.isCanine
                  ? '+20 ft. Totem Transformation applied'
                  : 'no Totem Transformation bonus — not a canine form'}
                ). AC, saves, speed, and the attack routine above now reflect this form — see the
                struck-through base values on each stat for what reverting restores.
              </p>
              {wildShapeStatBlock.abilities.length > 0 && (
                <>
                  <h3>Special Qualities &amp; Attacks</h3>
                  <p className="breakdown">{wildShapeStatBlock.abilities.join(', ')}</p>
                </>
              )}
              <button
                type="button"
                className="wildshape-revert"
                onClick={() => update((s) => revertWildShapeForm(s))}
              >
                Revert to normal form
              </button>
            </>
          ) : (
            <>
              <div className="wildshape-picker">
                <select value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
                  <optgroup label="Canine (+20 ft. speed)">
                    {canine.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.size}, {c.type}, {c.wildShapeMinLevel === 8 ? 'Feywild' : 'HD ' + c.hitDice})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other forms">
                    {other.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.size}, {c.type}, {c.wildShapeMinLevel === 8 ? 'Feywild' : 'HD ' + c.hitDice})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  disabled={!canAssume}
                  onClick={() =>
                    update((s) => assumeWildShapeForm(s, selectedCreature.name, selectedCost, maxUses))
                  }
                >
                  Assume Form{selectedCost > 1 ? ` (costs 2 uses)` : ''}
                </button>
              </div>
              {!canAssume && selectedCreature && (
                <p className="warning">Not enough wild shape uses remaining today.</p>
              )}
              {selectedCreature && (
                <StatBlock statBlock={computeWildShapeStatBlock({ sheet, creature: selectedCreature })} />
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
