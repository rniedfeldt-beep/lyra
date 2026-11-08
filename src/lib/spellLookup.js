// Lazy bridge to the spell data for the expandable spell references. The
// spell data is the biggest chunk in the app, so it's pulled in by dynamic
// import the first time anything asks, then cached; until it arrives callers
// render plain text, and upgrade to expandable once it's there.
let promise = null
let resolved = null

export function loadSpellLookup() {
  promise ??= import('./spellReferenceData').then((m) => {
    resolved = { known: m.knownSpellNames, find: m.findSpellByName }
    return resolved
  })
  return promise
}

export function getResolvedSpellLookup() {
  return resolved
}
