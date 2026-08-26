import TableBuilder from './TableBuilder'

// The standard 3.5e component letters, plus XP (a spell with an XP cost —
// e.g. Reincarnate — cites it right alongside V/S/M on the stat line).
// M/DF is its own token, not M and DF toggled together — a caster's-choice
// symbol distinct from requiring both.
const COMPONENT_OPTIONS = ['V', 'S', 'M', 'DF', 'F', 'M/DF', 'XP']

function ComponentsField({ value, onChange }) {
  const selected = (value || '').split(/\s+/).filter(Boolean)
  function toggle(opt) {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
    onChange(COMPONENT_OPTIONS.filter((o) => next.includes(o)).join(' '))
  }
  return (
    <div className="component-toggles">
      {COMPONENT_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`component-toggle${selected.includes(opt) ? ' active' : ''}`}
          onClick={() => toggle(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// One set of description fields — used for the primary card and, when
// "continue on second card" is on, again for the continued block. Field
// order matches render order on the card: flavor, primary, table, secondary,
// note.
function DescriptionFields({ value, onChange, idPrefix }) {
  const v = value || {}
  const set = (field, val) => onChange({ ...v, [field]: val })

  return (
    <>
      <label className="field-label" htmlFor={`${idPrefix}-flavor`}>
        Flavor <span className="field-hint">evocative line, renders italic</span>
      </label>
      <textarea
        id={`${idPrefix}-flavor`}
        className="field-textarea"
        value={v.flavor || ''}
        onChange={(e) => set('flavor', e.target.value)}
      />

      <label className="field-label" htmlFor={`${idPrefix}-primary`}>
        Main description
      </label>
      <textarea
        id={`${idPrefix}-primary`}
        className="field-textarea"
        value={v.primary || ''}
        onChange={(e) => set('primary', e.target.value)}
      />

      <label className="field-label">
        Table <span className="field-hint">optional</span>
      </label>
      <TableBuilder table={v.table || null} onChange={(table) => set('table', table)} />

      <label className="field-label" htmlFor={`${idPrefix}-secondary`}>
        Mechanics
      </label>
      <textarea
        id={`${idPrefix}-secondary`}
        className="field-textarea"
        value={v.secondary || ''}
        onChange={(e) => set('secondary', e.target.value)}
      />
      <p className="field-note">
        Bold is for die rolls and calculations — damage, healing, DCs — not general emphasis.
      </p>

      <label className="field-label" htmlFor={`${idPrefix}-note`}>
        Material Component/Focus
      </label>
      <textarea
        id={`${idPrefix}-note`}
        className="field-textarea"
        value={v.note || ''}
        onChange={(e) => set('note', e.target.value)}
      />
    </>
  )
}

// The card's own mechanical fields — pre-filled from data/spells/
// (canonicalMechFields) when the spell's there, or from a previously-saved
// Supabase card, or blank, but always editable: paste-to-fill can set a
// different class's level (Lyra's data only tracks a druid level; a card
// made for a sorcerer needs its own), and a value the parser got slightly
// wrong is meant to be fixed by hand. Name is editable too, for the same
// reason — a card isn't required to match a data/spells/ entry at all.
// Edits never touch data/spells/ itself; they're saved as this card's own
// row in Supabase (CardsApp.jsx), independent of the JSON extraction.
function MechFields({ mech, onChange }) {
  const set = (field, val) => onChange({ ...mech, [field]: val })
  return (
    <div className="mech-grid">
      <div className="full">
        <label className="field-label" htmlFor="mech-name">
          Name
        </label>
        <input id="mech-name" className="field-input" value={mech.name || ''} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-level">
          Level
        </label>
        <input
          id="mech-level"
          className="field-input"
          type="number"
          value={mech.level ?? ''}
          onChange={(e) => set('level', e.target.value === '' ? null : Number(e.target.value))}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-school">
          School
        </label>
        <input id="mech-school" className="field-input" value={mech.school || ''} onChange={(e) => set('school', e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-subschool">
          Subschool
        </label>
        <input
          id="mech-subschool"
          className="field-input"
          value={mech.subschool || ''}
          onChange={(e) => set('subschool', e.target.value || null)}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-descriptors">
          Descriptors
        </label>
        <input
          id="mech-descriptors"
          className="field-input"
          value={(mech.descriptors || []).join(', ')}
          onChange={(e) =>
            set(
              'descriptors',
              e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            )
          }
        />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-castingTime">
          Casting Time
        </label>
        <input
          id="mech-castingTime"
          className="field-input"
          value={mech.castingTime || ''}
          onChange={(e) => set('castingTime', e.target.value)}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-range">
          Range
        </label>
        <input id="mech-range" className="field-input" value={mech.range || ''} onChange={(e) => set('range', e.target.value)} />
      </div>
      <div className="full">
        <label className="field-label">Components</label>
        <ComponentsField value={mech.components} onChange={(v) => set('components', v)} />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-duration">
          Duration
        </label>
        <input id="mech-duration" className="field-input" value={mech.duration || ''} onChange={(e) => set('duration', e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-save">
          Save
        </label>
        <input
          id="mech-save"
          className="field-input"
          value={mech.savingThrow || ''}
          onChange={(e) => set('savingThrow', e.target.value || null)}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="mech-sr">
          SR
        </label>
        <input
          id="mech-sr"
          className="field-input"
          value={mech.spellResistance || ''}
          onChange={(e) => set('spellResistance', e.target.value || null)}
        />
      </div>
    </div>
  )
}

export default function CardEditor({ mechDraft, onMechChange, draft, onChange, onSave, onAddToQueue, saveStatus }) {
  const continueOn = !!draft.continued

  function toggleContinue() {
    onChange({
      ...draft,
      continued: continueOn ? null : { flavor: '', primary: '', secondary: '', note: '', table: null },
    })
  }

  return (
    <div className="panel">
      <h2>{mechDraft.name || 'New card'}</h2>
      <MechFields mech={mechDraft} onChange={onMechChange} />

      <DescriptionFields value={draft} onChange={onChange} idPrefix="card" />

      <label className="toggle-row">
        <input type="checkbox" checked={continueOn} onChange={toggleContinue} />
        Continue on second card <span className="field-hint">prints as a two-card fold pair</span>
      </label>
      {continueOn && (
        <div className="continued-block">
          <DescriptionFields
            value={draft.continued}
            onChange={(next) => onChange({ ...draft, continued: next })}
            idPrefix="cont"
          />
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn btn-primary" onClick={onAddToQueue}>
          Add to Print Queue
        </button>
      </div>
      {saveStatus?.message && (
        <p className={`save-status ${saveStatus.type === 'ok' ? 'ok' : saveStatus.type === 'err' ? 'err' : ''}`}>
          {saveStatus.message}
        </p>
      )}
    </div>
  )
}
