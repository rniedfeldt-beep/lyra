import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { applyLevelUp, setSkillRanks, addFeat, addClassFeature } from '../../lib/liveState/actions'
import {
  isAbilityIncreaseLevel,
  skillPointsForLevel,
  maxSkillRank,
  skillRankCost,
  isClassSkillFor,
  classTakenAtLevel,
} from '../../lib/calc/leveling'
import { computeAbilityScores } from '../../lib/calc/abilities'
import { feats as allFeats, classSkillsTable, wildShapeUsesPerDayTable } from '../../lib/loadData'
import { formatMod } from '../../lib/format'
import './leveling.css'

const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
const CLASS_LABELS = { druid: 'Druid', planarShepherd: 'Planar Shepherd' }

export default function LevelUpFlow({ sheet, onClose }) {
  const { state, update } = useLiveState()
  const { character, feats: knownFeats } = sheet
  const newLevel = character.level + 1
  const abilityIncreaseLevel = isAbilityIncreaseLevel(newLevel)
  const takenClass = classTakenAtLevel(newLevel)

  const [hpRoll, setHpRoll] = useState(1)
  const [abilityChoice, setAbilityChoice] = useState('wis')
  const [wildShapeUses, setWildShapeUses] = useState(
    wildShapeUsesPerDayTable.byLevel[String(newLevel)] ?? character.wildShape.usesPerDay,
  )
  const [skillDeltas, setSkillDeltas] = useState({})
  const [featPick, setFeatPick] = useState('')
  const [pendingFeats, setPendingFeats] = useState([])
  const [classFeatureText, setClassFeatureText] = useState('')
  const [pendingClassFeatures, setPendingClassFeatures] = useState([])

  // Ability increases apply to skill-point Int mod for *this* level only
  // (PHB p.24), so the pool below has to be computed against a tentative
  // ability-score set that includes the pick, not the pre-level-up scores.
  const tentativeAbilityScores = useMemo(() => {
    const abilityAdjustments = [...character.abilityAdjustments]
    if (abilityIncreaseLevel && abilityChoice) {
      abilityAdjustments.push({
        ability: abilityChoice,
        value: 1,
        bonusType: 'level',
        source: `Level ${newLevel} ability increase`,
        active: true,
      })
    }
    return computeAbilityScores({ ...character, abilityAdjustments }, knownFeats)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abilityChoice])

  const conMod = tentativeAbilityScores.con.mod
  const hpGain = hpRoll + conMod
  const skillPointPool = skillPointsForLevel(tentativeAbilityScores.int.mod)

  const skillIds = useMemo(() => Object.keys(character.skills).sort(), [character.skills])

  function baseRanks(id) {
    return character.skills[id]?.ranks ?? 0
  }
  function currentRanks(id) {
    return skillDeltas[id] ?? baseRanks(id)
  }

  const spent = skillIds.reduce((sum, id) => {
    const gained = currentRanks(id) - baseRanks(id)
    if (gained <= 0) return sum
    const isClass = isClassSkillFor(id, newLevel, classSkillsTable)
    return sum + gained * skillRankCost(isClass)
  }, 0)
  const remaining = skillPointPool - spent

  function adjustSkill(id, delta) {
    const isClass = isClassSkillFor(id, newLevel, classSkillsTable)
    const cost = skillRankCost(isClass)
    const cap = maxSkillRank(newLevel, isClass)
    if (delta > 0 && (remaining < cost || currentRanks(id) >= cap)) return
    const next = Math.max(baseRanks(id), Math.min(cap, currentRanks(id) + delta))
    setSkillDeltas((d) => ({ ...d, [id]: next }))
  }

  const availableFeats = useMemo(
    () =>
      Object.values(allFeats)
        .filter((f) => !character.feats.includes(f.id) && !pendingFeats.includes(f.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [character.feats, pendingFeats],
  )

  function handleConfirm() {
    let next = applyLevelUp(state, {
      newLevel,
      hpRoll,
      wildShapeUsesPerDay: wildShapeUses,
      abilityIncrease: abilityIncreaseLevel ? { ability: abilityChoice } : null,
    })
    for (const id of skillIds) {
      const ranks = currentRanks(id)
      if (ranks !== baseRanks(id)) {
        next = setSkillRanks(next, id, ranks, character.skills[id].ability)
      }
    }
    for (const featId of pendingFeats) next = addFeat(next, featId)
    for (const desc of pendingClassFeatures) next = addClassFeature(next, desc)
    update(() => next)
    onClose()
  }

  return (
    <section className="card level-up-flow">
      <h2>Level Up — {character.level} → {newLevel}</h2>
      <p className="breakdown">
        Class taken at this level: <strong>{CLASS_LABELS[takenClass]}</strong>
      </p>

      <div className="level-up-block">
        <h3>Hit Points</h3>
        <div className="tracker-row">
          <label>
            d8 roll
            <input
              type="number"
              min="1"
              max="8"
              value={hpRoll}
              onChange={(e) => setHpRoll(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
            />
          </label>
          <span className="breakdown">
            {hpRoll} + Con {formatMod(conMod)} = <strong>+{hpGain} HP</strong>
          </span>
        </div>
      </div>

      {abilityIncreaseLevel && (
        <div className="level-up-block">
          <h3>Ability Score Increase</h3>
          <p className="breakdown">Level {newLevel} grants +1 to one ability score.</p>
          <div className="ability-choice-row">
            {Object.entries(ABILITY_LABELS).map(([key, label]) => (
              <label key={key} className="ability-choice">
                <input
                  type="radio"
                  name="ability-choice"
                  checked={abilityChoice === key}
                  onChange={() => setAbilityChoice(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="level-up-block">
        <h3>Skill Points</h3>
        <p className="breakdown">
          Pool: 4 + Int mod {formatMod(tentativeAbilityScores.int.mod)} = {skillPointPool} points ·{' '}
          <strong>{remaining} remaining</strong>
          {remaining < 0 && <span className="warning"> — over budget</span>}
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Ranks</th>
              <th>Max</th>
              <th>Cost/rank</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {skillIds.map((id) => {
              const isClass = isClassSkillFor(id, newLevel, classSkillsTable)
              const cap = maxSkillRank(newLevel, isClass)
              const ranks = currentRanks(id)
              return (
                <tr key={id}>
                  <td>
                    {character.skills[id].label ?? id}
                    {!isClass && <span className="note"> (cross-class)</span>}
                  </td>
                  <td>{ranks}</td>
                  <td>{cap}</td>
                  <td>{skillRankCost(isClass)}</td>
                  <td>
                    <div className="stepper">
                      <button
                        type="button"
                        disabled={ranks <= baseRanks(id)}
                        onClick={() => adjustSkill(id, -1)}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        disabled={ranks >= cap || remaining < skillRankCost(isClass)}
                        onClick={() => adjustSkill(id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="level-up-block">
        <h3>Wild Shape Uses/Day</h3>
        <p className="breakdown">
          Suggested from the character-level curve — {wildShapeUsesPerDayTable.confirmedLevels.includes(newLevel)
            ? 'DM-confirmed'
            : 'not yet DM-confirmed, edit if wrong'}
          .
        </p>
        <input
          type="number"
          min="0"
          value={wildShapeUses}
          onChange={(e) => setWildShapeUses(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>

      {newLevel === 9 && (
        <div className="level-up-block level-up-callout">
          <h3>Level 9 unlocks</h3>
          <p>5th-level spell slots, a 4th wild shape use/day, and cure critical wounds as a spontaneous conversion — all apply automatically once this level-up is confirmed.</p>
        </div>
      )}

      <div className="level-up-block">
        <h3>Feats</h3>
        <div className="tracker-row">
          <select value={featPick} onChange={(e) => setFeatPick(e.target.value)}>
            <option value="">Choose a feat…</option>
            {availableFeats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!featPick}
            onClick={() => {
              setPendingFeats((p) => [...p, featPick])
              setFeatPick('')
            }}
          >
            Add Feat
          </button>
        </div>
        {pendingFeats.length > 0 && (
          <ul className="pending-list">
            {pendingFeats.map((id) => (
              <li key={id}>
                {allFeats[id].name}{' '}
                <button type="button" onClick={() => setPendingFeats((p) => p.filter((x) => x !== id))}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="note">
          Only feats already in the data files appear here — a brand-new feat needs its JSON file added first.
        </p>
      </div>

      <div className="level-up-block">
        <h3>Class Features</h3>
        <div className="tracker-row">
          <input
            type="text"
            placeholder="e.g. Wolf Shaman bonus feat: Multiattack"
            value={classFeatureText}
            onChange={(e) => setClassFeatureText(e.target.value)}
          />
          <button
            type="button"
            disabled={!classFeatureText.trim()}
            onClick={() => {
              setPendingClassFeatures((p) => [...p, classFeatureText.trim()])
              setClassFeatureText('')
            }}
          >
            Add
          </button>
        </div>
        {pendingClassFeatures.length > 0 && (
          <ul className="pending-list">
            {pendingClassFeatures.map((desc, i) => (
              <li key={i}>
                {desc}{' '}
                <button
                  type="button"
                  onClick={() => setPendingClassFeatures((p) => p.filter((_, j) => j !== i))}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="level-up-actions">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="confirm-button" disabled={remaining < 0} onClick={handleConfirm}>
          Confirm Level {newLevel}
        </button>
      </div>
    </section>
  )
}
