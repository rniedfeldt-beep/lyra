import { useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  setBaseAbilityScore,
  updateAbilityAdjustment,
  removeAbilityAdjustment,
  addAbilityAdjustment,
} from '../../lib/liveState/actions'
import { formatMod } from '../../lib/format'
import './leveling.css'

const ABILITY_ORDER = [
  ['str', 'STR'],
  ['dex', 'DEX'],
  ['con', 'CON'],
  ['int', 'INT'],
  ['wis', 'WIS'],
  ['cha', 'CHA'],
]

function AddAdjustmentRow({ ability, onAdd }) {
  const [value, setValue] = useState('')
  const [bonusType, setBonusType] = useState('')
  const [source, setSource] = useState('')

  return (
    <div className="tracker-row">
      <input
        type="number"
        placeholder="Value"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input
        type="text"
        placeholder="Type (e.g. inherent)"
        value={bonusType}
        onChange={(e) => setBonusType(e.target.value)}
      />
      <input type="text" placeholder="Source" value={source} onChange={(e) => setSource(e.target.value)} />
      <button
        type="button"
        disabled={value === '' || !source.trim()}
        onClick={() => {
          onAdd({ ability, value: Number(value) || 0, bonusType: bonusType.trim() || 'untyped', source: source.trim(), active: true })
          setValue('')
          setBonusType('')
          setSource('')
        }}
      >
        Add
      </button>
    </div>
  )
}

// Base score, level-based increases, and inherent/other bonuses are kept as
// separate editable rows per ability rather than one flattened number —
// needed because they change independently: base almost never changes,
// level increases arrive only via level-up, inherent bonuses (the Wis tome)
// land whenever the DM says the reading is done, unrelated to leveling.
// Every field here already flows through computeAbilityScores inside
// computeCharacterSheet, so nothing downstream needs touching to recompute.
export default function AbilityScoreEditor({ sheet }) {
  const { state, update } = useLiveState()
  const [expanded, setExpanded] = useState(false)
  const { abilityScores } = sheet
  const baseScores = state.characterProgress.trueBaseAbilityScores
  const adjustments = state.characterProgress.abilityAdjustments

  return (
    <section className="card">
      <div className="card-header-row">
        <h2>Ability Scores</h2>
        <button type="button" className="edit-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Done' : 'Edit'}
        </button>
      </div>

      {!expanded ? (
        <div className="ability-grid">
          {ABILITY_ORDER.map(([key, label]) => {
            const a = abilityScores[key]
            return (
              <div className="ability-block" key={key}>
                <div className="ability-label">{label}</div>
                <div className="ability-score">{a.score}</div>
                <div className="ability-mod">{formatMod(a.mod)}</div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="ability-editor">
          {ABILITY_ORDER.map(([key, label]) => {
            const a = abilityScores[key]
            const rows = adjustments
              .map((adj, index) => ({ ...adj, index }))
              .filter((adj) => adj.ability === key)
            return (
              <div className="ability-editor-block" key={key}>
                <h3>
                  {label} — {a.score} ({formatMod(a.mod)})
                </h3>
                <label className="tracker-row">
                  Base
                  <input
                    type="number"
                    value={baseScores[key]}
                    onChange={(e) => update((s) => setBaseAbilityScore(s, key, Number(e.target.value) || 0))}
                  />
                </label>
                {rows.length > 0 && (
                  <table className="data-table ability-adjustments-table">
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Active</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((adj) => (
                        <tr key={adj.index}>
                          <td>
                            <input
                              type="text"
                              value={adj.source}
                              onChange={(e) =>
                                update((s) => updateAbilityAdjustment(s, adj.index, { source: e.target.value }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={adj.bonusType}
                              onChange={(e) =>
                                update((s) => updateAbilityAdjustment(s, adj.index, { bonusType: e.target.value }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={adj.value}
                              onChange={(e) =>
                                update((s) =>
                                  updateAbilityAdjustment(s, adj.index, { value: Number(e.target.value) || 0 }),
                                )
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={adj.active}
                              onChange={(e) =>
                                update((s) => updateAbilityAdjustment(s, adj.index, { active: e.target.checked }))
                              }
                            />
                          </td>
                          <td>
                            <button type="button" onClick={() => update((s) => removeAbilityAdjustment(s, adj.index))}>
                              remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <AddAdjustmentRow ability={key} onAdd={(adj) => update((s) => addAbilityAdjustment(s, adj))} />
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
