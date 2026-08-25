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

export default function CardEditor({ mechFields, draft, onChange, onSave, onAddToQueue, saveStatus }) {
  const continueOn = !!draft.continued

  function toggleContinue() {
    onChange({
      ...draft,
      continued: continueOn ? null : { flavor: '', primary: '', secondary: '', note: '', table: null },
    })
  }

  const hasStSr = !!(mechFields.savingThrow || mechFields.spellResistance)

  return (
    <div className="panel">
      <h2>{mechFields.name}</h2>
      <dl className="mech-grid">
        <div>
          <dt>Level</dt>
          <dd>{mechFields.level}</dd>
        </div>
        <div>
          <dt>School</dt>
          <dd>
            {mechFields.school || '—'}
            {mechFields.subschool ? ` (${mechFields.subschool})` : ''}
          </dd>
        </div>
        {mechFields.descriptors.length > 0 && (
          <div className="full">
            <dt>Descriptors</dt>
            <dd>{mechFields.descriptors.join(', ')}</dd>
          </div>
        )}
        <div>
          <dt>Casting Time</dt>
          <dd>{mechFields.castingTime || '—'}</dd>
        </div>
        <div>
          <dt>Range</dt>
          <dd>{mechFields.range || '—'}</dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>{mechFields.components || '—'}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{mechFields.duration || '—'}</dd>
        </div>
        {hasStSr && (
          <>
            <div>
              <dt>Save</dt>
              <dd>{mechFields.savingThrow || '—'}</dd>
            </div>
            <div>
              <dt>SR</dt>
              <dd>{mechFields.spellResistance || '—'}</dd>
            </div>
          </>
        )}
      </dl>

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
