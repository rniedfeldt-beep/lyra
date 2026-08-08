// BAB and base saves are a pure function of character level, looked up from
// the blended progression table in /data/tables — never hardcoded per level.
export function getProgression(level, progressionTable) {
  const row = progressionTable.byLevel[String(level)]
  if (!row) throw new Error(`No progression entry for level ${level}`)
  return row
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
