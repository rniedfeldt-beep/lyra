// Merges every JSON file in a /data subfolder into one collection keyed by id.
// Adding a new creature/feat/item/etc. means adding a JSON file here — never
// touching this loader or any component.
function mergeFolder(modules) {
  const collection = {}
  for (const path in modules) {
    const data = modules[path]
    if (!data.id) {
      throw new Error(`Data file ${path} is missing a required "id" field`)
    }
    collection[data.id] = data
  }
  return collection
}

const featModules = import.meta.glob('../data/feats/*.json', { eager: true })
const itemModules = import.meta.glob('../data/items/*.json', { eager: true })

export const feats = mergeFolder(featModules)
export const items = mergeFolder(itemModules)

export function getFeats(ids) {
  return ids.map((id) => {
    const feat = feats[id]
    if (!feat) throw new Error(`Unknown feat id "${id}"`)
    return feat
  })
}

export function getItem(id) {
  if (!id) return null
  const item = items[id]
  if (!item) throw new Error(`Unknown item id "${id}"`)
  return item
}

export { default as lyra } from '../data/character/lyra.json'
export { default as progressionTable } from '../data/tables/progression.json'
export { default as spellSlotsBaseTable } from '../data/tables/spellSlotsBase.json'
