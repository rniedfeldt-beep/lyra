# Lyra — D&D 3.5e Character Assistant

## What this project is

A mobile-first web app (React + Vite, JavaScript) that handles in-combat math for a single
D&D 3.5e character: Lyra, a half-elf Druid 5 / Planar Shepherd 3 with the Pathfinder Wolf
Shaman archetype. Campaign is Greyhawk. Optimized for iPhone and iPad use at the table.

The point of the app is speed. The player's bottleneck is recalculating attacks, damage,
saves, and AC when wild shaping into a new form or fielding summoned creatures with multiple
templates applied. Every number the app shows should be already-computed — no "add your Str
mod" instructions.

## Core architecture rules

1. **No stats in code.** All game data lives in JSON under `/data`. Code contains formulas
   only. Adding a creature or spell = adding a JSON entry, never editing a component.
2. **Never read PDFs at runtime.** Sourcebook extraction happens offline in Cowork and
   produces JSON. The app only ever consumes clean data.
3. **Every data entry carries a `source` field** (e.g. "MM 3.5", "Lost Empires of Faerûn",
   "Pathfinder", "5e", "DM homebrew") so non-3.5e material can be filtered or flagged.
4. **Feats and item properties are effect hooks, not display text.** Most of Lyra's feats and
   her primary weapon modify how other systems behave rather than adding flat bonuses. The
   calculation engine must read them. A weapon property must be able to *inject an extra
   attack* into the routine, not just add a number.
5. **Level is a variable, never a constant.** Track BOTH character level and class levels —
   they diverge (see Class Progression). Ability scores are also variable. Nothing derived
   should be hardcoded.
6. **Templates stack and must compose.** A summoned creature can carry a simple template plus
   Greenbound, with two feat effects layered on top. Build template application as a pipeline
   of composable transforms, not special-cased logic.

## Persistence and sync — DECIDED

**Supabase is the source of truth. Do not rely on localStorage alone.**

Reason: Safari deletes localStorage (and IndexedDB, SessionStorage, Service Worker
registrations) after 7 days without user interaction on the site. Home-screen web apps are
nominally exempt, but developers report resets happening anyway. Sessions run 3–4 weeks apart
and frequently end mid-combat, so state must survive long gaps.

### Schema

Table `character_state`, one row:

| Column | Type | Notes |
|---|---|---|
| `id` | int8 | primary key, identity, always 1 |
| `state` | jsonb | the entire live state blob |
| `updated_at` | timestamptz | default `now()` |

Save = overwrite `state` on row 1. Load = read and parse. New trackers need no schema change.

### Security

The anon key ships in the client bundle and GitHub Pages serves it publicly. RLS is enabled
with a **permissive policy** allowing anonymous select, insert, and update on
`character_state` only. Deliberate tradeoff: the data is a druid's hit points.

**Note:** RLS with no policies blocks everything, including the app itself. If saves silently
fail, check the policy exists before debugging anything else.

### Client design

- All state access goes through one storage adapter (`saveState()` / `loadState()`).
- localStorage as **offline fallback** — write locally on every change, sync when online.
- Manual JSON export/import button for backups.

Live state: current HP, temp HP, spell slots used, wild shape uses used, necklace spells used,
Fey Touched spells used, plane shift and planar bubble uses, active summons and remaining
duration, active wild shape form, Quen's current HP, and (Phase 9) `characterProgress` — see
"XP tracking and level-up" below.

## Directory shape

```
/data
  /creatures     one file per sourcebook (monster-manual.json, monster-manual-ii.json,
                 manual-of-the-planes.json, monsters-of-faerun.json, …), merged by
                 loadCreatureData.js; animal-companion.json (Quen) excluded from the merge
  /templates     greenbound, advanced, giant, young
  /spells
  /feats
  /items
/sourcebooks     PDFs (never read at runtime)
/cards           cards/index.html — second Vite entry point, see "Spell cards (/cards)"
```

### Feat reference data (Aug 2026)

`data/feats/<book-slug>.json`, one file per sourcebook, mirroring the `data/spells/` convention
— this is reference/bibliographic data, distinct from `src/data/feats/*.json`, which holds the
live calc-engine effect hooks for feats Lyra actually has or could take next (one file per
feat, keyed by id, read by the character sheet). The level-up feat picker (Phase 9) joins the
two by name — see "XP tracking and level-up" > Feats and class features below.

