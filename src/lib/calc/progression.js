import { druidLevel, goodSaveForLevel, poorSaveForLevel, threeQuarterBabForLevel } from '../rules/dnd35'
import { classLevelsBreakdown } from './leveling'

// PHB p.59: a multiclass character's BAB and base saves are the *sum* of
// each class's own contribution, each computed from that class's own level
// — not a single lookup keyed by character level. Druid and Planar Shepherd
// happen to share an identical progression in this campaign (3/4 BAB, good
// Fort, good Will, poor Ref — CLAUDE.md > Class Progression), so summing
// classLevelsBreakdown's per-class levels through the shared formulas is
// all multiclassing requires here; a class with a different progression
// would just need its own formula plugged into the reduce below.
export function computeProgression(characterLevel) {
  const classes = classLevelsBreakdown(characterLevel, druidLevel)
  return classes.reduce(
    (totals, cls) => ({
      bab: totals.bab + threeQuarterBabForLevel(cls.levels),
      fort: totals.fort + goodSaveForLevel(cls.levels),
      ref: totals.ref + poorSaveForLevel(cls.levels),
      will: totals.will + goodSaveForLevel(cls.levels),
    }),
    { bab: 0, fort: 0, ref: 0, will: 0 },
  )
}

// Standard iterative-attack rule: one extra attack at -5 for every full 5
// points of base attack bonus, granted only once BAB reaches +6/+11/+16.
export function computeIterativeAttackBonuses(bab) {
  const attacks = [bab]
  if (bab >= 6) attacks.push(bab - 5)
  if (bab >= 11) attacks.push(bab - 10)
  if (bab >= 16) attacks.push(bab - 15)
  return attacks
}
