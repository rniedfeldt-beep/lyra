import { lyraSheet, dailyAbilities, companion } from '../lib/lyraSheet'
import { formatMod, SPELL_LEVEL_LABELS } from '../lib/format'
import TrackersPanel from './trackers/TrackersPanel'
import WildShapeCalculator from './wildshape/WildShapeCalculator'
import SummonBuilder, { ActiveSummonSections } from './summon/SummonBuilder'
import CompanionPanel from './companion/CompanionPanel'
import CombatBar from './layout/CombatBar'
import PartySection from './layout/PartySection'
import './CharacterSheet.css'

const ABILITY_ORDER = [
  ['str', 'STR'],
  ['dex', 'DEX'],
  ['con', 'CON'],
  ['int', 'INT'],
  ['wis', 'WIS'],
  ['cha', 'CHA'],
]

function Card({ title, children }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function AbilityScores({ abilityScores }) {
  return (
    <Card title="Ability Scores">
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
    </Card>
  )
}

function CombatStats({ sheet }) {
  const { character, ac, saves, initiative, spellAttackBonus, speed } = sheet
  return (
    <Card title="Combat Stats">
      <div className="stat-row-group">
        <div className="stat-pill">
          <span className="stat-pill-label">HP</span>
          <span className="stat-pill-value">{character.hp.max}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Initiative</span>
          <span className="stat-pill-value">{formatMod(initiative)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Spell Attack</span>
          <span className="stat-pill-value">{formatMod(spellAttackBonus)}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-pill-label">Speed</span>
          <span className="stat-pill-value">{speed.total} ft.</span>
        </div>
      </div>
      <p className="breakdown">
        Spell attack bonus = BAB {formatMod(sheet.progression.bab)} + Wis mod{' '}
        {formatMod(sheet.abilityScores.wis.mod)} (DM-confirmed)
      </p>

      <h3>Armor Class</h3>
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
      </div>
      <p className="breakdown">
        {ac.breakdown.map((b) => `${b.label} ${formatMod(b.value)}`).join(' · ')}
      </p>

      <h3>Saves</h3>
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

      <p className="breakdown">
        Speed: {speed.base} ft. base + {speed.enhancement} ft. ({speed.enhancementSource})
      </p>
    </Card>
  )
}

function AttackRoutine({ sheet }) {
  const { attackRoutine } = sheet
  const weapon = sheet.items.weapon
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
                <span className="note">{items.armor.note}</span>
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
            <strong>{items.ring.name}</strong> — {formatMod(items.ring.acBonus)} deflection
          </li>
        )}
        {items.cloak && (
          <li>
            <strong>{items.cloak.name}</strong> — {items.cloak.description}
          </li>
        )}
        {items.necklace && (
          <li>
            <strong>{items.necklace.name}</strong> — {items.necklace.description}
            <ul className="sub-list">
              {items.necklace.grantedSpells.map((s) => (
                <li key={s.spell}>{s.spell.replace(/_/g, ' ')}, 1/day</li>
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
            <p>{f.description}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function CharacterSheet() {
  const sheet = lyraSheet
  const { character } = sheet

  return (
    <>
      <CombatBar sheet={sheet} />
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

        <PartySection color="lyra" title={character.name} subtitle="Player character">
          <TrackersPanel sheet={sheet} dailyAbilities={dailyAbilities} />
          <WildShapeCalculator sheet={sheet} />
          <SummonBuilder sheet={sheet} />
          <AbilityScores abilityScores={sheet.abilityScores} />
          <CombatStats sheet={sheet} />
          <AttackRoutine sheet={sheet} />
          <Skills skills={sheet.skills} conditionalAbilityBonuses={character.conditionalAbilityBonuses} />
          <SpellSlots
            spellSlots={sheet.spellSlots}
            casterLevel={character.casterLevel.druid}
            spellDcBase={character.spellDcBase}
          />
          <Equipment items={sheet.items} />
          <Feats feats={sheet.feats} />
        </PartySection>

        <PartySection color="quen" title={companion.name} subtitle="Animal companion">
          <CompanionPanel companion={companion} />
        </PartySection>

        <ActiveSummonSections />

        <p className="phase-note">Phase 5 — wild shape and summon builder live, trackers synced via Supabase.</p>
      </div>
    </>
  )
}
