import { useState } from 'react'
import { resolveFunctionsAs } from '../../lib/spellReferenceData'
import { SPELL_LEVEL_LABELS } from '../../lib/format'
import ErrorBoundary from '../ErrorBoundary'
import './spellReference.css'

// The per-printing spell display (stat facts, description, "Functions As"
// citations), shared by the Spell Reference tab and the Prepared Spells
// section on the Lyra tab so a spell reads identically in both places.

// "at will" reads better title-cased in a compact badge; other usages
// ("1/day", "3/day", etc.) are already fine as printed.
function formatUsage(usage) {
  if (!usage) return usage
  return usage.toLowerCase() === 'at will' ? 'At Will' : usage
}

const FACT_LABELS = {
  castingTime: 'Casting Time',
  range: 'Range',
  duration: 'Duration',
  savingThrow: 'Save',
  spellResistance: 'SR',
}

function targetLabel(targetAreaEffect) {
  if (!targetAreaEffect?.type) return 'Target/Area/Effect'
  const t = targetAreaEffect.type
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// A reference-only spell (data/spells/referenced-spells.json — see loadSpellData.js)
// isn't one of Lyra's druid spells, so it has no spellLevelDruid to badge; it shows
// the classes/levels it's actually available at instead, one small pill per entry
// since a spell like Antimagic Field lists four.
function ClassLevelBadges({ spellLevels }) {
  return (
    <span className="spell-printing-classlevels">
      {spellLevels.map((sl, i) => (
        <span key={i} className="spell-printing-classlevel-badge">
          {sl.class} {sl.level}
        </span>
      ))}
    </span>
  )
}

// One functionsAs citation ({ spellName, source, note }). A null source means a
// confirmed dead end (Animal Friendship — a 3.0 spell with no 3.5 stat block, per
// CLAUDE.md) — just the name and the note, nothing to expand. Otherwise the name is
// a toggle: tapping it resolves and renders the referenced spell's own printing
// inline, collapsed by default and visually nested (indented, left-bordered) so it
// reads as a citation rather than another top-level result.
function FunctionsAsEntry({ reference }) {
  const [expanded, setExpanded] = useState(false)
  if (reference.source == null) {
    return (
      <div className="functions-as-entry functions-as-deadend">
        <span className="functions-as-name">{reference.spellName}</span>
        {reference.note && <p className="note functions-as-note">{reference.note}</p>}
      </div>
    )
  }
  return (
    <div className="functions-as-entry">
      <button type="button" className="functions-as-toggle" onClick={() => setExpanded((e) => !e)}>
        <span className={`chevron${expanded ? '' : ' collapsed'}`}>▾</span>
        <span className="functions-as-name">{reference.spellName}</span>
      </button>
      {reference.note && <p className="note functions-as-note">{reference.note}</p>}
      {expanded && (
        <div className="functions-as-expansion">
          <ErrorBoundary label={`"${reference.spellName}"`}>
            <ResolvedFunctionsAs reference={reference} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}

function ResolvedFunctionsAs({ reference }) {
  const resolved = resolveFunctionsAs(reference)
  if (!resolved) return <p className="note">Referenced spell not available.</p>
  return <PrintingBlock printing={resolved} />
}

export function PrintingBlock({ printing }) {
  const { source, page, spellLevelDruid, note, full, abilityType, usage } = printing
  const isSpellLike = abilityType === 'spell-like'
  const classLevels = full?.referenceOnly ? full.spellLevels : null

  return (
    <div className="spell-printing">
      <div className="spell-printing-header">
        {classLevels?.length > 0 ? (
          <ClassLevelBadges spellLevels={classLevels} />
        ) : (
          <>
            {spellLevelDruid != null && (
              <span className="spell-printing-level">Lv {SPELL_LEVEL_LABELS[spellLevelDruid]}</span>
            )}
            {isSpellLike && (
              <span className="spell-printing-level spell-printing-splike">Sp — {formatUsage(usage)}</span>
            )}
            {spellLevelDruid == null && !isSpellLike && <span className="spell-printing-level">Lv —</span>}
          </>
        )}
        <span className="spell-printing-source">
          {source}
          {page != null ? `, p. ${page}` : ''}
          {full?.article ? ` (${full.article})` : ''}
        </span>
      </div>
      {note && <p className="note">{note}</p>}
      {full ? (
        <>
          <div className="spell-fact-row">
            <span>
              <strong>School</strong> {full.school ?? '—'}
              {full.subschool ? ` (${full.subschool})` : ''}
            </span>
            {full.descriptors?.length > 0 && (
              <span>
                <strong>Descriptors</strong> {full.descriptors.join(', ')}
              </span>
            )}
            <span>
              <strong>Components</strong> {full.components?.length ? full.components.join(', ') : '—'}
            </span>
            <span>
              <strong>{FACT_LABELS.castingTime}</strong> {full.castingTime ?? '—'}
            </span>
            <span>
              <strong>{FACT_LABELS.range}</strong> {full.range ?? '—'}
            </span>
            <span>
              <strong>{targetLabel(full.targetAreaEffect)}</strong> {full.targetAreaEffect?.value ?? '—'}
            </span>
            <span>
              <strong>{FACT_LABELS.duration}</strong> {full.duration ?? '—'}
            </span>
            <span>
              <strong>{FACT_LABELS.savingThrow}</strong> {full.savingThrow ?? '—'}
            </span>
            <span>
              <strong>{FACT_LABELS.spellResistance}</strong> {full.spellResistance ?? '—'}
            </span>
          </div>
          <p className="spell-description">{full.description}</p>
          {full.functionsAs?.length > 0 && (
            <div className="functions-as-list">
              <span className="functions-as-label">Functions As</span>
              {full.functionsAs.map((ref, i) => (
                <FunctionsAsEntry key={`${ref.spellName}-${i}`} reference={ref} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="note">Full stat block not available for this printing.</p>
      )}
    </div>
  )
}
