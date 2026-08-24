import { useMemo, useState } from 'react'
import {
  spellGroups,
  spellFileCounts,
  spellFileIssueBreakdown,
  sourceBooks,
  resolveFunctionsAs,
} from '../../lib/spellReferenceData'
import { normalizeSourceKey, groupedSourceLabel } from '../../lib/calc/spellReference'
import { SPELL_LEVEL_LABELS } from '../../lib/format'
import ErrorBoundary from '../ErrorBoundary'
import './spellReference.css'

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

// "at will" reads better title-cased in a compact badge; other usages
// ("1/day", "3/day", etc.) are already fine as printed.
function formatUsage(usage) {
  if (!usage) return usage
  return usage.toLowerCase() === 'at will' ? 'At Will' : usage
}

// Defaults collapsed — a diagnostic aid for spotting a truncated or
// malformed sourcebook extraction, not something read on every visit.
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

// A grouped title (e.g. "Dragon Magazine") stands in for however many
// distinct issues its file actually contains — expandable, defaulting to
// collapsed, so the per-issue counts are available without cluttering the
// list by default. A title with no breakdown renders as the plain leaf row
// it always has.
function SourcebookRow({ title, count, breakdown }) {
  const [expanded, setExpanded] = useState(false)
  if (!breakdown) {
    return (
      <li>
        <span className="spell-load-report-title">{title}</span>
        <span className="spell-load-report-count">{count}</span>
      </li>
    )
  }
  const issues = Object.keys(breakdown).sort()
  return (
    <li className="spell-load-report-group">
      <button type="button" className="spell-load-report-row-toggle" onClick={() => setExpanded((e) => !e)}>
        <span className="spell-load-report-row-toggle-label">
          <span className={`chevron${expanded ? '' : ' collapsed'}`}>▾</span>
          <span className="spell-load-report-title">{title}</span>
        </span>
        <span className="spell-load-report-count">{count}</span>
      </button>
      {expanded && (
        <ul className="spell-load-report-sublist">
          {issues.map((issue) => (
            <li key={issue}>
              <span className="spell-load-report-title">{issue}</span>
              <span className="spell-load-report-count">{breakdown[issue]}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function LoadReport() {
  const bookTitles = Object.keys(spellFileCounts).sort()
  return (
    <div className="spell-load-report">
      <p className="breakdown">Spell count: {spellGroups.length}</p>
      <Collapsible title="Sourcebooks" defaultExpanded={false}>
        <ul className="spell-load-report-list">
          {bookTitles.map((title) => (
            <SourcebookRow
              key={title}
              title={title}
              count={spellFileCounts[title]}
              breakdown={spellFileIssueBreakdown[title]}
            />
          ))}
        </ul>
      </Collapsible>
    </div>
  )
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

function PrintingBlock({ printing }) {
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

// The level results are grouped/sorted by. A specific numeric level filter
// pins every result to that level (they all share it, by construction of
// the filter); browsing "All" or "Sp" both fall back to each spell's lowest
// printed level, so a spell whose printings disagree still lands in one
// sensible place, and a dual spell/spell-like entry like Intensify Manifest
// Zone still groups under its real level (7th) rather than getting pulled
// into a generic spell-like bucket.
function sortLevelFor(group, levelFilter) {
  if (typeof levelFilter === 'number') return levelFilter
  return group.levels.length ? Math.min(...group.levels) : null
}

// isPureSpellLike: true only for a group with no numeric level anywhere
// (like Detect Manifest Zone) — a dual entry with a real level (Intensify
// Manifest Zone) still gets its normal "Nth Level" header, since the Sp
// badge on its printing already communicates the spell-like half.
function levelHeaderLabel(level, isPureSpellLike) {
  if (level == null) return isPureSpellLike ? 'Spell-Like Ability' : 'Level Unknown'
  if (level === 0) return 'Orisons'
  return `${SPELL_LEVEL_LABELS[level]} Level`
}

function SpellCard({ group, levelHeader }) {
  return (
    <>
      {levelHeader && <h4 className="spell-level-header">{levelHeader}</h4>}
      <div className="spell-card">
        <div className="spell-card-header">
          <h3>{group.name}</h3>
          {group.levelsDisagree && (
            <span className="spell-level-disagree-badge">Levels differ across printings</span>
          )}
        </div>
        {group.printings.map((p) => (
          <PrintingBlock key={p.source} printing={p} />
        ))}
      </div>
    </>
  )
}

export default function SpellReferenceTab() {
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sourceKey = sourceFilter === 'all' ? null : normalizeSourceKey(sourceFilter)
    const matches = spellGroups.filter((g) => {
      if (q && !g.name.toLowerCase().includes(q)) return false
      if (levelFilter === 'sp' && !g.hasSpellLike) return false
      if (typeof levelFilter === 'number' && !g.levels.includes(levelFilter)) return false
      if (sourceKey && !g.printings.some((p) => normalizeSourceKey(groupedSourceLabel(p.source)) === sourceKey))
        return false
      return true
    })
    return matches.sort((a, b) => {
      const aLevel = sortLevelFor(a, levelFilter) ?? Infinity
      const bLevel = sortLevelFor(b, levelFilter) ?? Infinity
      if (aLevel !== bLevel) return aLevel - bLevel
      return a.name.localeCompare(b.name)
    })
  }, [search, levelFilter, sourceFilter])

  return (
    <div className="spell-reference">
      <LoadReport />

      <div className="spell-filters">
        <input
          type="text"
          className="spell-search"
          placeholder="Search spell name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="spell-level-filter">
          <button
            type="button"
            className={levelFilter === 'all' ? 'active' : ''}
            onClick={() => setLevelFilter('all')}
          >
            All
          </button>
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              className={levelFilter === l ? 'active' : ''}
              onClick={() => setLevelFilter(l)}
            >
              {SPELL_LEVEL_LABELS[l]}
            </button>
          ))}
          <button
            type="button"
            className={levelFilter === 'sp' ? 'active' : ''}
            onClick={() => setLevelFilter('sp')}
          >
            Sp
          </button>
        </div>
        <select
          className="spell-source-filter"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="all">All sources</option>
          {sourceBooks.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <p className="spell-results-count">
        {filtered.length} of {spellGroups.length} spells
      </p>

      {filtered.length === 0 ? (
        <p className="breakdown">No spells match.</p>
      ) : (
        <div className="spell-results-list">
          {filtered.map((g, i) => {
            const level = sortLevelFor(g, levelFilter)
            const prevLevel = i > 0 ? sortLevelFor(filtered[i - 1], levelFilter) : undefined
            const isPureSpellLike = g.hasSpellLike && g.levels.length === 0
            return (
              <ErrorBoundary key={g.name} label={`"${g.name}"`}>
                <SpellCard
                  group={g}
                  levelHeader={level !== prevLevel ? levelHeaderLabel(level, isPureSpellLike) : null}
                />
              </ErrorBoundary>
            )
          })}
        </div>
      )}
    </div>
  )
}
