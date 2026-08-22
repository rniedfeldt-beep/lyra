import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveState } from '../lib/liveState/LiveStateContext'
import { formatMod, SPELL_LEVEL_LABELS } from '../lib/format'
import TrackersPanel from './trackers/TrackersPanel'
import LevelUpFlow from './leveling/LevelUpFlow'
import AbilityScoreEditor from './leveling/AbilityScoreEditor'
import WildShapeCalculator from './wildshape/WildShapeCalculator'
import SummonBuilder, { ActiveSummonSections } from './summon/SummonBuilder'
import CompanionPanel from './companion/CompanionPanel'
import CombatBar from './layout/CombatBar'
import PartySection from './layout/PartySection'
import TabBar from './layout/TabBar'
import { anarchicTemplate, monsterManual } from '../lib/loadCreatureData'
import { computeAnarchicWindowMinutes, computeAnarchicInvokedMinutes, computeSmiteLawBonus } from '../lib/calc/anarchic'
import { getActiveWildShapeStatBlock } from '../lib/calc/wildShape'
import './CharacterSheet.css'

// Lazy-loaded: the spell reference data (~850KB of extracted sourcebook
// text) has no business being in the initial bundle everyone downloads to
// see Lyra's combat stats. This code-splits the whole spells/ subtree —
// component plus the data it pulls in — into its own chunk, fetched only
// when the Spells tab is actually opened.
const SpellReferenceTab = lazy(() => import('./spells/SpellReferenceTab'))

function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

// A small paw badge marks any stat currently driven by an assumed wild
// shape form, so it's visually obvious at a glance which numbers are
// "hers" and which are "the form's" without reading every value.
function WildBadge() {
  return (
    <span className="wildshape-badge" title="Changed by wild shape">
      🐾
    </span>
  )
}

// Renders a stat's current value, and — only while wild shaped and only for
// stats the form actually changes — the pre-wild-shape base value right
// alongside it, struck through and carrying a tooltip. Reverting always
// shows this same base value, so it doubles as a preview of "what reverting
// gives me back."
function StatValue({ current, base, wild, format = (v) => v }) {
  if (!wild) return <span className="stat-pill-value">{format(current)}</span>
  return (
    <span className="stat-pill-value-group">
      <span className="stat-pill-value wildshape-value">{format(current)}</span>
      <s className="stat-pill-base" title={`Base (no wild shape): ${format(base)}`}>
        {format(base)}
      </s>
    </span>
  )
}

// Data can mark a spell name for italics with *asterisks* (e.g. "Grants
// *misty step*") rather than every description needing its own JSX —
// wherever text is rendered through this, italics just work.
function withItalics(text) {
  return text.split(/\*([^*]+)\*/g).map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part))
}

