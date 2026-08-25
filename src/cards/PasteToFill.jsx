import { useState } from 'react'
import { parsePastedSpell, splitMultipleSpells } from './pasteParser'

// Prefers the druid level when a spell lists several classes — the app's
// own data is druid-only, so that's the most likely card being made — but
// leaves it fully overridable via the radio group below.
function pickLevel(levels) {
  if (!levels.length) return null
  return levels.find((l) => /^drd$/i.test(l.class)) || levels[0]
}

function resultToMech(result, chosenLevel) {
  return {
    level: chosenLevel ? chosenLevel.level : null,
    school: result.school || '',
    subschool: result.subschool,
    descriptors: result.descriptors,
    castingTime: result.castingTime,
    range: result.range,
    components: result.components,
    duration: result.duration,
    savingThrow: result.savingThrow || null,
    spellResistance: result.spellResistance || null,
  }
}

function resultToCardPatch(result) {
  return { flavor: result.flavor, primary: result.primary, note: result.note }
}

const TAE_LABEL = { target: 'Target', area: 'Area', effect: 'Effect' }

// A textarea for a spell's raw pasted text (stat block + description),
// parsed offline with no API calls — see src/cards/pasteParser.js. Finds
// the matching spell in data/spells/ by the parsed name and fills the
// currently-relevant card via onFillSingle; a paste of several spells
// (detected by more than one "Level:" line) instead adds one queue entry
// per spell it can match, via onBulkAdd. Both callbacks return
// { ok, reason? } so this component can report what happened without
// knowing anything about how spells are looked up or saved.
export default function PasteToFill({ onFillSingle, onBulkAdd }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [chosenLevel, setChosenLevel] = useState(null)
  const [bulkSummary, setBulkSummary] = useState(null)
  const [fillWarning, setFillWarning] = useState(null)

  function handleParse() {
    setFillWarning(null)
    const blocks = splitMultipleSpells(text)

    if (blocks.length > 1) {
      setResult(null)
      const added = []
      const skipped = []
      for (const block of blocks) {
        const r = parsePastedSpell(block)
        if (!r.name) {
          skipped.push({ name: '(unnamed)', reason: 'no name found' })
          continue
        }
        const outcome = onBulkAdd(r.name, resultToMech(r, pickLevel(r.levels)), resultToCardPatch(r))
        if (outcome?.ok) added.push(r.name)
        else skipped.push({ name: r.name, reason: outcome?.reason || 'not found in data/spells/' })
      }
      setBulkSummary({ added, skipped })
      return
    }

    setBulkSummary(null)
    const r = parsePastedSpell(text)
    setResult(r)
    setChosenLevel(pickLevel(r.levels))
  }

  function handleFill() {
    const outcome = onFillSingle(result.name, resultToMech(result, chosenLevel), resultToCardPatch(result))
    setFillWarning(outcome?.ok ? null : outcome?.reason || `Could not find "${result.name}" in data/spells/.`)
  }

  return (
    <div className="panel">
      <h2>Paste to Fill</h2>
      <textarea
        className="field-textarea paste-textarea"
        placeholder="Paste a full spell — stat block and description — from a PDF…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="btn-row">
        <button type="button" className="btn" onClick={handleParse} disabled={!text.trim()}>
          Parse
        </button>
      </div>

      {bulkSummary && (
        <div className="paste-results">
          <p className="paste-results-summary">
            {bulkSummary.added.length} spell{bulkSummary.added.length === 1 ? '' : 's'} added to the print queue
            {bulkSummary.skipped.length ? `, ${bulkSummary.skipped.length} skipped` : ''}.
          </p>
          {bulkSummary.added.length > 0 && <p className="paste-results-list ok">Added: {bulkSummary.added.join(', ')}</p>}
          {bulkSummary.skipped.length > 0 && (
            <p className="paste-results-list err">
              Skipped: {bulkSummary.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="paste-results">
          <p className="paste-results-summary">Parsed &ldquo;{result.name || '(no name found)'}&rdquo;</p>
          {result.missing.length > 0 && <p className="paste-results-list err">Could not find: {result.missing.join(', ')}</p>}
          {result.targetAreaEffect && (
            <p className="paste-results-list">
              {TAE_LABEL[result.targetAreaEffect.type]}: {result.targetAreaEffect.value}
              <span className="field-hint">not a card field — for reference while writing Primary</span>
            </p>
          )}
          {result.levels.length > 1 && (
            <div className="level-picker">
              <span className="field-label">Level applies to</span>
              {result.levels.map((l, i) => (
                <label key={i} className="level-picker-option">
                  <input type="radio" name="paste-level" checked={chosenLevel === l} onChange={() => setChosenLevel(l)} />
                  {l.class} {l.level}
                </label>
              ))}
            </div>
          )}
          {fillWarning && <p className="save-status err">{fillWarning}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={handleFill}>
              Fill This Card
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
