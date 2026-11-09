import { useMemo, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  addActiveSummon,
  updateSummonDuration,
  advanceSummonRound,
  removeActiveSummon,
  updateSummonMember,
  setSummonAbilityUsed,
  setSpellSlotUsed,
} from '../../lib/liveState/actions'
import { getReachableLoadouts, computeSummonStatBlock } from '../../lib/calc/summonBuilder'
import { limitedUseAbilities, usedUses, noteSentences } from '../../lib/calc/summonAbilities'
import { abilityMod } from '../../lib/calc/abilities'
import { monsterManual, greenboundTemplate, simpleTemplates } from '../../lib/loadCreatureData'
import { formatMod, SPELL_LEVEL_LABELS } from '../../lib/format'
import PartySection from '../layout/PartySection'
import ErrorBoundary from '../ErrorBoundary'
import { AbilityText, SpellRef, SpellRefWith } from '../spells/SpellRef'
import './summon.css'

const ABILITY_ORDER = [
  ['str', 'STR'],
  ['dex', 'DEX'],
  ['con', 'CON'],
  ['int', 'INT'],
  ['wis', 'WIS'],
  ['cha', 'CHA'],
]

function loadoutLabel(creature, templateId, greenboundEligible) {
  if (!greenboundEligible) return creature.name
  if (!templateId) return `${creature.name} (Greenbound)`
  return `${creature.name} (${simpleTemplates[templateId].name} Greenbound)`
}

// Collapsible wrapper used both for the picker's preview (default collapsed
// — useful while deciding, noise once summoned) and each active group's
// full stat block (default expanded — that's the one you need mid-combat).
export function Collapsible({ title, defaultExpanded, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-toggle" onClick={() => setExpanded((e) => !e)}>
        <span className={`chevron${expanded ? '' : ' collapsed'}`}>▾</span>
        {title}
      </button>
      {expanded && <div className="collapsible-body">{children}</div>}
    </div>
  )
}

// Marks an ability as coming from the Greenbound template rather than the
// base creature's own stat block.
function TemplateTag() {
  return <span className="template-tag">Greenbound</span>
}

function greenboundQualityLines(q) {
  const { racialSkillBonus: r, resistances } = q
  return [
    `DR ${q.damageReduction}`,
    `Fast healing ${q.fastHealing}`,
    `+${q.grappleBonus} grapple bonus`,
    `Resist cold ${resistances.cold}, electricity ${resistances.electricity}`,
    `Tremorsense ${q.tremorsenseFt} ft.`,
    `+${r.value} racial bonus on ${r.skills.join(' and ')} checks ${r.condition}`,
  ]
}

function critText(crit, noCrits) {
  if (noCrits) return 'no critical hits'
  return `crit ${crit ?? '—'}`
}

function AttackEntry({ atk, noCrits }) {
  return (
    <li>
      {atk.count > 1 ? `${atk.count} × ` : ''}
      {atk.name} {formatMod(atk.attackBonus)}, {atk.damage.die}
      {atk.damage.bonus ? formatMod(atk.damage.bonus) : ''}, {critText(atk.damage.crit, noCrits)}
      {!atk.primary && <span className="note"> (secondary)</span>}
    </li>
  )
}

function AttackRoutineList({ title, routine, noCrits }) {
  return (
    <>
      <h3>{title}</h3>
      <p className="action-type">Single attack — standard action</p>
      <ul className="summon-attacks">
        {routine.single.map((atk) => (
          <AttackEntry key={atk.name} atk={atk} noCrits={noCrits} />
        ))}
      </ul>
      {routine.hasSecondaries && (
        <>
          <p className="action-type">Full attack — full-round action</p>
          <ul className="summon-attacks">
            {routine.full.map((atk) => (
              <AttackEntry key={atk.name} atk={atk} noCrits={noCrits} />
            ))}
          </ul>
        </>
      )}
    </>
  )
}

