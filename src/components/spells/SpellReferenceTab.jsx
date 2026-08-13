import { useMemo, useState } from 'react'
import { spellGroups, spellFileCounts, totalRawSpellCount, sourceBooks } from '../../lib/spellReferenceData'
import { normalizeSourceKey } from '../../lib/calc/spellReference'
import { SPELL_LEVEL_LABELS } from '../../lib/format'
import './spellReference.css'

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

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

function LoadReport() {
  const fileNames = Object.keys(spellFileCounts).sort()
  return (
    <div className="spell-load-report">
      <p className="breakdown">
        {totalRawSpellCount} spell entries loaded from {fileNames.length} files — {spellGroups.length} unique
        spell names after merging reprints.
      </p>
      <Collapsible title="Per-file breakdown" defaultExpanded={false}>
        <ul className="spell-load-report-list">
          {fileNames.map((f) => (
            <li key={f}>
              <span>{f}</span>
              <span>{spellFileCounts[f]}</span>
            </li>
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

function PrintingBlock({ printing }) {
  const { source, page, spellLevelDruid, note, full } = printing
  const levelLabel = spellLevelDruid != null ? SPELL_LEVEL_LABELS[spellLevelDruid] : '—'

  return (
    <div className="spell-printing">
      <div className="spell-printing-header">
        <span className="spell-printing-level">Lv {levelLabel}</span>
        <span className="spell-printing-source">
          {source}
          {page != null ? `, p. ${page}` : ''}
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
        </>
      ) : (
        <p className="note">Details not yet extracted for this printing.</p>
      )}
    </div>
  )
}

// The level results are grouped/sorted by. A specific level filter pins
// every result to that level (they all share it, by construction of the
// filter); browsing "All" falls back to each spell's lowest printed level,
// so a spell whose printings disagree still lands in one sensible place.
function sortLevelFor(group, levelFilter) {
  if (levelFilter !== 'all') return levelFilter
  return group.levels.length ? Math.min(...group.levels) : null
}

function levelHeaderLabel(level) {
  if (level == null) return 'Level Unknown'
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
      if (levelFilter !== 'all' && !g.levels.includes(levelFilter)) return false
      if (sourceKey && !g.printings.some((p) => normalizeSourceKey(p.source) === sourceKey)) return false
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
            return (
              <SpellCard
                key={g.name}
                group={g}
                levelHeader={level !== prevLevel ? levelHeaderLabel(level) : null}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