**Schema**, one entry per feat: `name`, `source`, `page` (`null` if genuinely uncitable — e.g. a
single-page excerpt with no page number printed), `type` (`"General"`, `"Item Creation"`,
`"Metamagic"`, `"Wild"`, etc. — taken from the book's own bracketed tag where printed),
`prerequisites` (structured: `abilityScores` array of `{ability, minimum}`, `baseAttackBonus`,
`skills` array of `{skill, ranks}`, `feats` array, `classFeatures` array, `casterLevel`, and a
free-text `other` array for anything that doesn't fit those buckets, e.g. "Ability to
spontaneously cast summon nature's ally"), `benefit` (paraphrased, not full printed text),
`repeatable` (bool — whether the feat can be taken multiple times), and an optional `note` for
extraction caveats or DM rulings. `grantedSpells` is an additional array (`{level, name,
source}`) on feats that grant spell access, currently only Gatekeeper Initiate.

14 feats extracted so far across 9 files: `eberron-campaign-setting.json` (Gatekeeper Initiate,
Ashbound), `quintessential-druid.json` (Sustain Wild Shape), `draconomicon.json` (Dragon Wild
Shape), `pathfinder-ultimate-combat.json` (Planar Wild Shape), `players-handbook.json` (Scribe
Scroll, Toughness, Natural Spell, Animal Affinity), `complete-divine.json` (Spontaneous Healer),
`lost-empires-of-faerun.json` (Greenbound Summoning), `5e-import.json` (Fey Touched, no page —
ported from 5e rather than any 3.5 sourcebook), and `players-guide-to-faerun.json` (Strong
Soul, Initiate of Nature — see below). `players-handbook-ii.json` also exists but is an empty
array: an earlier guess placed Strong Soul there, which turned out to be wrong (see below); the
file can't be deleted once written, so it's left empty rather than populated with anything real.

**Initiate of Nature** (Player's Guide to Faerûn, `page: null` — same OCR-only limitation as
Strong Soul below) grants rebuke/command of animals and plant creatures (3 + Cha modifier
times/day) plus five bonus cleric/druid spells: 3rd Mold Touch, 4th Briartangle and Thorn
Spray, 5th Fireward and Tree Healing. Only Fireward is currently in the spell library
(`players-guide-to-faerun.json` and `spell-compendium.json`, both Drd 5, matching the level
granted here) — Mold Touch, Briartangle, Thorn Spray, and Tree Healing aren't extracted
anywhere yet and would need their own pass before this feat is fully usable in the app.

**Gatekeeper Initiate's granted spells.** The feat grants 9 spells "as if on the druid spell
list" at levels 1–9 (verified against the physical page, not the PDF's own page-label metadata,
which was off by several pages here — the feat is actually on printed page 54, not 45). Three
(zone of natural purity, nature's wrath, return to nature) are the book's own new Gatekeeper
spells, already in `eberron-campaign-setting.json`. The other six (protection from evil,
dimensional anchor, banishment, dimensional lock, mind blank, imprisonment) are standard PHB
spells not normally on the druid list at all — these were newly extracted into
`players-handbook.json` with `spellLevelDruid: null` (accurate for a generic druid) and a note
on each explaining it's only druid-castable through this feat, at the level the feat specifies.

**Spontaneous Healer — resolved, no app change needed.** The printed benefit really is a
limited-uses-per-day spontaneous cast (Wis modifier times/day), not the unlimited
substitute-any-prepared-spell reading elsewhere in this file and in
`src/data/feats/spontaneous_healer.json`. Rae confirmed this is fine as-is: Lyra's Wisdom
modifier is high and rising, so the daily cap isn't a practical constraint, and the DM has
ruled that cure minor wounds (the orison) doesn't draw against the limit at all.

**Strong Soul — source corrected.** Not a Player's Handbook II feat as `src/data/feats/
strong_soul.json`'s "PHB" source and this project's own earlier guess both assumed. Rae
confirmed it's a **Player's Guide to Faerûn regional feat**, gifted to the whole party as a
1st-level bonus feat, and supplied the printed text directly (that book's PDF has no real text
layer — CHOCR/OCR only, per the note already on its spell file — and the character-level OCR
markup made a targeted page search impractical, so `data/feats/players-guide-to-faerun.json`
carries `page: null`). Prerequisite is a race/region combination; Lyra qualifies as a half-elf
of Dambrath, the Dalelands, or Silverymoon. Benefit is +1 Fort/Will normally, rising to +3
specifically against death effects, energy drain, and ability drain (not modeled as a flat
number). `src/data/feats/strong_soul.json` used to code a flat +2/+2 instead — fixed alongside
the multiclass BAB/saves rework below, since the two bugs had been canceling out (see
"Leveling table").

---

## Class progression — READ THIS CAREFULLY

Lyra's character level and her class levels diverge. Several features scale off **druid class
level specifically**, not character level.

| Character level | Druid | Planar Shepherd |
|---|---|---|
| 1–5 | 1–5 | — |
| 6–15 | 5 | 1–10 |
| 16–20 | 6–10 | 10 |

Planar Shepherd caps at 10 levels. Druid resumes at character level 16.

```js
function druidLevel(charLevel) {
  if (charLevel <= 5) return charLevel;
  if (charLevel <= 15) return 5;
  return charLevel - 10;
}
```

**Scales with CHARACTER level** (because druid and PS both advance these):
BAB, base saves, spell slots, caster level, wild shape uses/HD/size/duration, animal
companion.

**Scales with DRUID level only** (Wolf Shaman archetype features):
Totemic Summons temp HP, Wolf Shaman bonus feats.

### Leveling table

BAB and base saves are computed as **proper multiclass sums** (PHB p.59: each class
contributes its own BAB and base saves, computed from that class's own level, and a
multiclass character's totals are the sum) — not a single lookup keyed by character level.
`src/lib/calc/progression.js`'s `computeProgression(characterLevel)` calls
`classLevelsBreakdown()` to split character level into Druid and Planar Shepherd levels via
`druidLevel()`, then sums each class's contribution through `src/lib/rules/dnd35.js`'s
`threeQuarterBabForLevel`/`goodSaveForLevel`/`poorSaveForLevel` — valid because Druid and
Planar Shepherd share an identical progression (3/4 BAB, good Fort, good Will, poor Ref), so
no per-class branching is needed, just the same three formulas applied to each class's own
level and added together.

At level 8 (Druid 5 / Planar Shepherd 3): Druid 5 contributes BAB 3, Fort 4, Ref 1, Will 4;
Planar Shepherd 3 contributes BAB 2, Fort 3, Ref 1, Will 3. Summed: **BAB +5**, base **Fort 7,
Ref 2, Will 7**. This replaced an earlier single blended lookup table
(`src/data/tables/progression.json`, deleted) that ran the PHB druid table straight through by
character level — mathematically wrong for a multiclass character (it happened to match a
single class's own level-8 row, not the sum of two classes' lower levels), overstating BAB by
1 and understating Fort/Will by 1 each at level 8. That base-save understatement had been
silently masked by a second, unrelated bug: `src/data/feats/strong_soul.json` coded a flat +2
Fort/Will instead of the printed +1 (see "Feat reference data" above), so the two errors
canceled and the *displayed* totals (Fort +9, Will +13) were coincidentally already correct —
fixing both at once (DM-confirmed, Aug 2026) keeps those totals unchanged while making the
breakdown underneath them accurate, and the multiclass math now scales correctly to every
other level instead of only working by coincidence at 8.

---

## XP tracking and level-up

Level, XP, HP-roll history, skill ranks, ability adjustments, feats, and wild shape uses/day
are **live state** (`characterProgress`, in the Supabase `character_state` blob), not static
fields on `lyra.json` — `lyra.json` only seeds the very first `characterProgress` the first
time the app ever loads with no saved state. From then on the static file is never read again
for these fields; leveling up edits Supabase directly. This is what lets the sheet recompute
end-to-end (HP, BAB, saves, skills, spell slots, AC, caster level, wild shape uses, the Druid/
Planar Shepherd class split) the moment a level-up is confirmed, with no redeploy.

- `src/lib/calc/leveling.js` — pure XP/HP/skill-point math (`xpForLevel`, `levelForXp`,
  `computeMaxHp`, `skillPointsForLevel`, `maxSkillRank`, `isClassSkillFor`, etc).
- `src/lib/liveState/computeEffectiveSheet.js` — merges `characterProgress` onto the static
  `lyra.json` base and re-runs `computeCharacterSheet`. Called once on load and again in a
  `useMemo` inside `LiveStateContext` whenever `characterProgress` changes, so `sheet` and
  `dailyAbilities` are always derived, never stored.
- `src/lib/calc/computeCharacterSheet.js` — HP max is now `sum(hpRolls) + hpRolls.length *
  conMod + collectFeatHpBonus(feats)` (Toughness contributes via a `hp_bonus` feat effect,
  same pattern as `ability_bonus`), rather than a stored flat number. `casterLevel.druid`,
  `druidLevel`, and `classes` (the "Druid N / Planar Shepherd M" breakdown) are recomputed
  from `character.level` every render via `druidLevel()` (`src/lib/rules/dnd35.js`) — they can
  never drift out of sync with level the way a stored field could.
- `src/components/leveling/XpTracker.jsx` — current XP, XP for next level, progress bar,
  add/spend inputs. Spending XP that would drop Lyra below her current level's minimum
  (`xpForLevel(level)`) shows a `window.confirm` warning rather than blocking outright — 3.5e
  forbids it, but the DM can rule otherwise. Collapsible, defaulting to collapsed like Prepared
  Spells; the collapsed header still shows current XP and XP to next level so that's visible
  without expanding.
- `src/components/leveling/LevelUpFlow.jsx` — appears inline on the Lyra tab once
  `levelForXp(xp) > character.level`. Never auto-levels. Covers:
  - **HP roll** — a d8 input, added to `characterProgress.hpRolls` as its own `{level, roll}`
    entry (editable/re-rollable later, not collapsed into a running total) alongside the
    current Con mod.
  - **Ability score increase** — only shown at character levels 4/8/12/16/20
    (`ABILITY_INCREASE_LEVELS`). Per PHB p.24, an Int increase only grants bonus skill points
    for *that* level, so the skill-point pool below is computed against a tentative ability
    score set that includes the pending pick, via `computeAbilityScores` — not against the
    pre-level-up scores.
  - **Skill points** — pool = 4 + Int mod (`skillPointsForLevel`). Only skills already present
    in `character.skills` are offered (the app has no ability-per-skill lookup for skills
    Lyra doesn't have yet — a genuinely new skill needs a manual data addition first).
    **Max rank and per-rank cost are governed separately (PHB p.59)**, both driven by
    `src/data/tables/classSkills.json` but by two different checks:
    - **Max rank** (`isClassSkillForAnyClass`, `characterLevel + 3`, half that — rounded down —
      for anything on neither list) asks whether a skill is a class skill for *any* of Lyra's
      classes, the union of Druid's and Planar Shepherd's lists. This never changes once a
      skill is a class skill for either class — it doesn't reset or shrink as the class being
      taken changes level to level.
    - **Per-rank cost** (`isClassSkillFor`, 1 vs. 2 points) asks only about the class whose
      level is being taken *this* level-up, via `classTakenAtLevel()` (Druid 1–5, Planar
      Shepherd 6–15, Druid again 16–20 — same split as the class-progression table above).
    Planar Shepherd's list (Concentration, Knowledge arcana/nature/the planes, Listen,
    Spellcraft, Spot, Survival) is narrower than Druid's (which also includes Knowledge
    (religion) per a DM ruling, alongside Craft/Diplomacy/Handle Animal/Heal/Knowledge
    (nature)/Listen/Profession/Ride/Spellcraft/Spot/Survival/Swim), so Heal, Handle Animal,
    Ride, and Knowledge (religion) cost 2 pts/rank the moment Planar Shepherd levels start
    stacking in — but since they're still druid class skills, their max rank stays at the full
    `characterLevel + 3` throughout, never dropping to the half-cap "cross-class" cap. The UI
    shows both numbers as separate table columns (Max, Cost/rank) rather than folding them into
    one "cross-class" label, since a skill can be at the full cap while still costing double.
  - **Wild shape uses/day** — pre-filled from `src/data/tables/wildShapeUsesPerDay.json`
    (DM-confirmed full curve, Aug 2026: 1/day at 5, 2/day at 6, 3/day at 7–9, 4/day at 10–13,
    5/day at 14–17, 6/day at 18–20), but always shown as an editable field rather than applied
    silently, in case a future houserule changes it.
  - **Feats and class features** — recorded manually. The feat picker (a card per feat, not a
    plain dropdown) lists every feat with a JSON file in `src/data/feats/` that Lyra doesn't
    already have (`getFeats()` throws on an unknown id, so a brand-new feat needs its
    mechanical data file added before it can be picked — `id`/`name`/`source`/`effects`, `[]`
    for anything not modeled). Each card's prerequisites and full benefit text come from a
    **separate join**, not from the mechanical file: `src/lib/loadFeatReferenceData.js` globs
    the project-root `/data/feats/<book>.json` bibliographic catalog (CLAUDE.md > Feat
    reference data — one file per sourcebook, DM-cited prerequisites/page/benefit text) into
    `featReferenceByName`, keyed by each entry's printed `name`, and `LevelUpFlow.jsx` looks up
    `featReferenceByName[feat.name]` for the mechanical feat being rendered. The two catalogs
    are kept in sync by every `src/data/feats/*.json` file's `name` matching an entry in
    `/data/feats/` exactly — the picker currently covers all 13 (8 Lyra already has, plus
    Dragon Wild Shape, Gatekeeper Initiate, Planar Wild Shape, Scribe Scroll, Sustain Wild
    Shape as not-yet-taken candidates); a new mechanical feat with no bibliographic match just
    shows no prerequisites/citation rather than crashing.
    `src/lib/calc/featPrerequisites.js` checks the reference schema (`abilityScores`,
    `baseAttackBonus`, `skills`, `feats`, `classFeatures`, `casterLevel`, `other`) generically
    against Lyra's current stats (including any pending ability-score-increase pick, but not a
    hypothetical post-level-up BAB — "currently qualify" means before this level-up is
    confirmed). `abilityScores`/`baseAttackBonus`/`skills`/`casterLevel`/`feats` are checked
    automatically (skill-name matching is normalized — strips "the" and punctuation — so the
    catalog's "Knowledge (planes)" matches Lyra's own "Knowledge (the planes)" skill label);
    `classFeatures` and `other` are free text with no data source in this app to verify, so
    they're always unverifiable rather than silently assumed true or false. Status is one of
    three, shown as a badge and a colored left border on the card: `qualifies`, `unqualified`
    (at least one prerequisite definitely unmet), `needs-check` (nothing definitely unmet, but
    at least one unverifiable prerequisite). Unqualified and needs-check feats are **flagged,
    never hidden** — a DM can always grant a feat outside its normal prerequisites — and the
    Add button stays enabled regardless of status. Feats picked earlier in the same level-up
    session count toward `feats`-type prerequisites too, so taking a prerequisite and its
    dependent together resolves the chain live. Class features are freeform text, not tied to
    any calc engine — e.g. the Wolf Shaman bonus feat at character level 19 (druid level 9) has
    no dedicated code and is expected to be recorded here, then (if it grants a mechanical
    effect) added as an actual feat with a `hp_bonus`/`ability_bonus`/`save_bonus`
    /`grants_daily_spell` effect like any other feat.
- Confirming calls `applyLevelUp` (bumps level, appends the HP roll, applies the ability
  adjustment if applicable, sets wild shape uses/day) plus `setSkillRanks`/`addFeat`/
  `addClassFeature` for each changed skill/feat/feature — all in `src/lib/liveState/actions.js`,
  same pure-transform pattern as every other tracker action. Opening the flow scrolls the page
  to the HP-roll block.

**HP-roll history caveat:** the 8 entries seeded into `lyra.json`'s `hpRolls` for levels 1–8
are a **synthetic reconstruction** (level-1 max roll of 8, then 6 at every level after, summing
with Con and Toughness to the correct total of 61), not Lyra's real historical rolls — nobody
recorded those at the table. Edit them if the real numbers ever surface; nothing downstream
cares how they got there, only that they sum correctly.

**Verified end-to-end (Aug 2026):** leveling 8 → 9 via the flow above correctly produces a 5th
spell slot, cure critical wounds appearing as a spontaneous conversion
(`spontaneousConversions.byLevel["5"]`, already in place before this phase), Planar Shepherd
ticking to 4 (Druid stays 5, per the class table), and the new caster level/BAB/saves row — all
without touching any component beyond confirming the level-up. (Wild shape stays at 3/day
through level 9 — the 4th use unlocks at level 10, per the corrected curve above; an earlier
version of this table had guessed 4/day at level 9 and was corrected after DM review.)

### Ability score editor

`src/components/leveling/AbilityScoreEditor.jsx`, on the Lyra tab, lets Lyra's ability scores
be edited **outside** a level-up — needed because inherent bonuses (the Wis tome) and other
one-off adjustments don't wait for a level to land. Toggling "Edit" reveals, per ability: the
base score (`characterProgress.trueBaseAbilityScores[ability]`, itself now live state seeded
from `lyra.json`'s `trueBaseAbilityScores`) and every adjustment affecting that ability
(`characterProgress.abilityAdjustments`, filtered by `ability`) as its own editable row — value,
bonus type, source, and an active checkbox, so a level-based increase and an inherent bonus
like the Wis tome both show up distinctly rather than folded into one number. Everything
downstream (saves, AC, skills, spell slots, save DCs, spell attack bonus) recomputes for free —
these fields already flowed through `computeAbilityScores` inside `computeCharacterSheet`, this
just exposes them as edit targets instead of hardcoding them at load time.

### Test mode

`LiveStateContext` supports a **test mode** toggle (SyncBar, Lyra tab) for experimenting with
level-up without persisting to Supabase. Entering it snapshots the current state in a ref and
suspends the debounced-save effect entirely — `update()` still changes React state normally
(so the UI reflects every edit live) but nothing is written to Supabase or localStorage while
active. A "Reset" button restores the snapshot without leaving test mode, for trying multiple
what-ifs in a row. Exiting test mode always restores the snapshot too, rather than committing
whatever was being experimented with — the point is that nothing tried while the toggle is on
can leak into the saved state, even by accident.

---

## Character: Lyra

Half-elf. Character level 8 = Druid 5 / Planar Shepherd 3.
Planar attunement: the Feywild (DM uses the 5e interpretation).
Pathfinder archetype: **Wolf Shaman**.

### Ability scores

| | Score | Mod |
|---|---|---|
| STR | 10 | +0 |
| DEX | 18 | +4 |
| CON | 12 | +1 |
| INT | 16 | +3 |
| WIS | 20 | +5 |
| CHA | 11 | +0 |

A DM-gifted tome will raise WIS to 22. **Confirmed inherent** — stacks with everything,
permanent, capped at +5 total inherent. One week of game time to read.

### Derived stats at level 8

- **HP** 61
- **AC** 20 / touch 15 / flat-footed 16 (10 + 3 armor + 2 shield + 1 deflection + 4 Dex)
- **Fort** +9 (7 base + 1 Con + 1 Strong Soul)
- **Ref** +6 (2 base + 4 Dex)
- **Will** +13 (7 base + 5 Wis + 1 Strong Soul)
- **Initiative** +4
- **Spell attack bonus** +10 (BAB +5 + Wis mod). Compute, don't hardcode — the WIS 22 tome must
  update this automatically.
- **Land speed** **50 ft.** (30 base + 20 permanent Totem Transformation — see speed rule)
- **Caster level** 8
- **Druid save DC** 15 + spell level

### Spell slots

At WIS 20: **6 / 6 / 4 / 4 / 3** (levels 0–4)
At WIS 22: **6 / 6 / 5 / 4 / 3**

Base table value is 6/4/3/3/2; the rest is Wisdom bonus spells. Compute, don't hardcode.

### Skills (ranks → total)

| Skill | Ranks | Total |
|---|---|---|
| Concentration | 11 | +12 |
| Handle Animal | 9 | +11 (incl. Animal Affinity) |
| Heal | 10 | +15 |
| Knowledge (nature) | 11 | +14 |
| Knowledge (the planes) | 5 | +8 |
| Knowledge (religion) | 4 | +7 |
| Listen | 7 | +12 |
| Spellcraft | 11 | +14 |
| Spot | 8 | +13 |
| Survival | 5 | +10 |

Conditional, surface in UI rather than baking in:
- Wild empathy with **canines**: full-round action, +4 bonus

### Equipment

- **Leafweave Studded Leather**: +3 AC, max Dex +6, 0 check penalty, 20 lb, non-metal with
  darkwood studs. Leafweave increases the base masterwork studded leather's max Dex bonus by 1
  (5→6). Reduces arcane spell failure by 5%.
- Heavy wooden shield: +2 AC, −2 check penalty, 10 lb
- Ring of protection: +1 deflection bonus to AC
- Forestwarden Shroud: lightweight tunic and leggings worn over armor; negates undergrowth/heavy
  undergrowth penalties on Tumble and Move Silently (DMG p.87, Forest Terrain). Found in the
  Bodak Lair.
- **Druid necklace**: 5–6 spells, 1/day each, **no spell slot**. Confirmed: *entangle*,
  *barkskin*, *plant growth*, *speak with plants*, *tree shape*, possibly one more. Track as
  independent daily checkboxes outside the slot economy.

Armor and shield are non-metal (druid-legal).

#### Celeb mûr ("Silver Flow"), commonly called Quicksilver

**+2 elven scimitar of speed.** Silvered blade, sylvan elvish runes, moonstone pommel.

- 1d6 slashing, **18–20/×2**
- **Speed**: on a full attack, **one extra attack at full BAB**. Explicitly **does not stack**
  with *haste* — surface this warning next to the attack routine.
- **Light**: moonstone sheds pale purple light, 5 ft. radius, in total darkness. Requires four
  hours of moonlight exposure nightly. Passive property with a condition note, not a tracker.

| Action | Routine | Damage |
|---|---|---|
| Single attack | **+7** | 1d6+2 |
| Full attack | **+7 / +7** | 1d6+2 |

BAB +5 (below the +6 iterative-attack threshold, so no -5 iterative attack) plus +2
enhancement, with the speed property's extra attack at full BAB inserted alongside it. The
extra attack is a weapon property injection, not an iterative. Build attack routines from BAB
**plus property injections**.

*Player note, not a rule:* Weapon Finesse would take this to +11/+11 (BAB +5 + Dex +4 +2
enhancement, still below the iterative threshold). Scimitar is a light weapon and qualifies.
Not currently taken.

### Feats

- **Toughness** (L1)
- **Strong Soul** (L1) — +1 Fort and Will, rising to +3 (replacing, not stacking with, the +1)
  vs death effects, energy drain, and ability drain
- **Spontaneous Healer** (L3) — substitute any prepared spell for a Cure spell
- **Greenbound Summoning** (L4–5) — Greenbound template on all *summon nature's ally*
  results except elementals
- **Natural Spell** (L4–5) — cast while wild shaped
- **Animal Affinity** (L4–5) — +2 Handle Animal, +2 Ride
- **Fey Touched** (L4–5, 5e) — +1 WIS; *misty step* and *charm person*, 1/day each
- **Ashbound** (L6) — *summon nature's ally* duration doubled; summons gain **+3 luck bonus
  on attack rolls**

---

## Wolf Shaman archetype (Pathfinder, DM-adapted)

**Scales with DRUID level, not character level.** See Class Progression.

**Nature Bond:** animal companion must be a wolf. See Quen below.

**Wild Empathy (Ex):** canines, full-round action, +4 bonus.

**Totem Transformation (Su)** — DM ruled this a **one-time permanent boost, not a per-day
ability. No tracker.** Lyra selected **movement**: permanent +20 ft. enhancement to land
speed. The at-will ***speak with animals* (canines only)** rider is likewise permanent.

**Speed rule (DM-confirmed):**
- Base form: **+20 applies** → Lyra's land speed is 50 ft.
- Wild shape into a form with `isCanine` true: **+20 applies**
- Wild shape into any non-canine form: **no bonus**, use the form's speed as printed

**Totemic Summons (Su)** — when summoning canines:
- Cast *summon nature's ally* as a **standard action**
- Summoned canines gain **temp HP equal to DRUID level** — currently **5**, rising to 6/7/8/9/10
  at character levels 16–20
- **Young** template: required spell level −1
- **Advanced** or **giant**: required spell level +1
- **Both**: required spell level +2

**Bonus Feats:** at druid level 9 and every 4 druid levels after. Given the progression, druid
9 arrives at **character level 19**, and druid 13/17 are never reached. So **exactly one**
Wolf Shaman bonus feat, at character level 19: Greater Trip, Improved Trip, Mobility, Skill
Focus (Stealth), or Spring Attack.

---

## Wild Shape

Planar Shepherd levels **stack with druid levels** for daily uses, maximum HD, size, and
duration — but **not creature type**. Effective wild shape level = character level.

**At level 8: 3 uses/day, maximum size Large, maximum 8 HD.**

Type access, gated by Planar Shepherd level:

| PS level | Char level | Unlocks |
|---|---|---|
| 3 (current) | 8 | Magical beasts native to the Feywild |
| 9 | 14 | Elementals and outsiders native to the Feywild |

**Elemental/outsider forms cost TWO daily uses.** The tracker must decrement by 2.

Lyra does not have Planar Wild Shape and does not plan to take it.

Creature data carries `wildShapeMinLevel` (integer or null): Animal → 5, Feywild-native
magical beast → 8, Feywild-native outsider/elemental → 14, everything else → null. The app
checks `wildShapeMinLevel <= characterLevel`, then applies size and HD caps as engine logic.

**Fey forms are never available** at any level — neither progression grants them. This affects
pixie and satyr.

### The polymorph swap (core calculation)

**Retained:** BAB, base save bonuses, HP, skill ranks, feats, INT, WIS, CHA
**Taken from form:** STR, DEX, CON, size, natural armor, speeds, natural attacks, Ex qualities

**Recompute:**
- Attack = BAB + form's Str mod + size modifier
- Secondary natural attacks at −5
- **Single** natural weapon → damage adds **1.5× Str bonus**. Multiple attacks → primary gets
  full Str, secondaries half.
- Fort = base Fort + form's Con mod + 1 (Strong Soul)
- Ref = base Ref + form's Dex mod
- Will = base Will + Wis mod + 1 (Strong Soul) — unchanged by form
- AC = 10 + size mod + form's Dex mod + form's natural armor + persistent item bonuses
- Land speed = form's land speed, **+20 only if `isCanine`**

Persistent item bonuses = ring of protection (+1 deflection). Armor and shield don't carry
over. Quicksilver is unusable in most forms.

At PS 9+ (character level 14+), forms also grant all Ex, Su, and Sp abilities. **Below that,
only Ex abilities** — this is why unicorn's *greater teleport* and healing are unavailable at
level 8.

### Display: one stat block, not two (Aug 2026)

While a form is active, the main sheet shows its numbers **in place** — Combat Stats, Armor
Class, Saves, and the Reference tab's Attack Routine all switch to the form's values, rather
than a second wild-shape stat block sitting alongside the normal one. `CharacterSheet.jsx`
computes this once, at the top of the component, via
`getActiveWildShapeStatBlock({ sheet, activeForm: state.activeWildShapeForm, monsterManual })`
(`src/lib/calc/wildShape.js`) and passes the result (`wildShapeStatBlock`, `null` when no form
is active) down to every affected component — `CombatBar`, `AbilityScoreEditor`,
`CombatStatsCore`, `ArmorClass`, `Saves`, `AttackRoutine`, and the Wild Shape card itself — so
there's exactly one `wild ? formValue : baseValue` branch per stat, not a parallel component
tree. Reverting sets `state.activeWildShapeForm` back to `null`; every one of those branches
collapses to the base sheet on its own, so there's no separate "undo the override" step to get
wrong.

Each affected stat carries a 🐾 badge next to its label, and (via the shared `StatValue`
helper) its pre-wild-shape base value struck through and tooltipped right next to the current
one — visible at a glance, not just on hover, so "what would reverting give me back" never
needs a mental subtraction. Per the polymorph swap rules above: Str/Dex/Con, size, natural
armor, AC, speed, the attack routine, and Fort/Ref saves get this treatment; HP, BAB, skill
ranks, Int/Wis/Cha, Will, spell save DCs, spell attack bonus, and caster level are genuinely
unchanged by wild shape and render exactly as they do out of it, no badge. The Attack Routine
card doesn't try to show "current vs. base" per attack the way a single number can (a whole
different weapon vs. a whole different set of natural attacks doesn't reduce to one delta) — it
swaps wholesale to the form's attacks and adds one line noting the base weapon's single-attack
number, struck through, since Quicksilver is unusable in most forms anyway.

The Wild Shape card itself is collapsible, defaulting to collapsed (it's used a handful of
times per session, not something that needs to stay open) — collapsed, its header shows the
active form's name if one is assumed, same 🐾-prefixed pattern as the badges elsewhere. Expanded
while a form is active, it's now just the confirmation line, the form's Special Qualities &
Attacks (genuinely wild-shape-only content with no "base" equivalent, so it has nowhere else to
live), and the Revert button — the big per-form stat block that used to render here now only
shows for the *picker preview* (a form selected but not yet assumed), where there's no
duplication concern since nothing is active yet.

### Known available forms

Lyra can wild shape into any animal she's familiar with — common Greyhawk animals (wolf, brown
bear, eagle, dog, cat) plus anything she has summoned. Creatures summoned to date: crocodile,
wolf, wolverine, dire rat, dire bat, dire wolf, unicorn, pixie, giant owl, juvenile arrowhawk,
minor xorn, satyr.

**Unicorn is DM-confirmed Feywild-native magical beast** — available now at PS 3. Large,
4 HD, Str 20. Within size and HD caps. Body only, no spell-like abilities until level 14.

**DM-approved Feywild forms (added):** Aranea (MM I p.15), Blink Dog (MM I p.28), Elven Hound
(Races of the Wild p.189), Pegasus (MM I p.206), Asperi (MM II p.25, 3.0-format stat block),
Ur'Epona (Planar Handbook p.130), Tressym (Lost Empires of Faerûn p.191), plus Giant Owl
(updated from pending to confirmed). All `wildShapeMinLevel: 8`. Aranea's Feats and Challenge
Rating couldn't be reliably extracted from the source PDF's column layout — verify manually.
Ur'Epona's hoof is written up as secondary (half Str to damage) even though it's the
creature's only natural weapon — see `strMult` handling in `wildShape.js`/`summonBuilder.js`.

**`lyraFamiliar` only gates wild shape, not summoning.** Summon Nature's Ally has no
familiarity requirement — Lyra can summon an arrowhawk, xorn, or unicorn even though she
can't wild shape into most of them. The two pickers use different eligibility filters
entirely (`getEligibleWildShapeForms` vs `getSummonableCreatures`).

**Single vs. full attack:** both the wild shape and summon builder attack routines expose a
`{ single, full, hasSecondaries }` shape. `single` is a standard-action attack with the best
primary weapon only (count forced to 1); `full` is the full-round-action routine (primary at
full count plus all secondaries at −5). The UI hides the full-attack block entirely when
`hasSecondaries` is false, per DM request — no point showing two identical action options.

**`lyraFamiliar` (boolean, in `data/creatures/*.json`)** gates the wild shape
picker on top of level/size/HD: true for the common Greyhawk animals named above, anything on
a Summon Nature's Ally list Lyra can currently cast (level ≤ 4), and DM-approved Feywild forms
(Unicorn). False for everything else — e.g. polar bear (SNA 5, not currently castable, no
plausible familiarity). Picker groups canine forms first (they carry the +20 ft. Totem
Transformation bonus and see the most table use), alphabetical within each group.

Giant owl is also a magical beast; Feywild-native status **pending DM ruling**.
Arrowhawk and xorn are outsiders native to the Elemental Planes of Air and Earth — not
Feywild-native, so never available. Pixie and satyr are fey — never available.

---

## Anarchic template (Iconic Manifestation overlay)

Lyra is chaotic neutral, so Iconic Manifestation (Druid 4) grants her the Anarchic template
(Manual of the Planes, p. 198) — `data/templates/anarchic.json`, loaded via
`loadCreatureData.js`, computed by `src/lib/calc/anarchic.js`. **This is an overlay on Lyra
herself, never a form modifier** — critically different from wild shape, Greenbound, and every
other template in this app, which all replace or layer onto a *creature's* stats. Anarchic
composes onto whatever her current stat block is (base form or wild shaped) and survives
wild-shape changes untouched, because `state.anarchicTemplate` is a wholly separate live-state
key from `activeWildShapeForm` — nothing in `assumeWildShapeForm`/`revertWildShapeForm` reads
or writes it. Don't couple the two.

**Split across two tabs.** Tab 1 (`AnarchicToggle.jsx`, embedded inside the Wild Shape card,
right after its `<h2>`) is the live tracker: one checkbox, "Iconic Manifestation active." Tab 3
Reference (`AnarchicReference`, a local component in `CharacterSheet.jsx` alongside
Equipment/Feats) is the full write-up — description, the complete DR/fast-healing table, Smite
Law's full text, the type-change rule, ability minimum — material the player rarely needs
mid-round and doesn't want cluttering Tab 1. Both read the same `anarchicTemplate.json` data
and `calc/anarchic.js` functions; only the UI is split, not the underlying rules.

**One checkbox, both costs at once.** RAW technically separates casting (opens an invocation
window) from invoking (commits to the effect) as two actions with two different economies —
Reference documents this distinction for completeness — but the live tracker collapses it into
a single toggle: checking it spends a 4th-level slot *and* a wild shape use together and goes
straight to the active/timed effect (`activateAnarchic`), skipping the window entirely, since
in practice there's rarely a reason to cast now and decide whether to invoke later. Unchecking
(`deactivateAnarchic`) never refunds either cost, same as every other tracker in this app.
`state.anarchicTemplate` is `{ active, durationMinutesRemaining, smiteLawUsed }` — no `phase`
field, no window. Duration is `invokedDurationMinutesPerCasterLevel` (1) × caster level, so
8 min at CL 8 — minute-based countdown (not rounds, these durations are long enough that a
rounds-based stepper would be unusable) via a plain `-1/+1` stepper, same interaction pattern
as every other tracker: nothing auto-decrements on a real clock, the player ticks it down
themselves.

**Hit Dice for template purposes is always Lyra's own character level**, never the active wild
shape form's HD — standard wild shape rules never change HD (BAB/saves/HP/skill ranks/feats
all stay hers per the Wild Shape section above), so this holds in base form or shaped alike.
`computeAnarchicOverlay()` takes `hd` as a plain parameter for exactly this reason; don't wire
it to `parseHitDice()` on whatever creature is currently active.

**DR/fast healing by HD** (confirmed against the book, three-column table — Manual of the
Planes p. 198): 1–3 HD none/none, 4–7 HD none/fast healing 1, 8–11 HD none/fast healing 3,
12+ HD DR 5/+1/fast healing 5. At Lyra's 8 HD that's fast healing 3, no DR — verified live.
"If the base creature already has fast healing or DR, use the better value" is modeled
(`betterDamageReduction()`) but is a no-op today: nothing in this app's creature or character
data currently carries DR/fast healing to compare against, so `existingDamageReduction`/
`existingFastHealing` default to none. Wire them up if a future wild shape form or piece of
gear ever grants either.

**Smite Law** (Su, 1/day) is its own daily resource — `anarchicTemplate.smiteLawUsed` — reset
only by Long Rest, deliberately untouched by `activateAnarchic`/`deactivateAnarchic` so it
persists correctly across multiple activations in the same day. Bonus damage = HD, capped at
+20 (`computeSmiteLawBonus`) — +8 at CL 8.

**Type change** ("Animals and beasts become magical beasts") only ever shows a note, never
recomputes anything, and only applies while both true: template invoked *and* currently wild
shaped into a creature of one of those types — looked up live via
`state.activeWildShapeForm.creatureName` against `monsterManual`, not cached.

Ability scores, saves, skills, and feats are explicitly unaffected — the template data file
documents this (`noChangeTo`) but nothing computes off it; it exists so a future reader doesn't
wonder why those fields are missing from the overlay.

---

## Summoning

A canine summon can stack a simple template, Greenbound, and two feat effects.

**Greenbound applies to every summon except elementals (DM-confirmed).** Anything with a
`summonNaturesAllyLevel` is a valid summon regardless of type — Lyra can cast *summon nature's
ally* to get an arrowhawk, a xorn, a unicorn, or an elemental same as a wolf — and Greenbound
Summoning layers onto every result except an elemental base creature: animals, fey, giants,
humanoids, monstrous humanoids, vermin, magical beasts, and outsiders all get the full template
(type change, stat boost, gained slam, DR/qualities/spell-likes); an elemental summon skips the
template entirely and keeps its own type, ability scores, and natural armor. Ashbound's
duration-double and +3 luck bonus, and Totemic Summons' canine temp HP, apply to **every**
summon independently of Greenbound eligibility — don't gate those on it.

### Pipeline order

1. **Simple template** (young / advanced / giant), if chosen — canines only
2. **Greenbound template**, unless the base creature is an elemental
3. **Ashbound** and **Totemic Summons** bonuses — always, independent of step 2

Ability adjustments are commutative, but Greenbound's slam damage is size-keyed and its
"whichever is better" comparison must evaluate at **final** size. Size resolves first.

### Simple templates — Pathfinder rules as written (DM-confirmed)

Use **rebuild rules**, not quick rules.

**Advanced** (CR +1) — **+4 to all ability scores**. No size change.

**Giant** (CR +1, not applicable to Colossal) — size **+1** category; natural armor **+3**;
damage dice **+1 step**; **+4 size bonus to Str and Con, −2 Dex**.

**Young** (CR −1) — size **−1** category; natural armor **−2** (min 0); damage dice **−1
step**; **−4 Str, −4 Con, +4 Dex**.

The Pathfinder giant template is deliberately milder than a Monster Manual size advance
(+4 Str, not +8) and carries its own natural armor and damage rules. **Do not mix the two
systems.**

Size still applies the standard AC and attack modifier (Large −1, Huge −2, Small +1), plus
space, reach, and grapple.

**Damage ladder:** 1d2 → 1d3 → 1d4 → 1d6 → 1d8 → 2d6 → 2d8 → 3d6 → 3d8. Reverse for young.

### Greenbound template (applies to every summon except elementals)

An elemental base creature skips this section entirely and keeps its own type, ability
scores, and natural armor.

- **Type** → plant (augmented subtype). Size unchanged. Do **not** recalculate base attack
  bonus, base saves, or skill points.
- **Hit Dice** all become d8s
- **Natural armor** +6 over base
- **Abilities**: STR +6, DEX +2, CON +4, CHA +4
- Gains a **slam attack** if it lacked one
- **DR 10/magic and slashing**; natural weapons count as magic for overcoming DR
- **Fast healing 3**, **+4 grapple**, **resistance 10** cold and electricity,
  **tremorsense 60 ft.**
- **+16 racial** on Hide and Move Silently in forested areas
- **Spell-like**: at will — *entangle*, *pass without trace*, *speak with plants*;
  1/day — *wall of thorns*. CL = creature's character level.
  DC = 10 + spell level + creature's CHA mod (remember the +4).
  **Wall of thorns is per-instance**, not per-casting — a batch of 3 greenbound wolves each
  gets their own daily use, tracked alongside that instance's individual HP.
- CR +2

Slam damage by size: Fine 1, Dim 1d2, Tiny 1d3, Small 1d4, Medium 1d6, Large 1d8, Huge 2d6,
Garg 2d8, Col 4d6. Creatures with existing natural weapons keep their damage or use the table,
whichever is better.

Fighting unarmed, it uses **either** slam **or** natural weapons — show both routines.

### Feat effects (always applied)

- **Ashbound** — duration **doubled**; **+3 luck bonus on attack rolls**
- **Totemic Summons** (canines only) — standard action; **temp HP = druid level (5)**

### Worked examples — verify the engine against these

Base wolf: Medium animal, 2d8+4, AC 14 (+2 Dex, +2 natural), BAB +1, bite +3 (1d6+1),
Str 13 / Dex 15 / Con 15 / Cha 6, Weapon Focus (bite).

| | Greenbound | Advanced Greenbound | Giant Greenbound |
|---|---|---|---|
| Size | Medium | Medium | Large |
| Str / Dex / Con | 19 / 17 / 19 | 23 / 21 / 23 | 23 / 15 / 23 |
| Natural armor | +8 | +8 | +11 |
| AC | 21 | 23 | 22 |
| Bite (incl. Ashbound +3) | **+9**, 1d6+6 | **+11**, 1d6+9 | **+10**, 1d8+9 |
| HP before temp | ~17 | ~21 | ~21 |
| Temp HP | +5 | +5 | +5 |
| Spell level cost | base | +1 | +1 |

1.5× Str applies because the bite is the wolf's only natural weapon. Note advanced wins on
attack bonus while giant wins on damage die, at identical cost — the UI should show that
tradeoff rather than assuming one is better.

### Summon nature's minor ally (level 0)

An orison, functionally *summon nature's ally I* but limited to a Tiny or Diminutive animal of
½ HD or less (Quintessential Druid II, Drd 0). The 8 creatures it can actually produce are
tagged `summonNaturesAllyLevel: 0` in `data/creatures/monster-manual.json` (Bat, Cat, Lizard,
Rat, Raven, Snake — Tiny Viper, Toad, Weasel — a `note` field on each explains the spell
actually allows *any* qualifying animal, this list is just illustrative) — no changes needed
anywhere in `calc/summonBuilder.js`, which was already fully generic over
`summonNaturesAllyLevel`. Same pipeline as every other level: Greenbound and Ashbound apply
normally (none of the 8 are canine or elemental); young/advanced/giant never apply since
those trades are canine-only and none of these creatures are canines, so there's no
Totemic Summons speed-up or temp HP either — all of that already fell out of the existing
`isCanine` checks with no special-casing required. The one real code change:
`SummonBuilder.jsx`'s level picker derives its options from `spellSlots.slots`, which
(correctly) has no level-0 entry at all — 0 is prepended manually, and `handleSummon` skips
`setSpellSlotUsed` entirely when `level === 0`, matching orisons' no-daily-cap houserule
(same pattern as `PreparedSpellsTracker`/`spontaneousConversions.json`).

**Bug found via this addition, fixed in both summons and wild shape:** Bat and Toad's real
3.5e stat blocks list no attacks at all (`attacks: []` — accurate, not a data gap; these are
utility/scouting forms, not combat ones). `computeSummonStatBlock` and
`computeWildShapeStatBlock` both used to assume at least one attack existed and crashed
(`Cannot read properties of undefined (reading 'primary')`) trying to pick a "best primary"
from an empty array. This was **already live** for Wild Shape before this change — Bat and
Toad are both `wildShapeMinLevel: 5`, reachable at Lyra's level 8 — just never hit because
nothing had exercised that path. Fixed by skipping natural-weapon-routine construction
entirely when `attacks.length === 0`: a wild-shaped Bat/Toad now correctly shows "No attacks
in this form" (wild shape has no fallback — no Greenbound-style template to grant one), while
a *summoned* Bat/Toad still gets a slam via Greenbound ("gains a slam attack if it lacked
one") since Greenbound applies to both regardless of whether the base creature already had a
natural weapon.

### Summon builder UI

Player picks a spell slot level, sees which creatures are reachable at which template loadouts,
gets the finished stat block (ability scores, saves, AC/touch/flat-footed, initiative, speed,
both attack routines, qualities, spell-like abilities) in a collapsible preview that defaults
**collapsed** — useful while deciding, noise once summoned. Summon Nature's Ally can produce
more than one creature (the player rolls the count, e.g. 1d4+1, and types it in) — each
instance is tracked individually (own HP, temp HP, wall of thorns, dead/dismissed status)
since they take damage separately, grouped under one summon with a **shared** stat block and
**shared** remaining duration (doubled by Ashbound). The full stat block is stored on the
group at cast time (not recomputed later) and shown once per group in a collapsible section
that defaults **expanded**, with the per-instance trackers underneath.

**Each cast is its own group, even for the same creature.** Casting Summon Nature's Ally I for
2 wolves, then again later for 3 more, produces two independent groups — separate durations,
separate HP/wall-of-thorns trackers. Never merge groups by creature name. Group headers show
creature, count, and remaining duration together (`Dire Rat (Greenbound) ×2 — 12 rounds left`)
so multiple active groups stay distinguishable at a glance.

Multiple different summons can be active at once, each its own group.

Monster base save progression (good = 2 + floor(HD/2), poor = floor(HD/3), by creature type)
lives in `monsterBaseSaves()` (`src/lib/rules/dnd35.js`) — shared between the summon builder
and Quen's companion calculator, since a summon (unlike a wild-shaped Lyra) uses its own base
saves, not Lyra's.

**Note:** Greenbound changes type to *plant*; PS 3 grants wild shape into *magical beasts*.
Separate systems. Greenbound does not unlock wild shape forms.

---

## Quen — animal companion

Wolf, mandated by Wolf Shaman. Planar Shepherd levels stack with druid levels for companion
abilities, so effective druid level = **character level** = 8, using the 6th–8th row.

At effective level 8:

| | Value |
|---|---|
| Hit Dice | 6d8+12 (~39 hp) |
| Str / Dex / Con | 15 / 17 / 15 |
| BAB / Grapple | +4 / +6 |
| **AC** | **21** (10 + 3 Dex + 6 natural + 2 armor), touch 13, flat-footed 18 |
| **Bite** | **+7**, 1d6+3, plus trip |
| Fort / Ref / Will | +7 / +8 / +3 |
| Speed | **40 ft.** (50 base, reduced by armor — DM-confirmed) |

Abilities: Link, share spells, Evasion, **Devotion** (+4 morale bonus on Will saves against
enchantment — surface separately; base Will +3 is his weak point).

Trip (Ex): on a bite hit, may trip as a free action with +1 check modifier, no touch attack,
no attack of opportunity. Failure doesn't allow a counter-trip.

Skills: +4 racial on Survival when tracking by scent.

Known tricks: defend, attack, down, fetch, work, come, heel.

**Armor — Custom Masterwork Wooden Studded Honey Leather** (150 gp): +2 armor bonus (stacks
with natural armor), max Dex +5, check penalty 0, **speed 40 ft.**, 8 lb. Two side pouches,
saddle mount, three leather rings per flank for hanging items or attaching litter poles.

Max Dex +5 never binds — Quen doesn't reach Dex 20 until character level 18.

Store the full companion progression table so Quen recomputes at any level.

**Open:** at 6 HD Quen is entitled to three feats but shows only Track (bonus) and Weapon
Focus (bite). He may have two unassigned feats — ask the DM.

---

## Spell preparation model

Do **not** model prepared spells as fixed data. Lyra has the entire druid list and re-prepares
by meditation after every long rest. `PreparedSpellsTracker` (`src/components/trackers/
TrackersPanel.jsx`) is the fill-in-after-rest flow: one free-text input per prepared-spell slot
(6 orisons, plus each leveled slot's `total`), no validation against a spell list. State lives
in `state.preparedSpells` (`{ [level]: string[] }`, keyed 0–4), persists to Supabase like every
other tracker, and is wiped back to blank slots by Long Rest (it's just part of
`getDefaultLiveState`, so it resets for free along with everything else).

Always available, outside the slot economy — **not** prepared spells, so they don't occupy a
typed slot above, but casting one still spends a slot from that level's tracker (except at
orison level — see below):
1. **Spontaneous Healer** — any prepared spell converts to a Cure spell
2. ***Summon Nature's Ally*** — spontaneous conversion
3. **The druid necklace** — 5–6 spells, 1/day each, free of slots

The per-level cure/SNA conversion names are data, not code: `src/data/tables/
spontaneousConversions.json`, rendered as a visually distinct "always available" section under
each level's typed slots (badge-style pills, not plain inputs) so it reads as fixed reference
rather than something the player fills in. Orisons are unlimited-use under this campaign's
houserule (no `spellSlotsUsed` tracker for level 0 at all), so *summon nature's minor ally*
alongside *cure minor wounds* at that level costs nothing to cast — the "spends a slot" caveat
only applies to levels 1–5.

**Druid Cure progression is offset from cleric/bard by one level past 1st** (DM-confirmed):
cure light wounds stays at 1st, but moderate/serious/critical shift up to 3rd/4th/5th — so
2nd level has *no* Cure spell, only the Summon Nature's Ally conversion. Cure critical wounds
(5th) won't appear in the UI until Lyra reaches character level 9 and actually has 5th-level
slots (`spellSlots.slots` only includes levels with `total > 0`); the data entry already
exists in `spontaneousConversions.json` and needs no further change when that day comes.

**`alwaysAvailable` (Aug 2026)** is a second, separate top-level array in the same file, for
granted abilities that aren't tied to *any* spell level at all — as opposed to `byLevel`'s
conversions, which are always keyed to the level whose prepared slot they draw from. Currently
just **Detect Manifest Zone** (Sp, at will, Planar Shepherd 2 — the same spell-like ability
documented in `data/spells/faiths-of-eberron.json` and shown on the Spell Reference tab, but
deliberately *not* imported from there: that file lives behind the Spells tab's lazy-loaded
chunk, and pulling from it here would drag the whole ~850KB spell corpus back into the
always-loaded main bundle the Spells tab code-splitting was specifically added to avoid — see
Spell Reference tab > Code-split below). Rendered at the top of `PreparedSpellsTracker`,
above the per-level breakdown, same pill styling (`.spontaneous-conversions`) but with the
descriptive `note` field (usage type, source, "costs no slot, no daily limit") shown as plain
text underneath rather than crammed into the pill — the per-level pills are short spell names
by design, but an ability description doesn't fit that shape.

---

## Layout

Four tabs — Lyra / Companions / Reference / Spells — via `TabBar` (`src/components/layout/`),
local `useState` in `CharacterSheet.jsx`, no router. `CombatBar` (HP/AC/Initiative) is pinned
above the tab content and rendered unconditionally, so it's visible on every tab regardless of
which one is active. `PartySection` still gives Lyra, Quen, each active summon group, and the
Spells tab their own color-coded block with a sticky header (purple/green/amber/blue
respectively) within a tab.

- **Tab 1 — Lyra**: resource trackers (spell slots, wild shape uses, per-day abilities,
  necklace spells), spellcasting reference (save DCs by level, spell attack bonus, caster
  level), ability scores, combat stats, AC, saves, wild shape, skills.
- **Tab 2 — Companions**: Quen's full combat block (HP tracker, AC, saves, attack routine with
  trip note, skills, feats, known tricks), the Summon Builder tool, then active summons with
  per-instance HP and wall of thorns tracking.
- **Tab 3 — Reference**: spell slot summary table, equipment descriptions, feat descriptions,
  the Quicksilver attack routine (rarely used mid-combat, so it moved out of Tab 1).
- **Tab 4 — Spells**: `SpellReferenceTab` (`src/components/spells/`) — searchable reference
  over every sourcebook spell extracted so far (Phase 6, `data/spells/`). Reference only, no
  connection to the prep tracker on Tab 1. See its own section below.

`TabBar` sticks just below `CombatBar`; `PartySection` headers stick below both. Two CSS
custom properties in `index.css` drive the offsets — `--combatbar-height` and
`--tabbar-height` — and both must match their component's actual rendered height, or sticky
headers land at the wrong offset. `partySection.css` stacks them via
`top: calc(var(--combatbar-height) + var(--tabbar-height))`.

Each tab's `window.scrollY` is saved on the way out and restored (via `requestAnimationFrame`,
so it runs after the new tab's content has laid out) on the way in — `scrollPositions` ref in
`CharacterSheet.jsx`, keyed by tab id. Needed once the Spells tab existed: its content height
swings wildly with search/filter state, and without this a switch to/from it would leave
whichever tab you return to scrolled to the wrong spot (the single window-level scroll
container clamps to the shorter tab's height while it's the one showing).

Quen's stat block is computed by `src/lib/calc/companion.js` (`computeCompanionStatBlock`),
verified against the reference numbers in the Quen section below.

**Known CSS gotcha:** `overflow: hidden` on a `PartySection` breaks `position: sticky` on its
header child (changes the sticky containing block). Corner rounding is done on the header/body
elements directly instead — don't reintroduce `overflow: hidden` on `.party-section`.

## Build phases

- **Phase 0** — Setup. Done.
- **Phase 1** — Static character sheet. Done.
- **Phase 2** — Trackers + Supabase. Done. HP, spell slots, wild shape uses, necklace, Fey
  Touched, plane shift, planar bubble, Quen's HP. One "Long Rest" button. Storage adapter with
  Supabase sync (`supabase/setup.sql` + `.env.local`) and localStorage offline fallback.
  Code: `src/lib/storage` (adapter), `src/lib/liveState` (state, actions, React context),
  `src/components/trackers` (UI).
- **Phase 3** — Wild shape calculator. Done. Full polymorph swap against
  `data/creatures/monster-manual.json`, gated by `wildShapeMinLevel`/size/HD caps. Verified by
  hand against Wolf and Unicorn (AC, saves, attack routine, +20 canine speed rule, Ex-only
  ability filtering below PS9). Code: `src/lib/calc/wildShape.js`,
  `src/components/wildshape/`.
- **Phase 4** — Feywild magical beast forms and planar layering.
- **Phase 5** — Summon builder. Done. Simple template → Greenbound → Ashbound/Totemic Summons
  pipeline, verified exactly against the Greenbound Wolf worked example table (base/Advanced/
  Giant). Spell-level reachability picker, both slam and natural-weapon routines, active-summon
  duration tracking. Code: `src/lib/calc/summonBuilder.js`, `data/templates/`,
  `src/components/summon/`.
- **Phase 6** — Bulk sourcebook ingestion via Cowork. In progress. Each sourcebook is
  extracted through the same pipeline: pdfminer bbox column-reconstruction → header/field
  parsing → variant-spell inheritance resolution → parallel-agent paraphrasing → reprint
  cross-referencing against every prior file → assembled into `data/spells/<book>.json`.
  Completed so far (23 files, `data/spells/`): `players-handbook.json` (169), `complete-
  divine.json` (66), `frostburn.json` (59), `spell-compendium.json` (261), `masters-of-the-
  wild.json` (62), `quintessential-druid.json` (35), `quintessential-druid-ii.json` (18),
  `savage-species.json` (18), `planar-handbook.json` (16), `complete-adventurer.json` (17),
  `complete-mage.json` (15), `complete-arcane.json` (12), `complete-champion.json` (12),
  `races-of-the-wild.json` (3), `eberron-campaign-setting.json` (4), `faiths-of-
  eberron.json` (2), `lords-of-madness.json` (4), `serpent-kingdoms.json` (5),
  `sandstorm.json` (52), `players-guide-to-faerun.json` (9), `libris-mortis.json` (2),
  `lost-empires-of-faerun.json` (2), `dragon-magazine.json` (44) — 887 druid spell entries
  total.
  `dragon-magazine.json` is sourced from `Complete Dragon Magazine Compendium.pdf`
  (1,677 pages), itself an unofficial fan compilation — confirmed from its own introduction
  page — that reorganizes spells, feats, and items out of their original Dragon/Dungeon
  Magazine issues into topical chapters, rather than a page-preserving scan of any single
  issue. Its "Spell Descriptions" chapter (printed pp. 2–54) cites each entry only as
  "Dragon Magazine #NNN (Article Title)", with no original per-issue page number recoverable
  — Rae confirmed (Aug 2026) that `page: null` is the right call for all 44 entries rather
  than substituting this compendium's own internal pagination or trying to track down 40+
  individual back-issue PDFs, none of which are in `/sourcebooks`. The compendium's own
  "Druid Spells" summary (printed pp. 58–59) was used to identify the 44 druid-list spells
  (orisons through 8th level); 43 of the 44 came from Dragon Magazine issues #309–#348, and
  one (Dire Reincarnation, 8th level) came from a *Dungeon* Magazine #100 web enhancement,
  flagged via its own `note`. Text extraction used the same pdfminer bbox pipeline as every
  other book, but this compendium's true layout turned out to be **three** narrow columns
  per page, not two — an initial two-column split badly interleaved adjacent spells until
  this was caught and corrected. One entry, Shooting Star (page 42), sits under a decorative
  drop-cap paragraph opening that defeated column-order reconstruction even after that fix;
  its stat block was confirmed from legible fragments, but one uncertain secondary mechanical
  detail was deliberately left out of the description rather than guessed, per this file's
  note. Several entries carry the `[War]` descriptor (Morning Mists, Rolling Fire, Summon the
  Pack and Herd, Plague Cloud, Dispel War Spell, Mire, Small Stronghold) — per the
  compendium's own Appendix 2, war-descriptor spells can't be acquired or cast without the
  War Magic Study feat (Great Fortitude, Iron Will, spellcaster level 3rd, not one of Lyra's
  current feats), flagged on each affected entry rather than silently added to her available
  list. Two entries (Detect Defiler, Revenge of the Land) are built entirely around Dark
  Sun's defiler-score subsystem, which this Greyhawk campaign has no equivalent for —
  flagged as mechanically nonfunctional pending a DM ruling rather than assumed to just work.
  No name collisions with any other file in `data/spells/` — all 44 are genuinely new to the
  library, so every entry's `otherPrintings` is empty. `source` on every entry is just the
  issue (`"Dragon Magazine #309"`, or `"Dungeon Magazine #100"` for Dire Reincarnation); the
  originating article title (`"War Spells – Unleash Arcane Armageddon"`, etc.) lives in its
  own `article` field rather than being folded into `source` the way the rest of this
  paragraph's prose still describes it — this file is the only one in `data/spells/` with an
  `article` field, since it's the only sourcebook here that's itself an anthology of
  originally-separate articles. All 44 descriptions were rewritten to the "length follows the
  spell" standard documented above; see that section for which entries needed the most room.
  `lost-empires-of-faerun.json` (pp. 30, 34) covers Bloodbriars (Drd 4) and Storm Shield
  (Drd 3) — the book's own per-class spell list (p. 29) confirms these are the only two
  true druid-list spells among the ~30 new spells introduced in this chapter; an earlier
  survey had logged 4 for this book, but Rae's manual recount of 2 against the book matched
  the printed class list exactly, so the other 2 were dropped rather than guessed at. Both
  spells' field blocks were split across a page-turn by the book's two-column layout
  (Bloodbriars' Target/Duration/Saving Throw/SR sit at the top of the following page,
  Storm Shield's stay intact on one page) — confirmed via rendered page images rather than
  raw column-sorted text, which is what surfaced this book's own oddity: several leaves
  (printed pages 32–33) are physically duplicated in the PDF, so naive page-range
  extraction produced doubled content that had to be de-duplicated by checking footer page
  numbers directly against the images instead of trusting the file's internal page count.
  Neither spell has a reprint elsewhere in the library. `libris-mortis.json` (pp. 63, 71) covers Death Ward, Mass
  (Drd 9) and Sheltered Vitality (Drd 4) — two of the three druid-list entries on those
  pages, spot-checked rather than pipelined across the whole book. Death Ward, Mass prints
  only its own Range and Targets fields ("functions like death ward, see PHB 217, except as
  noted above"); the rest (components, casting time, duration, save, SR) are inherited
  unchanged from the PHB's Death Ward and its own description embeds a paraphrase of the
  PHB spell per Rae's request. Page 71 has the same column-wrap-to-next-column hazard
  already seen in Sandstorm: a stray paragraph about "charges" and swapping an undead's
  touch effect for temporary hit points sits at the top of column 3, positioned by naive
  reading order right after Spark of Life's real ending — confirmed via rendered page image
  that it's the tail of an unrelated (non-druid) spell carried over from page 70. Spark of
  Life itself (Drd 8 per Libris Mortis, page 71) was deliberately left out of this file —
  its Spell Compendium reprint is Drd 4, a four-level gap large enough that Rae chose to
  drop the Libris Mortis printing rather than carry the discrepancy; Spell Compendium's own
  entry is unchanged and carries no cross-reference to it. Spell Compendium's Death Ward,
  Mass entry also had its previously-`null` `components` field backfilled to
  `["V","S","DF"]`, inherited from the same base-spell relationship confirmed while
  cross-referencing this file.
  `quintessential-druid.json`'s three Friendship spells (Beast/Elemental/Magical Beast) and
  Brother's Staff were corrected per DM/user input (Aug 2026 session): Animal Friendship is
  a retired 3.0 spell with no 3.5 stat block anywhere in the sourcebooks, so its mechanical
  fields are `null` — same pattern as Charm Animal's unresolved reference to Charm Person —
  rather than guessed; Brother's Staff's Spell Resistance is confirmed `"No"`. Player's
  Guide to Faerûn was originally attempted via CHOCR extraction (the PDF has no embedded
  text layer) and abandoned — of its ~74 druid-list spells, all but 3 turned out to be
  reprints with no new stat block in that book. Rae later supplied a hand-curated
  `Player's Guide to Faerun Druid Spell Descriptions.pdf` (6 pages, `/sourcebooks`)
  containing full write-ups for exactly the 9 druid spells with real printed text in that
  book (the 3 new ones — Claws of the Beast, Icelance, Nature's Balance — plus 6 that
  reprint spells already in other files), and this was extracted into
  `players-guide-to-faerun.json`. Several of the reprints have small but real mechanical
  differences from their other printings rather than being verbatim duplicates — Bombardment
  (Spell Compendium states a 40-ft.-high cylinder, 5 ft. of rubble, and a DC 20 Strength
  check to dig free; this printing states none of those specifics), Inferno (Spell
  Compendium's duration is a fixed 6 rounds with a stated material component; this
  printing's is 1 round/level with no material stated), and Wall of Sand (smaller area and
  an easier Strength DC than Spell Compendium's printing, and — as already noted below —
  mechanically distinct from Sandstorm's printing) — each flagged via an `otherPrintings`
  note rather than merged silently. Blindsight's existing Savage Species entry also had its
  Spell Compendium cross-reference backfilled with the structured `spellLevelDruid` field
  (previously a prose-only note) while adding the three-way link to this new file. Eberron
  Campaign Setting's and Lords of
  Madness's same-named "Detect Aberration" entries were determined to be related-but-distinct
  spells (different scope, area shape, and HD breakpoints) rather than one reprinting the
  other — both kept at their own printed level with a disambiguating `otherPrintings` note;
  the same treatment was applied to Sandstorm's Wall of Sand and Wall of Water against their
  Spell Compendium namesakes, which share the name and rough theme but differ enough in
  duration and mechanics (e.g. Fortitude-save-vs-blindness and a Strength check to force
  through, versus Spell Compendium's opaque sense-blocking version with a much longer
  Concentration-based duration) to not be treated as straight reprints. `sandstorm.json`
  (pp. 111–128) is by far the largest single-book haul so far — includes the full
  **Summon Desert Ally I–IX** family (one entry per level, each carrying that level's own
  creature-table options inline rather than as a separate shared table, since the schema is
  one JSON object per spell) plus the **Wall of Magma/Salt/Sand/Water** and **Transmute
  Sand↔Stone↔Glass** clusters. Several multi-column pages had descriptions that wrapped from
  the bottom of one column to the *top of the next*, landing physically above that next
  spell's own title in reading order — this tripped up naive column-sorted extraction
  repeatedly and was resolved each time by checking the block immediately preceding a
  suspiciously-abrupt cutoff. Sourcebooks still unprocessed and sitting in `/sourcebooks`:
  Dungeon Master's Guide v3.5, Forge of War, Manual of the Planes, Monster Manual I & II
  (most of these are not druid-relevant in full — spot-check for druid-list spells before
  running the full pipeline on any of them).
- **Phase 7** — Manual entry for DM-gifted Pathfinder / 5e content.
- **Phase 8** — Three-tab restructure (Lyra / Companions / Reference). Done. Replaced the
  single-scroll layout — see Layout section above for the per-tab breakdown. Added
  `src/lib/calc/companion.js` for Quen's full combat block (AC, saves, attack routine) and
  `TabBar` for navigation. `CombatBar` stays pinned across all tabs.
- **Phase 9** — XP tracking and level-up. Done. See "XP tracking and level-up" section below
  for the full design. Promoted level/XP/HP-rolls/skills/feats/ability-adjustments from
  static `lyra.json` fields to live Supabase-backed `characterProgress` state, so the sheet
  recomputes end-to-end when Lyra levels up — no redeploy needed mid-session.

Phase 2 before Phase 3 deliberately — trackers get used every session.

---

## Spell extraction conventions — DECIDED

Merged in from a parallel Cowork session's project notes (Aug 2026) so both sessions stay in
sync — these decisions weren't previously written into this file.

**Schema** (`data/spells/*.json`, one entry per spell): `name`, `source`, `page` (printed
page, not PDF page), `spellLevelDruid`, `school`, `subschool` (`null` if none), `descriptors`
(array), `components` (array, e.g. `["V","S","M/DF"]`), `castingTime`, `range`,
`targetAreaEffect { type: "target"|"area"|"effect", value }`, `duration`, `savingThrow`,
`spellResistance`, `description` (paraphrased, not full printed text — keep durations,
bonuses, material/focus components, save/SR interactions), `otherPrintings` (array),
`abilityType` (`"spell"` or `"spell-like"` — see below). Use `null` only for fields a book
genuinely doesn't print. `dragon-magazine.json` additionally carries an `article` field (see
Phase 6 log) since that compendium's `source` is just an issue number and the originating
article title needs its own place to live.

**Description length (Aug 2026) — length follows the spell, not a fixed sentence count.**
A two-sentence description is fine for a simple spell; a spell with multiple modes, a
scaling table, or several interacting mechanics should run as long as it takes to cover all
of it — six to eight sentences if that's what the spell needs. The description should still
lead with a sentence or two of the spell's own flavor in original phrasing where the printed
text has any, then give the mechanics in full: every duration, area, bonus, save/SR
interaction, and material or focus component, and every branch of a multi-effect or
scaling spell, not just the most common case. Never reproduce printed text, even in part, and
never compress a table or a multi-option effect down to "see text" in the paraphrase itself —
that's what the source book's `page` citation is for, not an excuse to drop mechanics here.
`dragon-magazine.json`'s 44 entries (Aug 2026) were rewritten under this standard after an
earlier 2–4-sentence pass over-compressed several of them (Lunacy's ten-entry madness table,
Touch of Blibdoolpoolp's and Lash of the Kraken's size-scaling damage tables, Dire
Reincarnation's eleven-outcome roll table, Sunmace's touch-AC/spell-resistance/dispel
interactions, and Throwing Arm of Iallanis's size/range/damage table all needed the extra
room); other files extracted before this convention was written are not being retroactively
re-passed unless a specific spell is flagged as under-detailed.

**`abilityType` (Aug 2026).** Every entry across every file carries `abilityType`, default
`"spell"` — a normal spell drawn from a spell list, with `spellLevelDruid` as its slot cost.
Set to `"spell-like"` for a class-granted spell-like ability instead, and pair it with a
`usage` field (`"at will"`, `"1/day"`, etc.) describing how often it can be used outside the
slot economy. A spell-like entry can still carry a real `spellLevelDruid` if the same ability
is *also* a genuine spell on the druid list — the two facts aren't mutually exclusive.
Current examples, both in `faiths-of-eberron.json`, both granted by Lyra's Planar Shepherd
prestige class rather than the standard druid list: **Detect Manifest Zone**
(`spellLevelDruid: null` — not a druid-list spell at all, `abilityType: "spell-like"`,
`usage: "at will"`, granted at Planar Shepherd 2) and **Intensify Manifest Zone**
(`spellLevelDruid: 7` — it genuinely is also a 7th-level druid spell, `abilityType:
"spell-like"`, `usage: "1/day"`, granted at Planar Shepherd 7 as a spell-like ability on top
of its normal casting).

1. **Each printing shows its own level — DECIDED, supersedes the old lowest-level-default
   rule (Aug 2026).** `spellLevelDruid` on an entry is always that book's own printed level,
   never borrowed from another book. When another printing uses a different level, add
   `spellLevelDruid` directly on that `otherPrintings` entry (`{ source, page,
   spellLevelDruid?, note? }`) — only include it when it differs from the entry's own level,
   so its presence itself signals a discrepancy. Do this symmetrically: if book A's entry
   links to book B at a different level, book B's entry must link back to book A with A's
   level. (Previously the LOWEST printed level was adopted as the one `spellLevelDruid` for
   every file, with the true per-book levels buried in prose notes — this made a file's own
   entry not actually reflect that book's printed level, which was confusing. Retroactively
   fixed across all 11 affected spells: Branch to Branch, Embrace the Wild, Nature's Favor,
   Forestfold, Animate Fire, Wood Rot, Babau Slime, Miasma of Entropy, Buoyant Lifting,
   Countermoon, Plant Body — each file now shows that book's true native level, with the
   discrepancy visible via `spellLevelDruid` on the relevant `otherPrintings` entries.)
2. **Cross-source tracking via `otherPrintings`.** When a spell of the same name appears in
   another file, still extract it in both places, and list every other printing as
   `{ source, page, spellLevelDruid?, note? }`. Verify school matches before treating a
   same-name entry as a true reprint — if school/mechanics differ, it's a different spell;
   flag with a note rather than linking (see `Entomb` in `frostburn.json` vs. Quintessential
   Druid II's unrelated spell of the same name). Reserve `note` for non-level context (a
   mechanical difference, or — as with Detect Aberration in `eberron-campaign-setting.json`
   vs. `lords-of-madness.json` — a scope/audience difference significant enough that the two
   printings aren't quite the same spell); don't use `note` just to restate a level that
   `spellLevelDruid` already shows.

**`savage-species.json`** — done, 18 druid spells (Chapter 6, pp. 60–72). Notable fixes:
Detect Water (on the SS druid list but printed with no description) filled from the identical
Locate Water block; five spells (Buoyant Lifting, Countermoon, Embrace the Wild, Forestfold,
Plant Body) print at a higher druid level in Savage Species than in Spell Compendium — each
entry now shows Savage Species's own native level per rule 1 above, with Spell Compendium's
lower level visible on the corresponding `otherPrintings` entry; three "as \<base spell\>,
except…" entries inherited fields from their base (Forestfold←Camouflage, Improved
Blindsight←Blindsight, Jagged Tooth←Keen Edge).

**Open follow-up work (not started):**
- Backfill `otherPrintings` across all existing spell files — in particular, tag every
  `players-handbook.json` spell that Spell Compendium reprints. This is Rae's broader goal
  (surface every SC reprint of a PHB spell) and hasn't been done yet for files extracted
  before this convention was decided.
- A few `otherPrintings` links are still one-directional (e.g. `spell-compendium.json`'s
  Buoyant Lifting, Countermoon, and Plant Body entries don't yet link back to their Savage
  Species printings) — sweep for and close these gaps.

---

## Spell Reference tab

Consumes `data/spells/*.json` (see above) as the app's first UI on top of the Phase 6
extraction — pure reference, deliberately not wired to the Tab 1 prep tracker.

**Loading.** `src/lib/loadSpellData.js` globs every file under `data/spells/` with
`import.meta.glob` specifically so dropping in a new sourcebook file needs no loader edit —
the extraction pipeline is still adding books. `src/lib/loadCreatureData.js` (Aug 2026) glob
every file under `data/creatures/` the same way, merging them into one flat `monsterManual`
array — except `animal-companion.json`, which it skips by filename since that file holds Quen,
a single companion object, not a creature array. `loadSpellData.js` exports the flat
`rawSpells` array plus `spellFileCounts` (`{ bookTitle: count }`, keyed by each file's own
`source` field rather than its filename — falls back to the filename only if a file loaded
with zero entries to read a title from), which the tab renders as a load report (a one-line
"Spell count: N" plus a collapsed-by-default per-book breakdown) so a truncated or malformed
extraction is visible at a glance rather than silently missing.

**Merging.** `src/lib/calc/spellReference.js` (`mergeSpellEntries`) groups raw entries by
spell name (case-insensitive) into one card per spell. Every sourcebook that reprints a spell
got its own fully-extracted entry in that book's file (own description, own mechanical
fields — these genuinely differ between printings sometimes, e.g. Forestfold's competence
bonus is +20 in some books and +10 in others), so a spell's "printings" are built from those
full entries directly, sorted ascending by level. `otherPrintings` is only consulted to fill
in a printing with no full entry anywhere in the loaded set (a sourcebook not yet processed,
or a stub-only citation) — rendered with a "details not yet extracted" note instead of the
full mechanical block. Source-name matching is normalized (case-insensitive, strips a leading
"The ") only for grouping/filtering — every printing still displays its citation's literal
text — because a book's own `source` field and another book's `otherPrintings` citation of it
don't always agree verbatim (e.g. "The Quintessential Druid II" vs "Quintessential Druid II").

**Source filter grouping.** The dropdown's option list (`sourceBooks` in
`src/lib/spellReferenceData.js`) is built from `groupedSourceLabel()`
(`src/lib/calc/spellReference.js`), not raw `source` strings directly — every Dragon Magazine
issue ("Dragon Magazine #309", "#312", …) and the one Dungeon Magazine entry (#100, Dire
Reincarnation — a web enhancement bundled into the same extraction, not a separate magazine
worth its own option) collapse to one shared "Dragon Magazine" option, since listing each
issue separately would swamp the dropdown. The filter predicate applies the same grouping to
each printing's own `source` before comparing, so selecting "Dragon Magazine" matches every
issue at once. Grouping is filter-only — each printing still displays its own full,
issue-specific citation (source, page, and `article` if present) in the card itself. Add
another prefix pattern to `groupedSourceLabel()` if a similarly multi-issue source (a different
magazine, a multi-volume set) starts crowding the dropdown the same way.

The same grouping applies to the Sourcebooks load report (`LoadReport` in
`SpellReferenceTab.jsx`): `loadSpellData.js` keys `spellFileCounts` by
`groupedSourceLabel(entries[0]?.source)` rather than the raw first-entry source, so a
multi-issue file reports under one title instead of crediting its whole count to whichever
issue happened to load first. `spellFileIssueBreakdown` separately tracks, for any file whose
entries span more than one distinct literal `source`, a `{ issueSource: count }` map keyed by
that same grouped title. `SourcebookRow` renders a plain leaf row for a title with no
breakdown, or an expandable one (collapsed by default) for a title that has one — Dragon
Magazine currently expands to all 16 individual issues (15 Dragon + Dungeon #100), each with
its own count, summing back to the row's total.

**Level disagreement.** A spell's `levels` is the distinct set of non-null
`spellLevelDruid` values across its printings; `levelsDisagree` is true when that set has more
than one member, surfaced as a badge on the card ("Levels differ across printings") — printing
order (ascending by level) already puts the lower-level book first, so the disagreement reads
directly off the stacked printing blocks underneath the badge.

**`functionsAs` / inline reference expansion (Aug 2026).** An entry's `functionsAs` array
(`[{ spellName, source, note? }]`) names spells it functions as — Feathers in
`masters-of-the-wild.json` says it "functions as polymorph other," so its entry carries
`functionsAs: [{ spellName: "Polymorph", source: "Player's Handbook v3.5", note: "..." }]`. A
non-null `source` means the target resolves somewhere in our data; `PrintingBlock` renders the
name as a `FunctionsAsEntry` toggle, collapsed by default, and on tap resolves and renders the
target's own `PrintingBlock` inline directly beneath, indented and left-bordered
(`.functions-as-expansion`) so it reads as a citation rather than a sibling result — nested
inside an `ErrorBoundary` since it's user-triggered recursive rendering of a second entry.
`source: null` means a confirmed dead end — nothing in any edition to link to — rendered as
plain text plus its `note`, not a toggle; no current entry hits this (Animal Friendship, the
one case that used to, got a 3.0-edition text added to `referenced-spells.json` for exactly
this purpose — see below). Resolution (`resolveFunctionsAs` in `spellReferenceData.js`) checks
two pools: a name already in the main list (e.g. Regenerate Light Wounds, cited by its own
book's higher-level variants) returns that book's actual printing off the merged group, matched
by `source` where possible; a name that's reference-only returns a synthetic printing built
straight from its `referenced-spells.json` entry.

**Note-field content (Aug 2026).** `otherPrintings[].note` and `functionsAs[].note` are the
only two `note`-shaped fields actually rendered anywhere in the app (`PrintingBlock` and
`FunctionsAsEntry` in `SpellReferenceTab.jsx`) — creature and feat `note` fields aren't
surfaced by any current UI, so they're free to stay dev-facing. These two are read at the
table, though, so they stay strictly game-facing: what a printing changes mechanically, why a
citation was inferred, what edition a spell is from — never how the JSON was built, assembled,
or organized. No file paths, no "extracted"/"provenance"/"standalone" framing, no referring to
"this entry" as a data object rather than a spell. (A spell's top-level `note` — e.g. the
Vermin-Friendship-adapted mechanics note on Beast/Elemental/Magical Beast Friendship — isn't
rendered at all today, so that constraint doesn't apply there; it's internal documentation like
a code comment, and reads accordingly.)

**`data/spells/referenced-spells.json` and `referenceOnly`.** Holds spells that exist in our
data only so a `functionsAs` link has something to resolve and expand — Antimagic Field,
Contingency, Polymorph, etc. aren't Lyra's own spells. Every entry carries `referenceOnly:
true` and a `spellLevels` array (`[{ class, level }]`) instead of `spellLevelDruid`, since
they're not on the druid list; `PrintingBlock` renders these as wrapped
`spell-printing-classlevel-badge` pills in place of the usual single level pill.
`loadSpellData.js` filters `referenceOnly` entries out of `rawSpells` per-file before they ever
reach `spellGroups` — excluded from the main list, the spell count, level filters, and search —
and out of `spellFileCounts`/`spellFileIssueBreakdown` too, since crediting them to their real
book (most cite "Player's Handbook v3.5") would double-count against that book's own tracked
file. They're collected separately into `referenceSpells` purely for `resolveFunctionsAs` to
look up by name.

**Spell-like abilities.** Each printing carries `abilityType` (`"spell"` or `"spell-like"`,
pulled straight from the raw entry — see Spell extraction conventions above) and, when
spell-like, a `usage` string (`"at will"`, `"1/day"`, …). A printing's badge row shows a
purple `Lv N` pill when it has a real `spellLevelDruid`, a teal `Sp — {usage}` pill when
`abilityType` is `"spell-like"`, or **both together** when an entry is genuinely both (a
class-granted spell-like ability that's *also* a real spell on the list) — Intensify Manifest
Zone shows `Lv 7th` and `Sp — 1/day` side by side, since Planar Shepherd 7 grants it as a
spell-like ability on top of its normal 7th-level druid casting. `"at will"` renders
title-cased (`At Will`) in the badge; other usage strings print as stored. A group's
`hasSpellLike` (true if *any* printing is spell-like) drives the `Sp` filter button, which
matches regardless of whether the entry also carries a level — this is deliberately broader
than the numeric level buttons, which only match a printing actually at that level.

**Spell-like header.** A group headers as "Spell-Like Ability" instead of "Level Unknown"
only when it has *no* numeric level anywhere (`hasSpellLike && levels.length === 0` — Detect
Manifest Zone, not on the druid list at all). A dual entry like Intensify Manifest Zone still
headers under its real level ("7th Level") even when the `Sp` filter is what surfaced it —
the Sp badge on the printing itself is what communicates the spell-like half, so it doesn't
need a special header too.

**Missing fields.** Extraction completeness varies a lot by sourcebook (subschool, descriptors,
components, casting time, range, target/area/effect, duration, save, and SR are null on a
meaningful fraction of entries — `description` and `spellLevelDruid` are the only fields
consistently populated, description always and level all but once). Every field renders `—`
when absent rather than the literal word "null" or a blank gap.

**Layout.** Search-by-name (substring, live), level filter (0–9 buttons plus `Sp`, `All`
default), and source-book filter (`<select>`, `All sources` default) are AND'd together; a
spell matches a numeric level filter if *any* of its printings are at that level (not just its
lowest), and matches `Sp` if *any* printing is spell-like (`hasSpellLike`), independent of
level. No connection to `state.preparedSpells` — this tab doesn't read or write live state at
all.

**Sort order.** Results sort by level first (ascending), then alphabetically by name within
each level, with an `<h4>` header ("Orisons", "1st Level", … "9th Level", "Spell-Like
Ability") wherever the level changes — `sortLevelFor()` in `SpellReferenceTab.jsx`. The level
a spell sorts/groups under depends on which level filter is active: with a specific numeric
level selected, every result shares that level by construction of the filter, so they all
group under one header for it (even a spell whose *other* printings sit at a different level —
e.g. filtering to 4th shows Forestfold under "4th Level" even though its Spell Compendium
printing is 3rd). With `All` or `Sp` selected, a spell groups under its lowest printed level
instead (`typeof levelFilter === 'number'` is the only branch that pins the header level —
`'sp'` falls through to the same "own lowest level" logic as `'all'`), since neither filter
implies one shared level. A spell with no known level anywhere (`levels: []`) sorts last,
headered "Spell-Like Ability" if it's spell-like or "Level Unknown" if it's just a data gap.

**Code-split.** `SpellReferenceTab` is lazy-loaded (`React.lazy` + `Suspense`,
`CharacterSheet.jsx`) rather than imported statically — the ~850KB of extracted spell text
(⅔ of the whole app's JS otherwise) has no business in the bundle everyone downloads to check
Lyra's HP mid-combat on bad venue wifi. Because `loadSpellData.js`/`spellReferenceData.js`/
`calc/spellReference.js` are reachable *only* from `SpellReferenceTab.jsx`, Rollup pulls the
entire data chain into that same on-demand chunk automatically — no manual chunk config
needed, just don't let anything outside `components/spells/` import those three files
directly, or they'll get pulled back into the main bundle. Confirmed via `npm run build`: main
chunk dropped from ~296KB gzipped back to ~139KB (pre-Spells-tab size) with the spell data
landing in its own ~157KB chunk, fetched only on first opening the tab. The `Suspense`
fallback ("Loading spell reference…") is the whole loading state — no separate manual
loading flag needed, since the chunk's own JS/JSON is what's slow to fetch, not something the
component does after mounting.

---

## Spell cards (`/cards`)

A printing tool, not a card viewer — search a spell, compose its card, add it to a print
queue, print. Deployed as its own page (`cards/index.html` → `src/cards/main.jsx` →
`CardsApp.jsx`), not a route inside the main SPA, since there's no router in this project and
a separate Vite multi-page entry is simpler than adding one. `vite.config.js`'s
`build.rollupOptions.input` builds both `index.html` and `cards/index.html`; on GitHub Pages
that lands at `/lyra/cards/`.

**Reference implementation.** `spell-cards-v2.html` (project root) is a working, tested
standalone prototype — the card geometry, type sizes, auto-fitter, and print pagination in
`src/cards/cardRender.js`/`spellCards.css` are ported from it as closely as the React
adaptation allows, not rebuilt from scratch. Its own header comment has the full PSD
measurements (card is 2.233in × 3.265in at aspect 0.684, interior row heights as % of card
height, point sizes per element). **Three things break if changed carelessly, all preserved
in the port:**
1. `@page` can't read CSS variables — the print margin (`margin: .25in`) is a literal in
   `spellCards.css`, hand-kept in sync with `--page-pad-v`/`--page-pad-h`. `var()` there
   silently no-ops and the browser falls back to its own margins.
2. The auto-fitter (`fitWithin` in `cardRender.js`) must run after `document.fonts.ready`
   (`fontsReady()`) — measuring against fallback font metrics sizes cards wrong and text
   overflows once Fira Sans swaps in. Every fit call in the app goes through
   `useFitCards`/`fontsReady()`, never a bare `useEffect`.
3. Interior row heights (`--r-head`/`--r-band`/`--r-stat`) are `calc()` against `--card-h`,
   not percentages — percentage heights collapse inconsistently in a nested flex column across
   browsers.

**Data model.** A spell's mechanical fields (name, level, school, subschool, descriptors,
castingTime, range, components, duration, savingThrow, spellResistance) start out from its
`data/spells/*.json` entry, via `canonicalMechFields()` reading the first printing with a
`full` entry off its `spellGroups` group — but they're editable in the form
(`mechDraft`/`MechFields` in `CardEditor.jsx`), not read-only display, since a card can need a
different class's level than the one Lyra's own druid-only data tracks (see Paste to fill,
below) or a hand-fixed value. Editing never touches the spell's own JSON fields; it's captured
as an optional `card.mech` override — `initialMechDraft()` seeds the form from a previously-
saved `card.mech` if there is one, else from the canonical fields, and `buildCardToSave()`
(`cardRender.js`) only writes `mech` back out when it actually differs from canonical
(`mechFieldsEqual()`), so a card nobody's touched doesn't carry a redundant copy of data
that's already in the entry proper. What you type lives in the rest of that same `card` field:
`{ flavor, primary, secondary, note, table?, continued?, mech? }`, matching
`spell-cards-v2.html`'s own `SPELLS[].card` shape (plus `mech`, new here). `continued` (same
shape, minus its own `continued`/`mech` — the two card faces of a fold pair always share one
set of mechanical fields) is what "continue on second card" fills in — its presence is what
makes a spell render as a `.fold` pair instead of one `.card` (`unitHTML()` in
`cardRender.js`, mirroring the reference's `w: s.card.continued ? 2 : 1` pagination weight).
`table` is `{ head: [...], rows: [[...], ...] }`, built by `TableBuilder.jsx`. `**bold**` /
`*italic*` and blank-line-starts-a-paragraph (`fmt()`) work in every field.

**Paste to fill (Aug 2026).** `PasteToFill.jsx` + `pasteParser.js` — a textarea for a spell's
raw text (stat block and description) copied out of a PDF, parsed offline with pure regex/rule
logic, no API calls. `cleanPastedText()` runs first: normalizes smart quotes/en-dashes, fixes
the handful of common spell-vocabulary words a PDF ligature bug splits with a stray space
(`Refl ex` → `Reflex` — a small known-word dictionary, `LIGATURE_WORDS`, deliberately not a
general "letters space letters" regex, which would just as happily mangle "to flee" into
"toflee"), and strips standalone page numbers and short all-caps running headers.
`parsePastedSpell()` then reads the SRD's own regular structure: name is the first non-empty
line, school the next (parsing `(subschool)` and `[descriptors]` out of it), then the labeled
stat-block lines (`Level:`, `Components:`, `Casting Time:`, `Range:`, `Target:`/`Area:`/
`Effect:`, `Duration:`, `Saving Throw:`, `Spell Resistance:` — matched case-insensitively,
tolerant of no space after the colon). `scanStatBlock()` finds every label line first rather
than walking sequentially, so a field bounds by the *next known label's position* — reliable
regardless of how its own value wrapped across lines — for every field but the last, which has
no next label to bound it and falls back to `looksIncomplete()` (an unclosed paren or a
trailing `+`/`-`/`/`/`,`/"and"/"or") to decide whether to pull in one more line. Everything
after the last label is the description: split into paragraphs on blank lines, hard-wraps
within a paragraph collapsed to spaces; a paragraph starting `Material Component:`,
`Arcane Material Component:`, `Focus:`, `Divine Focus:`, `XP Cost:`, or `Special:` goes to
`note`, the first remaining paragraph to `flavor`, everything else to `primary` — no cleverer
than that, since the fields stay just as easy to hand-edit and reorder afterward as any other.
A `missing` list on the result names every expected label the parser couldn't find, shown
verbatim rather than guessed at; `Target`/`Area`/`Effect` has no card field to land in at all
(the template doesn't display it), so it's surfaced as reference text in the results panel
instead, for writing Primary by hand against.

Since Lyra's data is druid-only, a spell listing several classes (`Level: Drd 3, Rgr 2`)
becomes a radio group in the results — `Drd` is pre-picked when present, else the first class
listed, always switchable before filling. Filling looks the parsed name up in `spellGroups`
by exact case-insensitive match (a faster alternative to searching first, not a replacement
for it — you've already got the full text) and loads that spell exactly like picking it from
`SpellPicker` would, then layers the parse on top via `applyMechPatch`/`applyCardPatch`
(`cardRender.js`) — both apply a field only when the parser actually found something, so a
label the paste didn't have (or that `missing` flags) leaves the existing canonical or
previously-typed value alone rather than blanking it out. A name with no match in `spellGroups`
reports `not found in data/spells/` rather than silently doing nothing.

A paste of several spells' text back to back (detected by more than one `Level:` line —
`splitMultipleSpells()` anchors each occurrence and walks back to the two non-empty lines
before it for that spell's name/school) skips the single-card editor entirely: each block is
parsed, looked up, and — if found — pushed straight to the print queue with a best-effort
save to its file, reporting which spells were added and which were skipped and why.

**Persistence.** Two layers, deliberately different lifetimes:
- **localStorage** (`src/cards/persist.js`) autosaves the current draft per spell name and the
  whole print queue on every change — survives a reload regardless of environment, and is what
  "load it into the editor... rather than starting blank" falls back on before anything's
  reached the repo.
- **The repo itself** — `data/spells/<file>.json`'s own `card` field, via `POST
  /api/cards/save`, a dev/preview-only Vite middleware (`cardSavePlugin` in `vite.config.js`,
  wired into both `configureServer` and `configurePreviewServer`) that writes the file
  directly. `spellNameToFile` (`loadSpellData.js`) maps a spell name to its real filename,
  since `groupedSourceLabel` collapses multi-issue files like `dragon-magazine.json` to one
  title and can't be reversed back to a filename. This endpoint doesn't exist in the static
  build shipped to GitHub Pages — there's no server there — so a failed save is the expected,
  only outcome in production, and `CardsApp.jsx` falls back to copying the card JSON to the
  clipboard instead (`copyCardJSON`). Saving happens on "Save" and again (best-effort) before
  "Add to Print Queue" adds the current card.

**Rendering.** `cardRender.js`'s `headHTML`/`bodyHTML`/`cardHTML`/`unitHTML` build the same raw
HTML strings the reference does (SVGs, markdown-lite paragraphs, the table) and every card face
is mounted via one `dangerouslySetInnerHTML` at its outermost element — never nested React
components inside a `.card`/`.fold`/`.row`, since the auto-fitter's `querySelector('.body')`
calls and the grid/flex geometry both depend on the exact sibling structure the reference
builds, and an extra React-inserted wrapper `<div>` around `.card` or `.fold` would become the
actual grid item inside `.row` instead of the card itself. `PrintSheets.jsx` (the always-
visible, actually-printed output) and `CardPreview.jsx` (the single-card live preview beside
the editor) both call `unitHTML`/`sheetsHTMLFromPages` and then `fitWithin` through
`useFitCards`; `.no-print` (on everything except `PrintSheets`) is what `window.print()`
actually outputs. The overflow flag ("TEXT CLIPPED", red outline) is unchanged from the
reference — any card still overflowing at the 7pt floor after the auto-fitter's nine steps
gets flagged, both in the live preview and in the print sheets, meaning the spell needs
"continue on second card."

---

## Open questions

**Ask the DM:**
1. **Giant owl** — Feywild-native? If yes it becomes an available wild shape form now, with a
   fly speed.
2. **Quen's feats** — two possibly unassigned at 6 HD.
3. **Wolf Shaman later features** — druid 13 and 17 bonus feats are unreachable given the
   progression. Does he want to compress them?

**Needs data:**
4. **Young template exact numbers** — verify −4 Str / −4 Con / +4 Dex / −2 natural armor
   against printed text.
5. **Plane Shift / Planar Bubble** — tracked as 1/day Planar Shepherd abilities in
   `src/data/character/lyra.json`, but the sourcebook they're from is unconfirmed. Fill in
   `source` once known.
6. Levels 9 and 15 add "otherworldly magic [arcane cantrip]" and "Otherworldly Acumen
   [2nd level arcane]" — Fey Touched follow-ons, model later.
