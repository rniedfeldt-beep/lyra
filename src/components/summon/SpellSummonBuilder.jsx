import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import { addActiveSummon, setSpellSlotUsed } from '../../lib/liveState/actions'
import { computeSummonStatBlock, getSpellSummonPool, spellSlotLevels } from '../../lib/calc/summonBuilder'
import { monsterManual, greenboundTemplate, simpleTemplates } from '../../lib/loadCreatureData'
import { summonSpellsTable } from '../../lib/loadData'
import { SPELL_LEVEL_LABELS } from '../../lib/format'
import ErrorBoundary from '../ErrorBoundary'
import { Collapsible, SpellLevelPicker, SummonStatBlock } from './SummonBuilder'
import { SpellRef } from '../spells/SpellRef'
import './summon.css'

// Builder for the summon spells other than summon nature's ally: pick the
// spell, the slot level, and the creature, then cast. Each cast is one
// creature in its own group, which lands in the same active list as the
// summon nature's ally builder's groups. No template and no feat effects
// unless the spell's flags in data/tables/summonSpells.json turn them on.
export default function SpellSummonBuilder({ sheet }) {
  const { state, update } = useLiveState()
  const spells = summonSpellsTable.spells
  const [spellId, setSpellId] = useState(spells[0].id)
  const [slotChoice, setSlotChoice] = useState(null)
  const [creatureName, setCreatureName] = useState(null)

  const spell = spells.find((s) => s.id === spellId)
  const slotsByLevel = Object.fromEntries(sheet.spellSlots.slots.map((s) => [s.spellLevel, s.total]))
  const levels = spellSlotLevels(
    spell,
    sheet.spellSlots.slots.filter((s) => s.total > 0).map((s) => s.spellLevel),
  )
  // The slot actually in use: the picked one if this spell can still use it,
  // otherwise the lowest the spell allows (switching spell resets it).
  const level = levels.includes(slotChoice) ? slotChoice : levels[0]

  const pool = useMemo(
    () => (level == null ? [] : getSpellSummonPool({ monsterManual, spell, slotLevel: level })),
    [spell, level],
  )
  const creature = pool.find((c) => c.name === creatureName) ?? pool[0]

  // A creature entry with an unexpected shape makes this throw in this
  // component's own render, which no boundary below it can catch — guard it
  // here the way the summon nature's ally builder does.
  let statBlock = null
  let statBlockError = null
  if (creature) {
    try {
      statBlock = computeSummonStatBlock({
        sheet,
        creature,
        templateId: null,
        simpleTemplates,
        greenboundTemplate,
        spell: { ...spell, slotLevel: level },
      })
    } catch (err) {
      console.error(`Could not build a stat block for "${creature.name}":`, err)
      statBlockError = err
    }
  }

  const slotTotal = level == null ? 0 : (slotsByLevel[level] ?? 0)
  const slotsLeft = level == null ? 0 : slotTotal - (state.spellSlotsUsed[level] ?? 0)

  function handleCast() {
    if (!statBlock || slotsLeft <= 0) return
    const summonId = `${Date.now()}-${statBlock.creature.name}`
    update((s) => {
      const withSummon = addActiveSummon(s, {
        id: summonId,
        label: `${statBlock.creature.name} (${spell.name})`,
        remainingRounds: statBlock.durationRounds,
        hpMax: statBlock.hp,
        tempHpMax: statBlock.tempHp,
        greenboundEligible: statBlock.greenboundEligible,
        source: { kind: 'spell', spellId: spell.id, spellName: spell.name, slotLevel: level },
        statBlock,
        members: [{ id: `${summonId}-0`, hp: statBlock.hp, tempHp: statBlock.tempHp, status: 'active', abilityUses: {} }],
      })
      const used = withSummon.spellSlotsUsed[level] ?? 0
      return setSpellSlotUsed(withSummon, level, Math.min(slotTotal, used + 1))
    })
  }

  return (
    <section className="card">
      <h2>Other Summon Spells</h2>

      <h3>Pick a Spell</h3>
      <div className="summon-level-picker">
        {spells.map((sp) => (
          <button
            key={sp.id}
            type="button"
            className={sp.id === spellId ? 'active' : ''}
            onClick={() => {
              setSpellId(sp.id)
              setCreatureName(null)
            }}
          >
            {sp.name}
          </button>
        ))}
      </div>
      <p className="breakdown">
        <SpellRef name={spell.name} /> · Casting time {spell.castingTime} · Duration {spell.duration.label}
        {spell.scalable ? ' · Scalable: the fey can have up to as many Hit Dice as the slot level' : ''}
      </p>

      <h3>Pick a Spell Slot Level</h3>
      {levels.length === 0 ? (
        <p className="breakdown">
          No {SPELL_LEVEL_LABELS[spell.slotLevel]}-level slots.
        </p>
      ) : (
        <>
          <SpellLevelPicker
            level={level}
            setLevel={(l) => {
              setSlotChoice(l)
              setCreatureName(null)
            }}
            availableLevels={levels}
          />
          <p className="breakdown">
            {slotsLeft} of {slotTotal} {SPELL_LEVEL_LABELS[level]}-level slots left
          </p>

          {pool.length === 0 ? (
            <p className="breakdown">No creatures can be summoned from this slot.</p>
          ) : (
            <>
              <h3>Pick a Creature</h3>
              <select
                className="summon-loadout-select"
                value={creature.name}
                onChange={(e) => setCreatureName(e.target.value)}
              >
                {pool.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="summon-quantity-row">
                <button
                  type="button"
                  className="summon-button"
                  onClick={handleCast}
                  disabled={!statBlock || slotsLeft <= 0}
                >
                  Cast {spell.name}
                </button>
                {slotsLeft <= 0 && <span className="note">No slots left at this level.</span>}
              </div>
              {statBlockError && (
                <p className="warning">⚠ {creature.name} can't be built right now. Pick another creature.</p>
              )}
              {statBlock && (
                <Collapsible title="Stat Block Preview" defaultExpanded={false}>
                  <ErrorBoundary key={`${spell.id}-${creature.name}-${level}`} label="Stat block preview">
                    <SummonStatBlock statBlock={statBlock} />
                  </ErrorBoundary>
                </Collapsible>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
