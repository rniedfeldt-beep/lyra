import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { addActiveSummon, updateActiveSummon, removeActiveSummon, setSpellSlotUsed } from '../../lib/liveState/actions'
import { getReachableLoadouts, computeSummonStatBlock } from '../../lib/calc/summonBuilder'
import { monsterManual, greenboundTemplate, simpleTemplates } from '../../lib/loadCreatureData'
import { formatMod, SPELL_LEVEL_LABELS } from '../../lib/format'
import './summon.css'

function loadoutLabel(creature, templateId) {
  if (!templateId) return `${creature.name} (Greenbound)`
  return `${creature.name} (${simpleTemplates[templateId].name} Greenbound)`
}

function AttackRoutineList({ title, routine }) {
  return (
    <>
      <h3>{title}</h3>
      <ul className="summon-attacks">
        {routine.map((atk) => (
          <li key={atk.name}>
            {atk.count > 1 ? `${atk.count} × ` : ''}
            {atk.name} {formatMod(atk.attackBonus)}, {atk.damage.die}
            {atk.damage.bonus ? formatMod(atk.damage.bonus) : ''}, crit {atk.damage.crit}
            {!atk.primary && <span className="note"> (secondary)</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

function SummonStatBlock({ statBlock }) {
  const { creature, size, type, ac, hp, tempHp, spellLevel, chaMod, durationRounds, castAsStandardAction, qualities, spellLikeAbilities } = statBlock

  return (
    <div className="summon-statblock">
      <p className="summon-title">
        {creature.name} — {size} {type}
      </p>
      <p className="breakdown">
        Spell level {spellLevel} · Duration {durationRounds} rounds
        {castAsStandardAction ? ' · cast as a standard action (Totemic Summons)' : ''}
      </p>

      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">HP</span>
          <span className="stat-pill-value">{hp}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Temp HP</span>
          <span className="stat-pill-value">{formatMod(tempHp)}</span>
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

      <AttackRoutineList title="Natural Weapon Routine" routine={statBlock.naturalWeaponRoutine} />
      <AttackRoutineList title="Slam Routine" routine={statBlock.slamRoutine} />
      <p className="note">Either routine may be used, not both, on a given attack.</p>

      <h3>Qualities</h3>
      <p className="breakdown">
        DR {qualities.damageReduction} · Fast healing {qualities.fastHealing} · +{qualities.grappleBonus} grapple ·
        Resist cold {qualities.resistances.cold}/electricity {qualities.resistances.electricity} · Tremorsense{' '}
        {qualities.tremorsenseFt} ft. · +{qualities.racialSkillBonus.value}{' '}
        {qualities.racialSkillBonus.skills.join('/')} {qualities.racialSkillBonus.condition}
      </p>

      <h3>Spell-Like Abilities</h3>
      <p className="breakdown">
        At will — {spellLikeAbilities.atWill.join(', ')}; {spellLikeAbilities.perDay.map((s) => `${s.spell} 1/day`).join(', ')}.
        DC = 10 + spell level + {formatMod(chaMod)} (CHA)
      </p>
    </div>
  )
}

function SpellLevelPicker({ level, setLevel, availableLevels }) {
  return (
    <div className="summon-level-picker">
      {availableLevels.map((l) => (
        <button key={l} type="button" className={l === level ? 'active' : ''} onClick={() => setLevel(l)}>
          {SPELL_LEVEL_LABELS[l]}
        </button>
      ))}
    </div>
  )
}

function ActiveSummons() {
  const { state, update } = useLiveState()
  if (state.activeSummons.length === 0) return null

  return (
    <div className="active-summons">
      <h3>Active Summons</h3>
      {state.activeSummons.map((s) => (
        <div className="active-summon-row" key={s.id}>
          <span>{s.label}</span>
          <div className="stepper">
            <button
              type="button"
              disabled={s.remainingRounds <= 0}
              onClick={() => update((st) => updateActiveSummon(st, s.id, { remainingRounds: s.remainingRounds - 1 }))}
            >
              −
            </button>
            <span>{s.remainingRounds} rd</span>
            <button
              type="button"
              onClick={() => update((st) => updateActiveSummon(st, s.id, { remainingRounds: s.remainingRounds + 1 }))}
            >
              +
            </button>
          </div>
          <button type="button" onClick={() => update((st) => removeActiveSummon(st, s.id))}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}

export default function SummonBuilder({ sheet }) {
  const { update } = useLiveState()
  const availableLevels = sheet.spellSlots.slots.filter((s) => s.total > 0).map((s) => s.spellLevel)
  const [level, setLevel] = useState(availableLevels[0])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const loadouts = useMemo(
    () => getReachableLoadouts({ monsterManual, greenboundTemplate, simpleTemplates, spellLevel: level }),
    [level],
  )
  const selected = loadouts[selectedIndex]
  const statBlock = selected
    ? computeSummonStatBlock({
        sheet,
        creature: selected.creature,
        templateId: selected.templateId,
        simpleTemplates,
        greenboundTemplate,
      })
    : null

  function handleSummon() {
    if (!statBlock) return
    update((s) => {
      const withSummon = addActiveSummon(s, {
        id: `${Date.now()}-${statBlock.creature.name}`,
        label: loadoutLabel(statBlock.creature, statBlock.templateId),
        remainingRounds: statBlock.durationRounds,
      })
      const used = withSummon.spellSlotsUsed[level] ?? 0
      const slot = sheet.spellSlots.slots.find((sl) => sl.spellLevel === level)
      return setSpellSlotUsed(withSummon, level, Math.min(slot.total, used + 1))
    })
  }

  return (
    <section className="card">
      <h2>Summon Builder</h2>
      <ActiveSummons />

      <h3>Pick a Spell Slot Level</h3>
      <SpellLevelPicker level={level} setLevel={(l) => { setLevel(l); setSelectedIndex(0) }} availableLevels={availableLevels} />

      {loadouts.length === 0 ? (
        <p className="breakdown">No canine trades or base Greenbound options land on this level.</p>
      ) : (
        <>
          <select
            className="summon-loadout-select"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {loadouts.map((l, i) => (
              <option key={loadoutLabel(l.creature, l.templateId)} value={i}>
                {loadoutLabel(l.creature, l.templateId)}
              </option>
            ))}
          </select>
          <button type="button" className="summon-button" onClick={handleSummon}>
            Summon
          </button>
          {statBlock && <SummonStatBlock statBlock={statBlock} />}
        </>
      )}
    </section>
  )
}
