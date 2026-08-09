import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  addActiveSummon,
  updateSummonDuration,
  removeActiveSummon,
  updateSummonMember,
  setSpellSlotUsed,
} from '../../lib/liveState/actions'
import { getReachableLoadouts, computeSummonStatBlock } from '../../lib/calc/summonBuilder'
import { monsterManual, greenboundTemplate, simpleTemplates } from '../../lib/loadCreatureData'
import { formatMod, SPELL_LEVEL_LABELS } from '../../lib/format'
import PartySection from '../layout/PartySection'
import './summon.css'

function loadoutLabel(creature, templateId, greenboundEligible) {
  if (!greenboundEligible) return creature.name
  if (!templateId) return `${creature.name} (Greenbound)`
  return `${creature.name} (${simpleTemplates[templateId].name} Greenbound)`
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

function AttackRoutineList({ title, routine }) {
  return (
    <>
      <h3>{title}</h3>
      <p className="action-type">Single attack — standard action</p>
      <ul className="summon-attacks">
        {routine.single.map((atk) => (
          <AttackEntry key={atk.name} atk={atk} />
        ))}
      </ul>
      {routine.hasSecondaries && (
        <>
          <p className="action-type">Full attack — full-round action</p>
          <ul className="summon-attacks">
            {routine.full.map((atk) => (
              <AttackEntry key={atk.name} atk={atk} />
            ))}
          </ul>
        </>
      )}
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
      {statBlock.slamRoutine && (
        <>
          <AttackRoutineList title="Slam Routine" routine={statBlock.slamRoutine} />
          <p className="note">Either routine may be used, not both, on a given attack.</p>
        </>
      )}

      {!statBlock.greenboundEligible && (
        <p className="note">
          Greenbound Summoning doesn't apply to elementals — plain summon, no template.
        </p>
      )}

      {qualities && (
        <>
          <h3>Qualities</h3>
          <p className="breakdown">
            DR {qualities.damageReduction} · Fast healing {qualities.fastHealing} · +{qualities.grappleBonus} grapple ·
            Resist cold {qualities.resistances.cold}/electricity {qualities.resistances.electricity} · Tremorsense{' '}
            {qualities.tremorsenseFt} ft. · +{qualities.racialSkillBonus.value}{' '}
            {qualities.racialSkillBonus.skills.join('/')} {qualities.racialSkillBonus.condition}
          </p>
        </>
      )}

      {spellLikeAbilities && (
        <>
          <h3>Spell-Like Abilities</h3>
          <p className="breakdown">
            At will — {spellLikeAbilities.atWill.join(', ')}; {spellLikeAbilities.perDay.map((s) => `${s.spell} 1/day`).join(', ')}.
            DC = 10 + spell level + {formatMod(chaMod)} (CHA)
          </p>
        </>
      )}
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

function MemberRow({ summonId, member, index, hpMax, tempHpMax, showWallOfThorns }) {
  const { update } = useLiveState()
  const inactive = member.status !== 'active'

  return (
    <div className={`summon-member-row${inactive ? ' summon-member-inactive' : ''}`}>
      <span className="summon-member-label">
        #{index + 1}
        {inactive && <span className="note"> ({member.status})</span>}
      </span>
      <label className="summon-member-field">
        HP
        <input
          type="number"
          disabled={inactive}
          value={member.hp}
          onChange={(e) => update((s) => updateSummonMember(s, summonId, member.id, { hp: Number(e.target.value) }))}
        />
        <span className="note">/ {hpMax}</span>
      </label>
      <label className="summon-member-field">
        Temp
        <input
          type="number"
          disabled={inactive}
          value={member.tempHp}
          onChange={(e) =>
            update((s) => updateSummonMember(s, summonId, member.id, { tempHp: Math.max(0, Number(e.target.value)) }))
          }
        />
        <span className="note">/ {tempHpMax}</span>
      </label>
      {showWallOfThorns && (
        <label className="summon-member-field summon-member-wot">
          <input
            type="checkbox"
            disabled={inactive}
            checked={member.wallOfThornsUsed}
            onChange={(e) =>
              update((s) => updateSummonMember(s, summonId, member.id, { wallOfThornsUsed: e.target.checked }))
            }
          />
          Wall of thorns
        </label>
      )}
      {!inactive && (
        <div className="summon-member-actions">
          <button type="button" onClick={() => update((s) => updateSummonMember(s, summonId, member.id, { status: 'dead' }))}>
            Dead
          </button>
          <button
            type="button"
            onClick={() => update((s) => updateSummonMember(s, summonId, member.id, { status: 'dismissed' }))}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

// Each active summon gets its own color-coded PartySection (rendered by
// CharacterSheet, separate from the builder tool below), so a summon's
// stats stay easy to find mid-combat alongside Lyra's and Quen's.
export function ActiveSummonSections() {
  const { state, update } = useLiveState()
  // Guards against summons saved before per-member tracking existed —
  // those are unreadable now and just get skipped rather than crashing.
  const groups = state.activeSummons.filter((s) => Array.isArray(s.members))
  if (groups.length === 0) return null

  return groups.map((s) => (
    <PartySection key={s.id} color="summon" title={s.label} subtitle={`${s.members.length} active`}>
      <div className="active-summon-controls">
        <div className="stepper">
          <button
            type="button"
            disabled={s.remainingRounds <= 0}
            onClick={() => update((st) => updateSummonDuration(st, s.id, s.remainingRounds - 1))}
          >
            −
          </button>
          <span>{s.remainingRounds} rd remaining</span>
          <button type="button" onClick={() => update((st) => updateSummonDuration(st, s.id, s.remainingRounds + 1))}>
            +
          </button>
        </div>
        <button type="button" onClick={() => update((st) => removeActiveSummon(st, s.id))}>
          Dismiss All
        </button>
      </div>
      {s.members.map((m, i) => (
        <MemberRow
          key={m.id}
          summonId={s.id}
          member={m}
          index={i}
          hpMax={s.hpMax}
          tempHpMax={s.tempHpMax}
          showWallOfThorns={s.greenboundEligible}
        />
      ))}
    </PartySection>
  ))
}

export default function SummonBuilder({ sheet }) {
  const { update } = useLiveState()
  const availableLevels = sheet.spellSlots.slots.filter((s) => s.total > 0).map((s) => s.spellLevel)
  const [level, setLevel] = useState(availableLevels[0])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)

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
    const count = Math.max(1, Math.floor(quantity) || 1)
    const summonId = `${Date.now()}-${statBlock.creature.name}`
    const members = Array.from({ length: count }, (_, i) => ({
      id: `${summonId}-${i}`,
      hp: statBlock.hp,
      tempHp: statBlock.tempHp,
      status: 'active',
      wallOfThornsUsed: false,
    }))

    update((s) => {
      const withSummon = addActiveSummon(s, {
        id: summonId,
        label: loadoutLabel(statBlock.creature, statBlock.templateId, statBlock.greenboundEligible),
        remainingRounds: statBlock.durationRounds,
        hpMax: statBlock.hp,
        tempHpMax: statBlock.tempHp,
        greenboundEligible: statBlock.greenboundEligible,
        members,
      })
      const used = withSummon.spellSlotsUsed[level] ?? 0
      const slot = sheet.spellSlots.slots.find((sl) => sl.spellLevel === level)
      return setSpellSlotUsed(withSummon, level, Math.min(slot.total, used + 1))
    })
  }

  return (
    <section className="card">
      <h2>Summon Builder</h2>
      <h3>Pick a Spell Slot Level</h3>
      <SpellLevelPicker level={level} setLevel={(l) => { setLevel(l); setSelectedIndex(0) }} availableLevels={availableLevels} />

      {loadouts.length === 0 ? (
        <p className="breakdown">No summonable creatures land on this level.</p>
      ) : (
        <>
          <select
            className="summon-loadout-select"
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
          >
            {loadouts.map((l, i) => (
              <option key={`${l.creature.name}-${l.templateId}`} value={i}>
                {loadoutLabel(l.creature, l.templateId, l.greenboundEligible)}
              </option>
            ))}
          </select>
          <div className="summon-quantity-row">
            <label>
              Quantity
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>
            <button type="button" className="summon-button" onClick={handleSummon}>
              Summon
            </button>
          </div>
          {statBlock && <SummonStatBlock statBlock={statBlock} />}
        </>
      )}
    </section>
  )
}
