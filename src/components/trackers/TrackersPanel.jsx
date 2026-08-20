import { useRef, useState } from 'react'
import { useLiveState } from '../../lib/liveState/LiveStateContext'
import {
  applyDamage,
  applyHeal,
  setCurrentHp,
  setTempHp,
  setSpellSlotUsed,
  setPreparedSpell,
  setWildShapeUsed,
  setDailyUse,
} from '../../lib/liveState/actions'
import { spontaneousConversions } from '../../lib/loadData'
import { SPELL_LEVEL_LABELS } from '../../lib/format'
import XpTracker from '../leveling/XpTracker'
import './trackers.css'

function parsePositiveAmount(raw) {
  const amount = Number(raw)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

// Defaults collapsed for Prepared Spells — filled in once after a Long Rest
// and then mostly just noise taking up space on Tab 1 for the rest of the day.
function Collapsible({ title, defaultExpanded, children }) {
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

export function DamageHealRow({ onDamage, onHeal }) {
  const [damageAmount, setDamageAmount] = useState('')
  const [healAmount, setHealAmount] = useState('')

  return (
    <div className="tracker-row">
      <input
        type="number"
        inputMode="numeric"
        placeholder="Damage"
        value={damageAmount}
        onChange={(e) => setDamageAmount(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          const amount = parsePositiveAmount(damageAmount)
          if (amount === null) return
          onDamage(amount)
          setDamageAmount('')
        }}
      >
        Apply Damage
      </button>
      <input
        type="number"
        inputMode="numeric"
        placeholder="Heal"
        value={healAmount}
        onChange={(e) => setHealAmount(e.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          const amount = parsePositiveAmount(healAmount)
          if (amount === null) return
          onHeal(amount)
          setHealAmount('')
        }}
      >
        Apply Heal
      </button>
    </div>
  )
}

function HpTracker({ hpMax }) {
  const { state, update } = useLiveState()

  return (
    <div className="tracker-block">
      <h3>Hit Points</h3>
      <div className="tracker-row">
        <label>
          Current
          <input
            type="number"
            value={state.hp.current}
            onChange={(e) => update((s) => setCurrentHp(s, Number(e.target.value)))}
          />
        </label>
        <span className="tracker-max">/ {hpMax}</span>
        <label>
          Temp
          <input
            type="number"
            value={state.hp.temp}
            onChange={(e) => update((s) => setTempHp(s, Number(e.target.value)))}
          />
        </label>
      </div>
      <DamageHealRow
        onDamage={(amount) => update((s) => applyDamage(s, amount))}
        onHeal={(amount) => update((s) => applyHeal(s, amount, hpMax))}
      />
    </div>
  )
}

function SpellSlotTracker({ spellSlots }) {
  const { state, update } = useLiveState()
  const usable = spellSlots.slots.filter((s) => s.total > 0)

  return (
    <div className="tracker-block">
      <h3>Spell Slots</h3>
      <p className="orisons-line">
        0th: {spellSlots.orisons.prepared} prepared, unlimited uses
      </p>
      <div className="slot-grid">
        {usable.map((s) => {
          const used = state.spellSlotsUsed[s.spellLevel] ?? 0
          return (
            <div className="slot-counter" key={s.spellLevel}>
              <span className="slot-level">{SPELL_LEVEL_LABELS[s.spellLevel]}</span>
              <div className="stepper">
                <button
                  type="button"
                  disabled={used <= 0}
                  onClick={() => update((st) => setSpellSlotUsed(st, s.spellLevel, used - 1))}
                >
                  −
                </button>
                <span>
                  {used} / {s.total}
                </span>
                <button
                  type="button"
                  disabled={used >= s.total}
                  onClick={() => update((st) => setSpellSlotUsed(st, s.spellLevel, used + 1))}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Free-text prepared-spell slots per level, plus a fixed "always available"
// section of spontaneous conversions (Spontaneous Healer's cure spells, the
// druid's SNA conversion) that never consume a preparation slot — casting
// one still spends a slot from that level's tracker, though, so it stays
// separate from the SpellSlotTracker above rather than replacing it.
function PreparedSpellsTracker({ spellSlots }) {
  const { state, update } = useLiveState()
  const levels = [
    { level: 0, count: spellSlots.orisons.prepared },
    ...spellSlots.slots.filter((s) => s.total > 0).map((s) => ({ level: s.spellLevel, count: s.total })),
  ]

  return (
    <div className="tracker-block">
      <Collapsible title="Prepared Spells" defaultExpanded={false}>
        {spontaneousConversions.alwaysAvailable?.length > 0 && (
          <div className="always-available-block">
            <div className="spontaneous-conversions">
              <span className="spontaneous-label">Always available</span>
              <ul>
                {spontaneousConversions.alwaysAvailable.map((a) => (
                  <li key={a.name}>{a.name}</li>
                ))}
              </ul>
            </div>
            {spontaneousConversions.alwaysAvailable.map(
              (a) => a.note && (
                <p className="note" key={a.name}>
                  {a.name} — {a.note}
                </p>
              ),
            )}
          </div>
        )}
        {levels.map(({ level, count }) => (
          <div className="prepared-level" key={level}>
            <span className="prepared-level-label">{SPELL_LEVEL_LABELS[level]}</span>
            <div className="prepared-slots">
              {Array.from({ length: count }, (_, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Slot ${i + 1}`}
                  value={state.preparedSpells[level]?.[i] ?? ''}
                  onChange={(e) => update((s) => setPreparedSpell(s, level, i, e.target.value))}
                />
              ))}
            </div>
            {spontaneousConversions.byLevel[level] && (
              <div className="spontaneous-conversions">
                <span className="spontaneous-label">Always available</span>
                <ul>
                  {spontaneousConversions.byLevel[level].map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </Collapsible>
    </div>
  )
}

function WildShapeTracker({ max }) {
  const { state, update } = useLiveState()
  const used = state.wildShapeUsed

  return (
    <div className="tracker-block">
      <h3>Wild Shape</h3>
      <div className="stepper">
        <button type="button" disabled={used <= 0} onClick={() => update((s) => setWildShapeUsed(s, used - 1))}>
          −
        </button>
        <span>
          {used} / {max} used
        </span>
        <button type="button" disabled={used >= max} onClick={() => update((s) => setWildShapeUsed(s, used + 1))}>
          +
        </button>
      </div>
    </div>
  )
}

function DailyUsesTracker({ dailyAbilities }) {
  const { state, update } = useLiveState()

  return (
    <div className="tracker-block">
      <h3>Daily Abilities</h3>
      <ul className="daily-uses-list">
        {dailyAbilities.map((a) => {
          const used = state.dailyUses[a.id] ?? 0
          if (a.usesPerDay === 1) {
            return (
              <li key={a.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={used >= 1}
                    onChange={(e) => update((s) => setDailyUse(s, a.id, e.target.checked ? 1 : 0))}
                  />
                  {a.label} <span className="note">({a.source})</span>
                </label>
              </li>
            )
          }
          return (
            <li key={a.id} className="daily-use-counted">
              <span>
                {a.label} <span className="note">({a.source})</span>
              </span>
              <div className="stepper">
                <button
                  type="button"
                  disabled={used <= 0}
                  onClick={() => update((s) => setDailyUse(s, a.id, used - 1))}
                >
                  −
                </button>
                <span>
                  {used} / {a.usesPerDay}
                </span>
                <button
                  type="button"
                  disabled={used >= a.usesPerDay}
                  onClick={() => update((s) => setDailyUse(s, a.id, used + 1))}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const SYNC_STATUS_LABELS = {
  loading: 'Loading…',
  synced: 'Synced to Supabase',
  offline: 'Local only',
  error: 'Save failed — kept locally',
}

function SyncBar() {
  const { syncStatus, isSupabaseConfigured, state, replaceAll, longRest } = useLiveState()
  const fileInputRef = useRef(null)

  const label =
    syncStatus === 'offline' && !isSupabaseConfigured
      ? 'Local only (Supabase not configured)'
      : (SYNC_STATUS_LABELS[syncStatus] ?? syncStatus)

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lyra-state-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        replaceAll(JSON.parse(reader.result))
      } catch {
        window.alert('That file is not valid JSON.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="sync-bar">
      <span className={`sync-status sync-status-${syncStatus}`}>{label}</span>
      <div className="sync-actions">
        <button type="button" onClick={handleExport}>
          Export
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="long-rest-button"
          onClick={() => {
            if (
              window.confirm(
                'Long Rest: reset HP, spell slots, prepared spells, wild shape uses, and all daily abilities?',
              )
            ) {
              longRest()
            }
          }}
        >
          Long Rest
        </button>
      </div>
    </div>
  )
}

export default function TrackersPanel({ sheet, dailyAbilities, onLevelUp }) {
  return (
    <section className="card trackers-card">
      <h2>Trackers</h2>
      <SyncBar />
      <XpTracker sheet={sheet} onLevelUp={onLevelUp} />
      <HpTracker hpMax={sheet.character.hp.max} />
      <SpellSlotTracker spellSlots={sheet.spellSlots} />
      <PreparedSpellsTracker spellSlots={sheet.spellSlots} />
      <WildShapeTracker max={sheet.character.wildShape.usesPerDay} />
      <DailyUsesTracker dailyAbilities={dailyAbilities} />
    </section>
  )
}
