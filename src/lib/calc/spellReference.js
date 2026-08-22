// Merges spell entries loaded per-sourcebook into one collection, one group
// per spell name — multiple sourcebooks printing the same spell become a
// single group with several "printings" rather than duplicate rows. Every
// sourcebook that reprints a spell got its own fully-extracted entry (own
// description, own mechanical fields), so printings are built from those
// full entries directly; otherPrintings references are only used to fill
// in a printing that has no full entry anywhere in the loaded set (e.g. a
// sourcebook not yet processed), or a citation that's missing entirely.

// A source name can be spelled slightly differently between a book's own
// "source" field and how another book's otherPrintings cites it (e.g. "The
// Quintessential Druid II" vs "Quintessential Druid II") — normalize only
// for matching/deduping; every printing still displays its own literal text.
export function normalizeSourceKey(source) {
  return (source ?? '').trim().toLowerCase().replace(/^the\s+/, '')
}

// Dragon Magazine is cited per-issue ("Dragon Magazine #309", with the
// originating article in its own "article" field — see PrintingBlock) since
// that's the real citation for each entry — but there are enough separate
// issues in the library that listing every one as its own filter option
// swamps the dropdown. This collapses any Dragon Magazine issue to one
// shared label for grouping/filtering only; individual spell printings
// still display their own full, issue-specific citation untouched. Dungeon
// Magazine #100 (Dire Reincarnation, a web enhancement bundled into the
// same extraction) groups under the same label — it's one entry, not a
// separate magazine worth its own filter option.
export function groupedSourceLabel(source) {
  if (!source) return source
  return /^(Dragon|Dungeon) Magazine #\d+/.test(source) ? 'Dragon Magazine' : source
}

function buildSpellGroup(name, entries) {
  const printingsByKey = new Map()

  function addPrinting({ source, page, spellLevelDruid, note, full }) {
    if (!source) return
    const key = normalizeSourceKey(source)
    const existing = printingsByKey.get(key)
    // A full extracted entry always wins over a stub built from someone
    // else's otherPrintings citation — more detail, and the authoritative
    // level for that book.
    if (existing?.full && !full) return
    printingsByKey.set(key, {
      source,
      page: page ?? null,
      spellLevelDruid: spellLevelDruid ?? null,
      note: note ?? null,
      full: full ?? null,
      // A class-granted spell-like ability (abilityType: "spell-like") can
      // coexist with a real spellLevelDruid on the same printing — the two
      // aren't mutually exclusive (e.g. Intensify Manifest Zone is both a
      // 7th-level druid spell and a 1/day spell-like ability). Stub
      // printings built only from an otherPrintings citation never carry
      // this — only a full entry says how its own book treats it.
      abilityType: full?.abilityType ?? 'spell',
      usage: full?.usage ?? null,
    })
  }

  for (const entry of entries) {
    addPrinting({
      source: entry.source,
      page: entry.page,
      spellLevelDruid: entry.spellLevelDruid,
      full: entry,
    })
    for (const op of entry.otherPrintings ?? []) {
      // An otherPrintings citation that omits spellLevelDruid means "same
      // level as the entry that references it" (CLAUDE.md convention) —
      // only a present value signals the books disagree.
      const impliedLevel = op.spellLevelDruid ?? entry.spellLevelDruid
      addPrinting({ source: op.source, page: op.page, spellLevelDruid: impliedLevel, note: op.note })
    }
  }

  const printings = Array.from(printingsByKey.values()).sort((a, b) => {
    const aLevel = a.spellLevelDruid ?? Infinity
    const bLevel = b.spellLevelDruid ?? Infinity
    if (aLevel !== bLevel) return aLevel - bLevel
    return a.source.localeCompare(b.source)
  })

  const levels = [...new Set(printings.map((p) => p.spellLevelDruid).filter((l) => l != null))].sort(
    (a, b) => a - b,
  )
  const hasSpellLike = printings.some((p) => p.abilityType === 'spell-like')

  return {
    name,
    printings,
    levels,
    levelsDisagree: levels.length > 1,
    hasSpellLike,
  }
}

export function mergeSpellEntries(rawEntries) {
  const groups = new Map()
  for (const entry of rawEntries) {
    const name = entry?.name?.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!groups.has(key)) groups.set(key, { name, entries: [] })
    groups.get(key).entries.push(entry)
  }

  return Array.from(groups.values())
    .map(({ name, entries }) => buildSpellGroup(name, entries))
    .sort((a, b) => a.name.localeCompare(b.name))
}
