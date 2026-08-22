import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { applyLevelUp, setSkillRanks, addFeat, addClassFeature } from '../../lib/liveState/actions'
import {
  isAbilityIncreaseLevel,
  skillPointsForLevel,
  maxSkillRank,
  skillRankCost,
  isClassSkillFor,
  isClassSkillForAnyClass,
  classTakenAtLevel,
} from '../../lib/calc/leveling'
import { computeAbilityScores } from '../../lib/calc/abilities'
import { checkFeatQualification, buildFeatQualificationContext } from '../../lib/calc/featPrerequisites'
import { featReferenceByName } from '../../lib/loadFeatReferenceData'
import { feats as allFeats, classSkillsTable, wildShapeUsesPerDayTable } from '../../lib/loadData'
import { formatMod } from '../../lib/format'
import './leveling.css'

const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' }
const CLASS_LABELS = { druid: 'Druid', planarShepherd: 'Planar Shepherd' }
const FEAT_STATUS_LABELS = {
  qualifies: 'Qualifies',
  unqualified: "Doesn't qualify",
  'needs-check': 'Check manually',
}

export default function LevelUpFlow({ sheet, onClose }) {
  const { state, update } = useLiveState()
  const { character, feats: knownFeats, progression } = sheet
  const newLevel = character.level + 1
  const abilityIncreaseLevel = isAbilityIncreaseLevel(newLevel)
  const takenClass = classTakenAtLevel(newLevel)

  // Raw string, not a clamped number: clamping on every keystroke fights the
  // browser's own cursor/selection handling on a controlled number input —
  // typing into a field that already shows "1" without full-selecting it
  // first appends to make "15", which then clamped straight to 8. Keep the
  // field free-form while typing; only clamp on blur, and hpRoll (used for
  // the live Con-mod preview and at confirm time) is derived separately so
  // an in-progress edit never breaks the calculation shown below it.
  const [hpRollInput, setHpRollInput] = useState('1')
  const hpRoll = Math.max(1, Math.min(8, parseInt(hpRollInput, 10) || 1))
  const [abilityChoice, setAbilityChoice] = useState('wis')
  const hpBlockRef = useRef(null)

  // useEffect already runs after the DOM commit for this render, so the
  // block's layout is live by the time this fires — no need to defer via
  // requestAnimationFrame (which a backgrounded/inactive tab can throttle
  // or skip entirely). An instant jump, not 'smooth': "jump to" per the
  // request, and it doesn't depend on a scroll animation completing.
  useEffect(() => {
    hpBlockRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [])
  const [wildShapeUses, setWildShapeUses] = useState(
    wildShapeUsesPerDayTable.byLevel[String(newLevel)] ?? character.wildShape.usesPerDay,
  )
  const [skillDeltas, setSkillDeltas] = useState({})
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

  // PHB p.59: cap and cost are governed separately. Cap asks whether a
  // skill is a class skill for *any* of Lyra's classes (the union);
  // cost asks only about the class whose level is being taken this
  // level-up. A skill can sit at the full class-skill cap while still
  // costing double per rank — e.g. Heal, always druid-capped, costs
  // 2/rank while leveling as Planar Shepherd.
  function adjustSkill(id, delta) {
    const isClassForCost = isClassSkillFor(id, newLevel, classSkillsTable)
    const isClassForCap = isClassSkillForAnyClass(id, classSkillsTable)
    const cost = skillRankCost(isClassForCost)
    const cap = maxSkillRank(newLevel, isClassForCap)
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

  // Qualification is checked against Lyra's *current* stats (including the
  // pending ability-score-increase pick, if any) — not a hypothetical
  // post-level-up BAB — since "currently qualify" means before this
  // level-up is even confirmed. A feat that's out of reach today still
  // shows up, just flagged, so it's visible as something to work toward
  // rather than hidden. knownFeatNames includes pendingFeats too (by name,
  // since prerequisites cite feats by their printed name), so picking a
  // prerequisite feat and its dependent in the same level-up session
  // resolves the chain live.
  const featContext = useMemo(() => {
    const context = buildFeatQualificationContext({
      abilityScores: tentativeAbilityScores,
      progression,
      casterLevel: character.casterLevel.druid,
      feats: knownFeats,
      skills: character.skills,
    })
    const pendingFeatNames = pendingFeats.map((id) => allFeats[id].name)
    return { ...context, knownFeatNames: [...context.knownFeatNames, ...pendingFeatNames] }
  }, [tentativeAbilityScores, progression, character.casterLevel.druid, knownFeats, character.skills, pendingFeats])

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

      <div className="level-up-block" ref={hpBlockRef}>
        <h3>Hit Points</h3>
        <div className="tracker-row">
          <label>
            d8 roll
            <input
              type="number"
              min="1"
              max="8"
              value={hpRollInput}
              onChange={(e) => setHpRollInput(e.target.value)}
              onBlur={() => setHpRollInput(String(hpRoll))}
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
              const isClassForCost = isClassSkillFor(id, newLevel, classSkillsTable)
              const isClassForCap = isClassSkillForAnyClass(id, classSkillsTable)
              const cap = maxSkillRank(newLevel, isClassForCap)
              const cost = skillRankCost(isClassForCost)
              const ranks = currentRanks(id)
              return (
                <tr key={id}>
                  <td>
                    {character.skills[id].label ?? id}
                    {!isClassForCost && <span className="note"> (cross-class cost)</span>}
                  </td>
                  <td>{ranks}</td>
                  <td>{cap}</td>
                  <td>{cost}</td>
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
                        disabled={ranks >= cap || remaining < cost}
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
          Pre-filled from the DM-confirmed character-level curve — edit if this level ever
          changes.
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
          <p>5th-level spell slots and cure critical wounds as a spontaneous conversion — both apply automatically once this level-up is confirmed.</p>
        </div>
      )}

      <div className="level-up-block">
        <h3>Feats</h3>
        <div className="feat-picker-list">
          {availableFeats.map((f) => {
            const reference = featReferenceByName[f.name]
            const { results, status } = checkFeatQualification(reference?.prerequisites, featContext)
            const sourceLabel = reference?.page ? `${reference.source} p.${reference.page}` : (reference?.source ?? f.source)
            return (
              <div key={f.id} className={`feat-card feat-row-${status}`}>
                <div className="feat-card-header">
                  <span>
                    <strong>{f.name}</strong> <span className="note">({sourceLabel})</span>
                  </span>
                  <span className={`feat-status-badge feat-status-${status}`}>{FEAT_STATUS_LABELS[status]}</span>
                </div>
                <p className="feat-description">{reference?.benefit ?? f.description}</p>
                {results.length > 0 && (
                  <ul className="feat-prereq-list">
                    {results.map((r, i) => (
                      <li
                        key={i}
                        className={r.met === true ? 'prereq-met' : r.met === false ? 'prereq-unmet' : 'prereq-unknown'}
                      >
                        {r.met === true ? '✓' : r.met === false ? '✗' : '?'} {r.label}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="feat-card-footer">
                  <button type="button" onClick={() => setPendingFeats((p) => [...p, f.id])}>
                    Add
                  </button>
                </div>
              </div>
            )
          })}
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
          Feats flagged "Doesn't qualify" or "Check manually" are still pickable — the DM may grant a feat outside
          its normal prerequisites (like a Wolf Shaman bonus feat), so this warns rather than blocks.
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
