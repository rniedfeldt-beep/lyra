// Loads the offline-extracted creature data from the project-root /data
// folder (per CLAUDE.md's Directory Shape) — never a sourcebook PDF at
// runtime, only clean JSON produced ahead of time.
import monsterManual from '../../data/creatures/monster-manual.json'
import animalCompanion from '../../data/creatures/animal-companion.json'
import greenboundTemplate from '../../data/templates/greenbound.json'
import advancedTemplate from '../../data/templates/advanced.json'
import giantTemplate from '../../data/templates/giant.json'
import youngTemplate from '../../data/templates/young.json'
import anarchicTemplate from '../../data/templates/anarchic.json'

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
