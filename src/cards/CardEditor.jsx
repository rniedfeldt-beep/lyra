import TableBuilder from './TableBuilder'

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
        Primary <span className="field-hint">core effect</span>
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
        Secondary <span className="field-hint">qualifiers</span>
      </label>
      <textarea
        id={`${idPrefix}-secondary`}
        className="field-textarea"
        value={v.secondary || ''}
        onChange={(e) => set('secondary', e.target.value)}
      />

      <label className="field-label" htmlFor={`${idPrefix}-note`}>
        Note <span className="field-hint">material component, focus, XP cost</span>
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

// The card's own mechanical fields — pre-filled from the spell's real
// data/spells/ entry (canonicalMechFields) but editable here, not read-only:
// paste-to-fill can set a different class's level (Lyra's data only tracks
// a druid level; a card made for a sorcerer needs its own), and a value the
// parser got slightly wrong is meant to be fixed by hand. Edits never touch
// the spell's own JSON fields — they're stored as a card.mech override (see
// buildCardToSave in cardRender.js), only when they actually differ from
// the canonical values.
function MechFields({ mech, onChange }) {
  const set = (field, val) => onChange({ ...mech, [field]: val })
  return (
    <div className="mech-grid">
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
      <div>
        <label className="field-label" htmlFor="mech-components">
          Components
        </label>
        <input
          id="mech-components"
          className="field-input"
          value={mech.components || ''}
          onChange={(e) => set('components', e.target.value)}
        />
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

export default function CardEditor({ mechFields, mechDraft, onMechChange, draft, onChange, onSave, onAddToQueue, saveStatus }) {
  const continueOn = !!draft.continued

  function toggleContinue() {
    onChange({
      ...draft,
      continued: continueOn ? null : { flavor: '', primary: '', secondary: '', note: '', table: null },
    })
  }

  return (
    <div className="panel">
      <h2>{mechFields.name}</h2>
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
