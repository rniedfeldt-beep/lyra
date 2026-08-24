// Loads every extracted sourcebook creature file from the project-root
// /data/creatures folder (contrast the single monster-manual.json import
// this replaces) via import.meta.glob, the same pattern loadSpellData.js
// uses for data/spells/ — dropping in a new data/creatures/<book>.json
// file is picked up automatically, no loader edit required.
import animalCompanion from '../../data/creatures/animal-companion.json'
import greenboundTemplate from '../../data/templates/greenbound.json'
import advancedTemplate from '../../data/templates/advanced.json'
import giantTemplate from '../../data/templates/giant.json'
import youngTemplate from '../../data/templates/young.json'
import anarchicTemplate from '../../data/templates/anarchic.json'

const creatureModules = import.meta.glob('../../data/creatures/*.json', { eager: true })

// animal-companion.json is excluded from the merge below: Quen is Lyra's
// own companion, not a summonable or wild-shapeable creature, and the file
// holds a single object rather than a creature array.
const monsterManual = []
for (const path of Object.keys(creatureModules).sort()) {
  if (path.endsWith('/animal-companion.json')) continue
  const mod = creatureModules[path]
  const entries = Array.isArray(mod) ? mod : Array.isArray(mod?.default) ? mod.default : []
  monsterManual.push(...entries)
}

export { monsterManual, animalCompanion, greenboundTemplate, anarchicTemplate }

export const simpleTemplates = {
  advanced: advancedTemplate,
  giant: giantTemplate,
  young: youngTemplate,
}

export function getCreature(name) {
  const creature = monsterManual.find((c) => c.name === name)
  if (!creature) throw new Error(`Unknown creature "${name}"`)
  return creature
}