function SpellcastingReference({ sheet }) {
  const { character, spellAttackBonus, progression, abilityScores, spellSlots } = sheet
  const levels = [0, ...spellSlots.slots.filter((s) => s.total > 0).map((s) => s.spellLevel)]

  return (
    <Card title="Spellcasting">
      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">Caster Level</span>
          <span className="stat-pill-value">{character.casterLevel.druid}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Spell Attack</span>
          <span className="stat-pill-value">{formatMod(spellAttackBonus)}</span>
        </div>
      </div>
      <p className="breakdown">
        Spell attack bonus = BAB {formatMod(progression.bab)} + Wis mod{' '}
        {formatMod(abilityScores.wis.mod)}
      </p>

      <h3>Save DCs by Level</h3>
      <table className="data-table">
        <thead>
          <tr>
            {levels.map((l) => (
              <th key={l}>{SPELL_LEVEL_LABELS[l]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {levels.map((l) => (
              <td key={l} className="total-cell">
                {character.spellDcBase + l}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </Card>
  )
}

function CombatStatsCore({ sheet, wildShapeStatBlock }) {
  const { character, initiative, speed } = sheet
  const wild = !!wildShapeStatBlock
  const currentInitiative = wild ? wildShapeStatBlock.initiative : initiative
  const currentSpeed = wild ? wildShapeStatBlock.speed.land : speed.total
  const extraMovement = wild
    ? Object.entries(wildShapeStatBlock.speed).filter(([type]) => type !== 'land')
    : []

  return (
    <Card title="Combat Stats">
      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">HP</span>
          <span className="stat-pill-value">{character.hp.max}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">
            Initiative {wild && <WildBadge />}
          </span>
          <StatValue current={currentInitiative} base={initiative} wild={wild} format={formatMod} />
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">
            Speed {wild && <WildBadge />}
          </span>
          <StatValue current={currentSpeed} base={speed.total} wild={wild} format={(v) => `${v} ft.`} />
        </div>
      </div>
      <p className="breakdown">
        {wild ? (
          <>
            {wildShapeStatBlock.creature.name} form: {currentSpeed} ft. land
            {extraMovement.length > 0 &&
              `, ${extraMovement.map(([type, ft]) => `${ft} ft. ${type}`).join(', ')}`}{' '}
            · base land speed (no wild shape) {speed.total} ft.
          </>
        ) : (
          <>
            Speed: {speed.base} ft. base + {speed.enhancement} ft. ({speed.enhancementSource})
          </>
        )}
      </p>
    </Card>
  )
}

function ArmorClass({ ac, wildShapeStatBlock }) {
  const wild = !!wildShapeStatBlock
  const currentAc = wild ? wildShapeStatBlock.ac : ac
  const dexMod = wild ? wildShapeStatBlock.abilityScores.dex.mod : null

  return (
    <Card title="Armor Class">
      <div className="stat-row-group">
        <div className="stat-pill stat-pill-large">
          <span className="stat-pill-label">
            AC {wild && <WildBadge />}
          </span>
          <StatValue current={currentAc.total} base={ac.total} wild={wild} />
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Touch</span>
          <StatValue current={currentAc.touch} base={ac.touch} wild={wild} />
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Flat-footed</span>
          <StatValue current={currentAc.flatFooted} base={ac.flatFooted} wild={wild} />
        </div>
      </div>
      <p className="breakdown">
        {wild ? (
          <>
            {wildShapeStatBlock.creature.name} form: 10 + {wildShapeStatBlock.creature.size} size + Dex{' '}
            {formatMod(dexMod)} + natural armor {formatMod(wildShapeStatBlock.creature.naturalArmor)} + persistent
            items · base AC (no wild shape) {ac.total}
          </>
        ) : (
          ac.breakdown.map((b) => `${b.label} ${formatMod(b.value)}`).join(' · ')
        )}
      </p>
    </Card>
  )
}

function Saves({ saves, wildShapeStatBlock }) {
  const wild = !!wildShapeStatBlock
  const rows = [
    ['Fortitude', saves.fort, wild ? wildShapeStatBlock.saves.fort : null],
    ['Reflex', saves.ref, wild ? wildShapeStatBlock.saves.ref : null],
    ['Will', saves.will, null],
  ]

  return (
    <Card title="Saves">
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
          {rows.map(([label, baseSave, wildSave]) => {
            const s = wildSave ?? baseSave
            return (
              <tr key={label}>
                <td>
                  {label} {wildSave && <WildBadge />}
                </td>
                <td>{formatMod(s.base)}</td>
                <td>{formatMod(s.abilityMod)}</td>
                <td>{s.featBonus ? formatMod(s.featBonus) : '—'}</td>
                <td className="total-cell">
                  <StatValue current={s.total} base={baseSave.total} wild={!!wildSave} format={formatMod} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function WildShapeAttackEntry({ atk }) {
  return (
    <li>
      {atk.count > 1 ? `${atk.count} × ` : ''}
      {atk.name} {formatMod(atk.attackBonus)}, {atk.damage.die}
      {atk.damage.bonus ? formatMod(atk.damage.bonus) : ''}, crit {atk.damage.crit}
      {!atk.primary && <span className="note"> (secondary)</span>}
    </li>
  )
}

function AttackRoutine({ sheet, wildShapeStatBlock }) {
  const { attackRoutine } = sheet
  const weapon = sheet.items.weapon

  if (wildShapeStatBlock) {
    const routine = wildShapeStatBlock.attackRoutine
    return (
      <Card title="Attack Routine">
        <p className="weapon-name">
          {wildShapeStatBlock.creature.name} natural weapons <WildBadge />
        </p>
        {routine.single.length === 0 ? (
          <p className="note">No attacks in this form.</p>
        ) : (
          <>
            <p className="action-type">Single attack — standard action</p>
            <ul className="wildshape-attacks">
              {routine.single.map((atk) => (
                <WildShapeAttackEntry key={atk.name} atk={atk} />
              ))}
            </ul>
            {routine.hasSecondaries && (
              <>
                <p className="action-type">Full attack — full-round action</p>
                <ul className="wildshape-attacks">
                  {routine.full.map((atk) => (
                    <WildShapeAttackEntry key={atk.name} atk={atk} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {weapon && attackRoutine && (
          <p className="breakdown">
            {weapon.name} unusable while wild shaped — base single attack (no wild shape){' '}
            <s title={`Base: ${weapon.name} ${formatMod(attackRoutine.singleAttack)}`}>
              {formatMod(attackRoutine.singleAttack)}
            </s>
            .
          </p>
        )}
      </Card>
    )
  }

  if (!attackRoutine || !weapon) return null

  return (
    <Card title="Attack Routine">
      <p className="weapon-name">{weapon.name}</p>
      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">Single attack</span>
          <span className="stat-pill-value">{formatMod(attackRoutine.singleAttack)}</span>
        </div>
        <div className="stat-pill stat-pill-wide">
          <span className="stat-pill-label">Full attack</span>
          <span className="stat-pill-value">
            {attackRoutine.fullAttack.map(formatMod).join(' / ')}
          </span>
        </div>
      </div>
      <p className="breakdown">
        Damage: {attackRoutine.damage.die}
        {attackRoutine.damage.bonus ? formatMod(attackRoutine.damage.bonus) : ''} {attackRoutine.damage.type},
        crit {weapon.critical.threatRangeLow}-20/×{weapon.critical.multiplier}
      </p>
      {attackRoutine.warnings.map((w) => (
        <p className="warning" key={w}>
          ⚠ {w}
        </p>
      ))}
    </Card>
  )
}

function formatTotalWithConditionals(s) {
  if (!s.conditionalBonuses.length) return formatMod(s.total)
  const parenthetical = s.conditionalBonuses
    .map((c) => `${formatMod(c.total)}, ${c.condition}`)
    .join('; ')
  return `${formatMod(s.total)} (${parenthetical})`
}

function Skills({ skills, conditionalAbilityBonuses }) {
  const rows = Object.values(skills).sort((a, b) => a.label.localeCompare(b.label))
  return (
    <Card title="Skills">
      <table className="data-table">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Ranks</th>
            <th>Ability</th>
            <th>Misc</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.ranks}</td>
              <td>{formatMod(s.abilityMod)}</td>
              <td>{s.miscBonus ? formatMod(s.miscBonus) : '—'}</td>
              <td className="total-cell">{formatTotalWithConditionals(s)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {conditionalAbilityBonuses?.map((a) => (
        <p className="breakdown" key={a.id}>
          {a.label}:{' '}
          {a.conditionalBonuses.map((c) => `${formatMod(c.value)} ${c.condition}`).join(', ')}
        </p>
      ))}
    </Card>
  )
}

function SpellSlots({ spellSlots, casterLevel, spellDcBase }) {
  const usable = spellSlots.slots.filter((s) => s.total > 0)
  return (
    <Card title="Spell Slots">
      <p className="breakdown">
        Caster level {casterLevel} · Save DC {spellDcBase} + spell level
      </p>
      <p className="breakdown">
        0th: {spellSlots.orisons.prepared} prepared, unlimited uses
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Base</th>
            <th>Bonus</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {usable.map((s) => (
            <tr key={s.spellLevel}>
              <td>{SPELL_LEVEL_LABELS[s.spellLevel]}</td>
              <td>{s.base}</td>
              <td>{s.bonus || '—'}</td>
              <td className="total-cell">{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Equipment({ items }) {
  return (
    <Card title="Equipment">
      <ul className="equipment-list">
        {items.armor && (
          <li>
            <strong>{items.armor.name}</strong> — {formatMod(items.armor.acBonus)} AC armor, max Dex +
            {items.armor.maxDexBonus}, {items.armor.material}
            {items.armor.note && (
              <>
                <br />
                <span className="note">{withItalics(items.armor.note)}</span>
              </>
            )}
          </li>
        )}
        {items.shield && (
          <li>
            <strong>{items.shield.name}</strong> — {formatMod(items.shield.acBonus)} AC shield, non-metal
          </li>
        )}
        {items.ring && (
          <li>
            <strong>{items.ring.name}</strong> — {formatMod(items.ring.acBonus)} deflection bonus to AC
          </li>
        )}
        {items.cloak && (
          <li>
            <strong>{items.cloak.name}</strong> — {withItalics(items.cloak.description)}
          </li>
        )}
        {items.necklace && (
          <li>
            <strong>{items.necklace.name}</strong> — {items.necklace.description}
            <ul className="sub-list">
              {items.necklace.grantedSpells.map((s) => (
                <li key={s.spell}>
                  <em>{s.spell.replace(/_/g, ' ')}</em>, 1/day
                </li>
              ))}
            </ul>
            {items.necklace.note && <span className="note">{items.necklace.note}</span>}
          </li>
        )}
      </ul>
    </Card>
  )
}

function Feats({ feats }) {
  return (
    <Card title="Feats">
      <ul className="feats-list">
        {feats.map((f) => (
          <li key={f.id}>
            <strong>{f.name}</strong> <span className="note">({f.source})</span>
            <p>{withItalics(f.description)}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// The full write-up — rarely-needed material moved off Tab 1, where only
// the checkbox/countdown/Smite-Law summary lives now (AnarchicToggle,
// inside the Wild Shape card).
function AnarchicReference({ sheet }) {
  const casterLevel = sheet.character.casterLevel.druid
  const windowMinutes = computeAnarchicWindowMinutes(casterLevel, anarchicTemplate)
  const durationMinutes = computeAnarchicInvokedMinutes(casterLevel, anarchicTemplate)
  const smiteLawBonus = computeSmiteLawBonus(sheet.character.level, anarchicTemplate)

  return (
    <Card title="Anarchic Template">
      <p className="breakdown">
        {anarchicTemplate.source} · {anarchicTemplate.grantedBy}
      </p>
      <p>
        Cast as a swift action, spending a 4th-level slot, to open an invocation window of{' '}
        {anarchicTemplate.castWindowMinutesPerCasterLevel} min/caster level ({windowMinutes} min at her current
        caster level). Invoking within that window spends 1 wild shape use and makes the template active for{' '}
        {anarchicTemplate.invokedDurationMinutesPerCasterLevel} min/caster level ({durationMinutes} min). An
        overlay on Lyra herself, not a form modifier — applies in base form or wild shaped, and survives assuming
        or reverting a form. The Tab 1 checkbox collapses this into one step, paying both costs at once.
      </p>
      <p className="breakdown">
        Darkvision {anarchicTemplate.darkvisionFt} ft. · Resist{' '}
        {Object.entries(anarchicTemplate.resistances)
          .map(([type, amount]) => `${amount} ${type}`)
          .join(', ')}{' '}
        · Immune to {anarchicTemplate.immunities.join(', ')}
      </p>

      <h3>Damage Reduction &amp; Fast Healing by Hit Dice</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>HD</th>
            <th>DR</th>
            <th>Fast Healing</th>
          </tr>
        </thead>
        <tbody>
          {anarchicTemplate.drFastHealingByHd.map((b) => (
            <tr key={b.minHd}>
              <td>{b.maxHd ? `${b.minHd}–${b.maxHd}` : `${b.minHd}+`}</td>
              <td>{b.damageReduction ? `${b.damageReduction.amount}/${b.damageReduction.bypass}` : '—'}</td>
              <td>{b.fastHealing || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">If the base creature already has fast healing or DR, use the better value.</p>

      <p>
        <strong>{anarchicTemplate.smiteLaw.name}</strong> (Su, {anarchicTemplate.smiteLaw.usesPerDay}/day) —{' '}
        {anarchicTemplate.smiteLaw.description} At her current HD, that's {formatMod(smiteLawBonus)} damage.
      </p>

      <p className="breakdown">
        {anarchicTemplate.typeChange.from.join(' and ')} become {anarchicTemplate.typeChange.to}; all other types
        unchanged. Minimum Intelligence {anarchicTemplate.abilityMinimums.int}. No change to ability scores,
        saves, skills, or feats.
      </p>
    </Card>
  )
}

export default function CharacterSheet() {
  const { sheet, dailyAbilities, companion, state } = useLiveState()
  const { character } = sheet
  const [activeTab, setActiveTab] = useState('lyra')
  const [levelingUp, setLevelingUp] = useState(false)
  // Each tab's window scroll position is remembered independently, so
  // switching to the Spells tab (its own search/filters, potentially a very
  // different content height) and back never disturbs where you'd scrolled
  // to on another tab.
  const scrollPositions = useRef({})

  // The single source every stat-block component reads to decide whether
  // it's showing Lyra's own numbers or the assumed form's — null whenever
  // no form is active, so every "wild ? ... : ..." branch below collapses
  // back to the base sheet with nothing left over to clean up on revert.
  const wildShapeStatBlock = useMemo(
    () => getActiveWildShapeStatBlock({ sheet, activeForm: state.activeWildShapeForm, monsterManual }),
    [sheet, state.activeWildShapeForm],
  )

  function handleTabChange(nextTab) {
    scrollPositions.current[activeTab] = window.scrollY
    setActiveTab(nextTab)
  }

  useEffect(() => {
    const saved = scrollPositions.current[activeTab] ?? 0
    requestAnimationFrame(() => window.scrollTo(0, saved))
  }, [activeTab])

  return (
    <>
      <CombatBar sheet={sheet} wildShapeStatBlock={wildShapeStatBlock} />
      <TabBar active={activeTab} onChange={handleTabChange} />
      <div className="sheet">
        <header className="sheet-header">
          <h1>{character.name}</h1>
          <p className="subtitle">
            {character.race} {character.classes.map((c) => `${c.name} ${c.levels}`).join(' / ')}
            {' · '}Level {character.level}
          </p>
          <p className="subtitle">
            {character.archetype} archetype · {character.planarAttunement} attunement · {character.campaign}
          </p>
        </header>

        {activeTab === 'lyra' && (
          <PartySection color="lyra" title={character.name} subtitle="Player character">
            <TrackersPanel sheet={sheet} dailyAbilities={dailyAbilities} onLevelUp={() => setLevelingUp(true)} />
            {levelingUp && <LevelUpFlow sheet={sheet} onClose={() => setLevelingUp(false)} />}
            <SpellcastingReference sheet={sheet} />
            <AbilityScoreEditor sheet={sheet} wildShapeStatBlock={wildShapeStatBlock} />
            <CombatStatsCore sheet={sheet} wildShapeStatBlock={wildShapeStatBlock} />
            <ArmorClass ac={sheet.ac} wildShapeStatBlock={wildShapeStatBlock} />
            <Saves saves={sheet.saves} wildShapeStatBlock={wildShapeStatBlock} />
            <WildShapeCalculator sheet={sheet} wildShapeStatBlock={wildShapeStatBlock} />
            <Skills skills={sheet.skills} conditionalAbilityBonuses={character.conditionalAbilityBonuses} />
          </PartySection>
        )}

        {activeTab === 'companions' && (
          <>
            <PartySection color="quen" title={companion.name} subtitle="Animal companion">
              <CompanionPanel companion={companion} />
            </PartySection>

            <PartySection color="summon" title="Summon Nature's Ally" subtitle="Build a new summon">
              <SummonBuilder sheet={sheet} />
            </PartySection>

            <ActiveSummonSections />
          </>
        )}

        {activeTab === 'reference' && (
          <PartySection color="lyra" title="Reference" subtitle="Spells, equipment, feats">
            <SpellSlots
              spellSlots={sheet.spellSlots}
              casterLevel={character.casterLevel.druid}
              spellDcBase={character.spellDcBase}
            />
            <Equipment items={sheet.items} />
            <Feats feats={sheet.feats} />
            <AnarchicReference sheet={sheet} />
            <AttackRoutine sheet={sheet} wildShapeStatBlock={wildShapeStatBlock} />
          </PartySection>
        )}

        {activeTab === 'spells' && (
          <PartySection color="spells" title="Spell Reference">
            <Suspense fallback={<p className="breakdown">Loading spell reference…</p>}>
              <SpellReferenceTab />
            </Suspense>
          </PartySection>
        )}

        <p className="phase-note">Phase 9 — XP tracking and level-up live, character progress synced via Supabase.</p>
      </div>
    </>
  )
}