// Which feat effects reached this summon and which did not — a plain summon
// and a Greenbound one read differently at a glance.
function EffectsLedger({ effects }) {
  // Nothing applied (a summon spell that carries no feat effects) means
  // nothing to show — the box is for summons where something took effect.
  if (!effects.some((e) => e.applied)) return null
  return (
    <div className="summon-effects">
      <p className="summon-effects-headline">Feat effects</p>
      <ul>
        {effects.map((e) => (
          <li key={e.id} className={e.applied ? 'effect-applied' : 'effect-skipped'}>
            <span className="effect-mark" aria-hidden="true">
              {e.applied ? '✓' : '✗'}
            </span>
            <span className="effect-label">{e.label}</span>
            <span className="effect-state">{e.applied ? 'Applied' : 'Not applied'}</span>
            {e.detail && <span className="effect-detail">{e.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SummonStatBlock({ statBlock }) {
  const {
    creature,
    size,
    type,
    abilities,
    saves,
    ac,
    initiative,
    speed,
    hp,
    tempHp,
    spellLevel,
    chaMod,
    durationRounds,
    castAsStandardAction,
    qualities,
    spellLikeAbilities,
    effects,
    spell,
  } = statBlock
  const noCrits = /\bSwarm\b/.test(type)
  const notes = spell ? noteSentences(creature) : []

  // Every summon carries the Greenbound template (except elementals), so its
  // description is the template's version; a creature with no such variant
  // falls back to the plain one.
  const appearanceText = (statBlock.greenboundEligible && creature.appearanceGreenbound) || creature.appearance

  const speedText = Object.entries(speed)
    .map(([t, ft]) => `${t === 'land' ? '' : t + ' '}${ft} ft.`)
    .join(', ')

  return (
    <div className="summon-statblock">
      <p className="summon-title">
        {creature.name} — {size} {type}
      </p>
      {spell ? (
        <p className="breakdown">
          {spell.name} · {SPELL_LEVEL_LABELS[spell.slotLevel]}-level slot · Casting time {spell.castingTime} · Duration{' '}
          {durationRounds} rounds ({spell.duration})
        </p>
      ) : (
        <p className="breakdown">
          Spell level {spellLevel} · Duration {durationRounds} rounds
          {castAsStandardAction ? ' · cast as a standard action (Totemic Summons)' : ''}
        </p>
      )}

      {effects && <EffectsLedger effects={effects} />}

      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">HP</span>
          <span className="stat-pill-value">{hp}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Temp HP</span>
          <span className="stat-pill-value">{formatMod(tempHp)}</span>
        </div>
      </div>

      <div className="ability-grid">
        {ABILITY_ORDER.map(([key, label]) => {
          const score = abilities[key]
          return (
            <div className="ability-block" key={key}>
              <div className="ability-label">{label}</div>
              <div className="ability-score">{score}</div>
              <div className="ability-mod">{formatMod(abilityMod(score))}</div>
            </div>
          )
        })}
      </div>

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
          <span className="stat-pill-label">Initiative</span>
          <span className="stat-pill-value">{formatMod(initiative)}</span>
        </div>
      </div>

      <p className="breakdown">Speed: {speedText}</p>

      {statBlock.naturalWeaponRoutine && (
        <AttackRoutineList title="Natural Weapon Routine" routine={statBlock.naturalWeaponRoutine} noCrits={noCrits} />
      )}
      {statBlock.slamRoutine && (
        <>
          <AttackRoutineList title="Slam Routine" routine={statBlock.slamRoutine} noCrits={noCrits} />
          {statBlock.naturalWeaponRoutine && (
            <p className="note">Either routine may be used, not both, on a given attack.</p>
          )}
        </>
      )}
      {!statBlock.naturalWeaponRoutine && !statBlock.slamRoutine && (
        <p className="note">No natural attacks.</p>
      )}

      {!effects && !statBlock.greenboundEligible && (
        <p className="note">
          Greenbound Summoning doesn't apply to elementals — plain summon, no template.
        </p>
      )}

      {(creature.specialAttacks?.length > 0 || spellLikeAbilities) && (
        <>
          <h3>Special Attacks</h3>
          <ul className="summon-abilities">
            {creature.specialAttacks?.map((text) => (
              <li key={text}>
                <AbilityText text={text} />
              </li>
            ))}
            {spellLikeAbilities && (
              <li>
                <TemplateTag />
                Spell-like abilities — at will:{' '}
                {spellLikeAbilities.atWill.map((name, i) => (
                  <span key={name}>
                    {i > 0 && ', '}
                    <SpellRef name={name} />
                  </span>
                ))}
                ;{' '}
                {spellLikeAbilities.perDay.map((s, i) => (
                  <span key={s.spell}>
                    {i > 0 && ', '}
                    <SpellRef name={s.spell}> {s.usesPerDay}/day</SpellRef>
                  </span>
                ))}
                . DC = 10 + spell level + {formatMod(chaMod)} (CHA)
              </li>
            )}
          </ul>
        </>
      )}

      {(creature.specialQualities?.length > 0 || qualities) && (
        <>
          <h3>Special Qualities</h3>
          <ul className="summon-abilities">
            {creature.specialQualities?.map((text) => (
              <li key={text}>
                <AbilityText text={text} />
              </li>
            ))}
            {qualities &&
              greenboundQualityLines(qualities).map((text) => (
                <li key={text}>
                  <TemplateTag />
                  {text}
                </li>
              ))}
          </ul>
        </>
      )}

      {creature.skills && (
        <p className="breakdown">
          <strong>Skills:</strong> {creature.skills}
        </p>
      )}

      {notes.length > 0 && (
        <>
          <h3>Notes</h3>
          <ul className="summon-abilities summon-notes">
            {notes.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </>
      )}

      {(appearanceText || creature.behavior) && (
        <Collapsible title="Appearance & Behavior" defaultExpanded={false}>
          {appearanceText && (
            <p className="summon-flavor">
              <strong>Appearance.</strong> {appearanceText}
            </p>
          )}
          {creature.behavior && (
            <p className="summon-flavor">
              <strong>Behavior.</strong> {creature.behavior}
            </p>
          )}
        </Collapsible>
      )}
    </div>
  )
}

export function SpellLevelPicker({ level, setLevel, availableLevels }) {
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

// "Fish cloud", "(DC 14)" — an annotation that isn't already bracketed is
// shown in parentheses.
function annotationText(annotation) {
  if (!annotation) return ''
  return /^[([]/.test(annotation) ? annotation : `(${annotation})`
}

// One checkbox per use of a limited-use ability — a 3/day ability gets three.
// Ticking a box spends that use and every use before it; unticking gives that
// use back along with every use after it.
function AbilityUseRow({ ability, used, disabled, onChange }) {
  return (
    <li className="summon-ability-use">
      <SpellRefWith name={ability.name}>
        {(nameNode) => (
          <span className="summon-ability-name">
            {ability.source === 'greenbound' && <TemplateTag />}
            {nameNode}
            {ability.annotation && <span className="note"> {annotationText(ability.annotation)}</span>}
          </span>
        )}
      </SpellRefWith>
      <span className="summon-ability-boxes">
        {Array.from({ length: ability.usesPerDay }, (_, i) => (
          <input
            key={i}
            type="checkbox"
            disabled={disabled}
            checked={i < used}
            aria-label={`${ability.name}, use ${i + 1} of ${ability.usesPerDay}`}
            onChange={() => onChange(i < used ? i : i + 1)}
          />
        ))}
        <span className="note">{ability.usesPerDay}/day</span>
      </span>
    </li>
  )
}

function MemberRow({ summonId, member, index, hpMax, tempHpMax, abilities }) {
  const { update } = useLiveState()
  const inactive = member.status !== 'active'
  const spent = abilities.reduce((n, a) => n + usedUses(member, a), 0)
  const total = abilities.reduce((n, a) => n + a.usesPerDay, 0)

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
      {abilities.length > 0 && (
        <div className="summon-member-abilities">
          <Collapsible title={`Daily abilities — ${spent} of ${total} used`} defaultExpanded={true}>
            <ul className="summon-ability-list">
              {abilities.map((a) => (
                <AbilityUseRow
                  key={a.key}
                  ability={a}
                  used={usedUses(member, a)}
                  disabled={inactive}
                  onChange={(n) => update((s) => setSummonAbilityUsed(s, summonId, member.id, a.key, n))}
                />
              ))}
            </ul>
          </Collapsible>
        </div>
      )}
    </div>
  )
}

// Each active summon gets its own color-coded PartySection (rendered by
// CharacterSheet, separate from the builder tool below), so a summon's
// stats stay easy to find mid-combat alongside Lyra's and Quen's. Each cast
// is its own group even if it summons the same creature as an earlier
// group — never merge by creature name, since duration, HP and daily
// ability uses are tracked independently per cast.
// What produced a group — summon nature's ally (including groups cast before
// the source was recorded) or one of the other summon spells.
function summonSourceLabel(summon) {
  const src = summon.source
  if (src?.kind === 'spell') return `${src.spellName} (${SPELL_LEVEL_LABELS[src.slotLevel]} level)`
  const level = src?.slotLevel ?? summon.statBlock?.spellLevel
  return level != null ? `Summon Nature's Ally (${SPELL_LEVEL_LABELS[level]} level)` : "Summon Nature's Ally"
}

// Everything currently out, from either builder, in one place.
function ActiveSummonOverview({ groups }) {
  const { update } = useLiveState()
  const alive = (g) => g.members.filter((m) => m.status === 'active').length
  const total = groups.reduce((n, g) => n + alive(g), 0)
  return (
    <PartySection
      color="summon"
      title="Summons Out"
      subtitle={`${total} creature${total === 1 ? '' : 's'} in ${groups.length} group${groups.length === 1 ? '' : 's'}`}
    >
      <div className="summon-overview-controls">
        <button
          type="button"
          className="summon-button"
          disabled={groups.every((g) => g.remainingRounds <= 0)}
          onClick={() => update((st) => advanceSummonRound(st))}
        >
          Next round
        </button>
        <span className="note">Takes a round off every group below.</span>
      </div>
      <ul className="summon-overview">
        {groups.map((g) => (
          <li key={g.id}>
            <span className="summon-overview-name">
              {g.label} <span className="note">×{alive(g)}</span>
            </span>
            <span className="note">
              {summonSourceLabel(g)} · {g.remainingRounds > 0 ? `${g.remainingRounds} rd left` : 'expired'}
            </span>
          </li>
        ))}
      </ul>
    </PartySection>
  )
}

export function ActiveSummonSections() {
  const { state, update } = useLiveState()
  // Guards against summons saved before per-member tracking existed —
  // those are unreadable now and just get skipped rather than crashing.
  const groups = state.activeSummons.filter((s) => Array.isArray(s.members))
  if (groups.length === 0) return null

  return (
    <>
      <ActiveSummonOverview groups={groups} />
      {groups.map((s) => (
        <ErrorBoundary key={s.id} label={`Summon "${s.label}"`}>
        <PartySection
          color="summon"
          title={`${s.label} ×${s.members.length} — ${s.remainingRounds} rounds left`}
        >
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

          <p className="breakdown">{summonSourceLabel(s)}</p>

          {/* Identical summons share identical numbers — the stat block is shown
              once per group, with individual HP and daily ability uses tracked
              below it per instance. Older saved summons predate this field. */}
          {s.statBlock && (
            <Collapsible title="Stat Block" defaultExpanded={true}>
              <ErrorBoundary label={`Stat block for "${s.label}"`}>
                <SummonStatBlock statBlock={s.statBlock} />
              </ErrorBoundary>
            </Collapsible>
          )}

          {s.members.map((m, i) => (
            <MemberRow
              key={m.id}
              summonId={s.id}
              member={m}
              index={i}
              hpMax={s.hpMax}
              tempHpMax={s.tempHpMax}
              abilities={s.statBlock ? limitedUseAbilities(s.statBlock) : []}
            />
      ))}
    </PartySection>
    </ErrorBoundary>
      ))}
    </>
  )
}

export default function SummonBuilder({ sheet }) {
  const { update } = useLiveState()
  // Level 0 (summon nature's minor ally) is always available alongside
  // whatever leveled slots Lyra has — orisons aren't part of spellSlots.slots
  // at all (no daily cap under this campaign's houserule), so it's prepended
  // here rather than derived from slot totals like the others.
  const availableLevels = [0, ...sheet.spellSlots.slots.filter((s) => s.total > 0).map((s) => s.spellLevel)]
  const [level, setLevel] = useState(availableLevels[0])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [quantity, setQuantity] = useState(1)

  const loadouts = useMemo(
    () => getReachableLoadouts({ monsterManual, greenboundTemplate, simpleTemplates, spellLevel: level }),
    [level],
  )
  const selected = loadouts[selectedIndex]
  // A creature entry with an unexpected shape makes this throw. It runs in
  // this component's own render, which an ErrorBoundary below can't catch,
  // so it's guarded here: log, show a note in place of the preview, and keep
  // the picker usable so another creature can still be chosen.
  let statBlock = null
  let statBlockError = null
  if (selected) {
    try {
      statBlock = computeSummonStatBlock({
        sheet,
        creature: selected.creature,
        templateId: selected.templateId,
        simpleTemplates,
        greenboundTemplate,
      })
    } catch (err) {
      console.error(`Could not build a stat block for "${selected.creature.name}":`, err)
      statBlockError = err
    }
  }

  function handleSummon() {
    if (!statBlock) return
    const count = Math.max(1, Math.floor(quantity) || 1)
    const summonId = `${Date.now()}-${statBlock.creature.name}`
    const members = Array.from({ length: count }, (_, i) => ({
      id: `${summonId}-${i}`,
      hp: statBlock.hp,
      tempHp: statBlock.tempHp,
      status: 'active',
      abilityUses: {},
    }))

    update((s) => {
      const withSummon = addActiveSummon(s, {
        id: summonId,
        label: loadoutLabel(statBlock.creature, statBlock.templateId, statBlock.greenboundEligible),
        remainingRounds: statBlock.durationRounds,
        hpMax: statBlock.hp,
        tempHpMax: statBlock.tempHp,
        greenboundEligible: statBlock.greenboundEligible,
        source: { kind: 'sna', slotLevel: level },
        statBlock,
        members,
      })
      // Orisons are unlimited under this campaign's houserule — no slot to
      // spend, no daily cap, and no spellSlotsUsed[0] tracker to update.
      if (level === 0) return withSummon
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
            <button type="button" className="summon-button" onClick={handleSummon} disabled={!statBlock}>
              Summon
            </button>
          </div>
          {statBlockError && (
            <p className="warning">
              ⚠ {selected.creature.name} can't be built right now. Pick another creature.
            </p>
          )}
          {statBlock && (
            <Collapsible title="Stat Block Preview" defaultExpanded={false}>
              <ErrorBoundary key={`${selected.creature.name}-${selected.templateId}-${level}`} label="Stat block preview">
                <SummonStatBlock statBlock={statBlock} />
              </ErrorBoundary>
            </Collapsible>
          )}
        </>
      )}
    </section>
  )
}
