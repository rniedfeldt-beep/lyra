# Lyra — D&D 3.5e Character Assistant

Rebuilt Nov 2026 from the code and data as they actually are. Written for a session with no
memory of how any of this came about: it says what the app does, **why** each decision was
made, which house rules are encoded and where, and which traps have already cost hours.
When code and this file disagree, the code wins — then fix this file.

---

## 1. What this is

A mobile-first web app (React 19 + Vite 8, plain JavaScript, no TypeScript, no router, no test
framework) that does the in-combat math for one D&D 3.5e character at the table, on an
iPhone/iPad: **Lyra**, a half-elf Druid / Planar Shepherd with the Pathfinder **Wolf Shaman**
archetype, in a Greyhawk campaign. Her player (Rae) also keeps a second character, **Vaelith**
(a sorcerer), who only appears in the spell-card tool.

The point is speed. The bottleneck is recalculating attacks, damage, saves and AC when wild
shaping or fielding summons with stacked templates. **Every number on screen is already
computed** — never "add your Str mod". The DM adjudicates house rules (section 6); the app
encodes the rulings and flags, rather than blocks, anything the DM might override.

Deployed to GitHub Pages: `https://rniedfeldt-beep.github.io/lyra/` (main app) and
`/lyra/cards/` (spell-card printing tool). Repo: `github.com/rniedfeldt-beep/lyra`.

---

## 2. Architecture rules and why

1. **No stats in code.** Game data is JSON; code is formulas. Adding a creature, spell or feat
   is a data entry, never a component edit. *Why:* the data is extracted offline from
   sourcebooks and keeps growing; the engine must not need touching for each addition.
2. **Never read PDFs at runtime.** Extraction happens offline (in Cowork) and yields clean
   JSON; `/sourcebooks` is gitignored (copyrighted). The app only consumes clean data.
3. **Every data entry has a `source`** (book, "Pathfinder", "5e import", "DM homebrew") so
   non-3.5e material can be flagged or filtered.
4. **Feats and item properties are effect hooks, not display text.** A feat declares typed
   `effects` (`ability_bonus`, `save_bonus`, `hp_bonus`, `summon_duration_multiplier`,
   `summon_attack_bonus`, `grants_daily_spell`, `grants_spontaneous_conversion`,
   `grants_cast_while_wild_shaped`, `auto_apply_template`) and the engine reads them. A weapon
   property can *inject an attack* into the routine (Quicksilver's speed), not just add a number.
5. **Level is a variable, never a constant.** Character level and class levels diverge (§5.2).
   Ability scores are variable. Nothing derived is hardcoded — HP, BAB, saves, slots, caster
   level and Quen are all recomputed from live progress. (Two exceptions are known gaps, §15.)
6. **Templates compose as a pipeline** of transforms (simple template → Greenbound → feat
   effects), not special cases (§8).
7. **On-screen text describes the game, never the data or the app.** Anything about JSON,
   extraction, sourcebook coverage, phases, how a feature is implemented, or *why* it behaves
   as it does goes in this file, a code comment, or a non-displayed JSON field
   (`implementationNote`, a creature's `note`). Error states say what's wrong in plain words
   ("can't be built right now"); the technical detail goes to the console. Feat JSON
   `description` and `otherPrintings[].note` / `functionsAs[].note` *are* displayed, so keep them
   game-facing. Deliberately still on screen because they state a fact about a spell, not the
   app: "Full stat block not available for this printing", "Referenced spell not available".
   The level-up feat picker shows "Doesn't qualify" / "Check manually" flags with no
   explanation: prerequisites are checked against structured fields, anything unstructured
   needs a human, and a flagged feat stays pickable because the DM can grant it anyway.
8. **State is pure transforms.** Every tracker mutation is a pure `(state, …) => state`
   function in `src/lib/liveState/actions.js`, called through `useLiveState().update()`.
   Components never mutate; derived values (`sheet`, `companion`, `dailyAbilities`) are
   computed, never stored.
9. **Flag, don't block.** XP spend below a level's floor, feat prerequisites, a summon slot
   with none left in the tracker (SNA clamps), unverifiable data: the app warns or labels and
   lets the DM's ruling stand. The one exception: the new Other-Summon-Spells builder disables
   Cast at 0 slots.
10. **Big data stays out of the main bundle.** The spell corpus (~900 kB, ~207 kB gzipped) is a
    lazy chunk (§11); nothing outside `components/spells/` / `lib/spell*` may import
    `loadSpellData`, `spellReferenceData` or `calc/spellReference` statically.

---

## 3. Stack, build, deploy

- `npm run dev` / `build` / `preview` / `lint` (oxlint). **No test suite.** Verification is
  done by (a) `npx vite-node script.mjs` against the pure `src/lib` code (Node can't resolve
  extensionless imports, so plain `node` fails) and (b) the app in a browser, always inside
  **Test Mode** (§4.4) so saved state is untouchable.
- `vite.config.js`: `base: '/lyra/'`, two entries — `index.html` (app) and `cards/index.html`
  (card tool; a second Vite page was simpler than adding a router).
- Deploy: push to `main` → `.github/workflows/deploy.yml` (Node 20, `npm ci`, `npm run build`
  with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` repo secrets → Pages). Check a deploy
  by comparing `assets/main-*.js` in `dist/index.html` with the one served live.
- Local env: copy `.env.example` to `.env.local` (gitignored). The anon key is *meant* to be
  public (it ships in the bundle), but never print or commit `.env.local` anyway.
- `.gitignore` excludes `/sourcebooks/`, `*.bak`, `/tmp_verify/`, `*.local`, `dist`.
- Commit trailer used throughout: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  `git add` specific files — **data files are edited concurrently by another process**
  (Cowork extraction runs while code sessions do), so run `git status`, check mtimes, never
  revert a data file you didn't change, and commit data together with the code that needs it.

### Preview-testing gotchas (browser automation)
- Programmatic `.focus()` doesn't fire in an unfocused pane — dispatch `focusin`/`focusout`.
- React-controlled inputs/selects need the native value setter (`Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,'value').set.call(el,v)`) plus an `input`/`change` event.
- Wrap scripts in IIFEs (top-level `const` redeclaration fails across calls); a line starting
  with `[` after a statement without `;` is parsed as indexing — end lines with `;`.
- "Exit Test Mode" only exists on the Lyra tab. Level 9 has no 6th-level slots, so SNA VI–IX
  creatures (pixie variants, celestial charger) can't be cast in the UI — test them in code.
- The XP-tracker block text is CSS-uppercased; match case-insensitively.

---

## 4. State, persistence, sync

### 4.1 Decision: Supabase is the source of truth
Safari deletes localStorage/IndexedDB after ~7 days without interaction, and sessions run
3–4 weeks apart and often end mid-combat. So live state lives in Supabase; localStorage is
only an offline fallback and mirror.

Tables (`supabase/setup.sql` — run once in the Supabase SQL editor, per project):
- `character_state`: `id` int8 (always 1), `state` jsonb (the entire live blob), `updated_at`.
  Save = upsert row 1. New trackers need no schema change.
- `spell_cards`: one row per `(character, spell_name)` (unique), `mech` and `card` jsonb.
Both have RLS **enabled with a permissive anon policy** — deliberate: the anon key is public,
there is no auth, and the data is a druid's hit points and two friends' spell cards.
**RLS with no policy blocks everything, including the app** — if saves silently fail, check the
policy first.

### 4.2 Client
`src/lib/storage/storageAdapter.js` is the only door: `loadState()` (Supabase, else
localStorage), `saveState()` (writes local, then upserts). `LiveStateProvider`
(`src/lib/liveState/LiveStateContext.jsx`) loads once, debounces saves (400 ms), shows sync
status, and exposes `state`, `update`, `sheet`, `dailyAbilities`, `companion`, `longRest`,
`clearPreparedSpells`, `replaceAll` (import), and the Test Mode functions. Manual JSON
Export/Import is in the Lyra-tab sync bar ("That isn't a valid Lyra export file").

### 4.3 Shape of the live state (`defaultLiveState.js`)
`characterProgress` (§5.5) · `hp {current,temp}` · `spellSlotsUsed {level:n}` ·
`preparedSpells {level:string[]}` · `wildShapeUsed` · `activeWildShapeForm {creatureName,cost}`
· `dailyUses {abilityId:n}` · `companionHp {current}` · `activeSummons[]` (§8.7) ·
`anarchicTemplate {active,durationMinutesRemaining,smiteLawUsed}` · `updatedAt`.
`mergeWithDefaults` backfills any key missing from a saved/imported blob so an old save never
crashes the UI. **Long Rest** re-runs `getDefaultLiveState` (so a new tracker resets with no
extra code) but passes `characterProgress` through untouched and **keeps the prepared-spell
text** (padding blanks if a level-up added slots). Nothing in the app ever refunds a spent use
(unticking a summon box is the one player-controlled exception).

**Derived, never stored:** `sheet` (via `computeEffectiveSheet`) and `companion` (via
`computeEffectiveCompanion`), both recomputed whenever `characterProgress` changes. A level-up
only edits `characterProgress`; everything downstream recomputes for free.

### 4.4 Test Mode
Sync bar → "Enter Test Mode" snapshots state in a ref and **suspends all saving** (no
Supabase, no localStorage). Edits still update the UI. "Reset" restores the snapshot;
"Exit Test Mode" always restores it too — nothing tried can leak into the save. Use it for
every state-mutating check, including automated ones.

---

## 5. The character

### 5.1 Static record — `src/data/character/lyra.json`
A **level-8 seed**: it initialises `characterProgress` the first time the app loads with no
saved state, and is never read for those fields again. The live character has since moved on
(level 9 at the time of writing) — **the saved state, not this file, says where she is.**
Holds: name/race/classes, `trueBaseAbilityScores` (Str 10, Dex 18, Con 12, Int 16, **Wis 19**,
Cha 11), `abilityAdjustments`, `hpRolls`, `skills` (ability + ranks + misc), `feats` (ids),
`equipment` (item ids), speed (30 + 20 enhancement), `planarShepherdAbilities`, `wolfShaman`
(Totem Transformation, Totemic Summons), `wildShape` config, `casterLevel`, `spellDcBase: 15`.

Effective Wis is 20 (+1 inherent from the Fey Touched feat effect). The DM-gifted **Wis tome**
(+2 inherent, "capped at +5 total inherent", one week of game time to read) is in
`abilityAdjustments` with `active: false` — flipping it on in the Ability Score Editor
recomputes saves, DCs, slots and skills.

Derived at level 8: HP 61 · AC 20 / touch 15 / flat-footed 16 · Fort +9, Ref +6, Will +13 ·
init +4 · BAB +5 · spell attack +10 · speed 50 ft.

### 5.2 Class progression — read carefully
Character level and class levels **diverge**: Druid 1–5, then **Planar Shepherd (PS) levels
stack** while Druid stalls at 5 until character level 16.

| Char level | Druid | Planar Shepherd |
|---|---|---|
| 1–5 | 1–5 | — |
| 6–15 | 5 | 1–10 |
| 16–20 | 6–10 | 10 |

`druidLevel(charLevel)` (`rules/dnd35.js`): ≤5 → level; ≤15 → 5; else level − 10.
`classLevelsBreakdown` (`calc/leveling.js`) yields the "Druid N / Planar Shepherd M" split.

- **Scales with CHARACTER level** (druid and PS both advance it): BAB, base saves, spell slots,
  caster level, wild shape uses/HD/size/duration, animal companion.
- **Scales with DRUID level only** (Wolf Shaman): Totemic Summons temp HP, Wolf Shaman bonus feats.

**BAB and base saves are proper multiclass sums** (PHB p.59): `computeProgression`
(`calc/progression.js`) sums each class's own contribution from that class's own level. Druid
and PS share a progression (3/4 BAB, good Fort, good Will, poor Ref), so the same three
formulas apply per class. *Why it matters:* an earlier single lookup keyed by character level
overstated BAB by 1 and understated Fort/Will by 1 at level 8, and was masked by a second bug
(Strong Soul coded +2 instead of +1) that cancelled it — displayed totals were right by
coincidence. Both were fixed together (DM-confirmed).

### 5.3 The sheet pipeline
`computeEffectiveSheet` merges `characterProgress` onto `lyra.json` and calls
`computeCharacterSheet` (`calc/computeCharacterSheet.js`): `computeAbilityScores` (base + feat
`ability_bonus` + active adjustments, each tracked by source) → `computeProgression` →
`computeMaxHp` (Σ hpRolls + n·Con mod + feat `hp_bonus` — Con applies uniformly across history,
a deliberate simplification) → `computeSaves` (base + ability + feat `save_bonus`) →
`computeAC` (10 + equipped items by `acBonusType` + Dex capped by armor max Dex) →
`computeSkills` → `computeSpellSlots` → `computeAttackRoutine`. Caster level, `druidLevel` and
`classes` are recomputed from level every time, so they can't drift.

- **Spell slots** (`calc/spellSlots.js`): base from `src/data/tables/spellSlotsBase.json` (PHB
  druid table, **indexed by character level** — house rule) + `bonusSpellsForLevel(Wis mod)`.
  Orisons are unlimited-use prepared (6), no daily tracker.
- **Skills** (`calc/skills.js`, `tables/skills.json`): every 3.5 skill listed (45), merged with
  Lyra's ranks/misc/label overrides; armor check penalty (armor + shield, −2 from the shield)
  applied to the skills it governs (Swim ×2) and flagged `*`; Trained vs muted Untrained groups;
  **●** marks a class skill for *any* of her classes; Speak Language shows "—". Craft, Perform,
  Profession are single "(any)" rows.
- **Attack routine** (Quicksilver, +2 elven scimitar of speed, 1d6, 18–20/×2): BAB + Str + enh.,
  iterative attacks only at BAB ≥ 6/11/16, and the speed property **inserts an extra attack at
  full BAB** (explicitly doesn't stack with haste — warning shown). Routine at BAB +5: **+7 / +7**,
  1d6+2. (Weapon Finesse would give +11/+11; not taken.)
- **Conditional bonuses** (Handle Animal with companion +2, Ride +5 after Handle Animal, wild
  empathy +4 with canines) are surfaced as text, not baked into totals.

### 5.4 Equipment (`src/data/items/`)
Leafweave Studded Leather (+3, max Dex +6, no check penalty; non-metal) · heavy wooden shield
(+2, −2 check) · ring of protection (+1 deflection) · Forestwarden Shroud (negates undergrowth
penalties on Tumble/Move Silently) · Quicksilver · **Hand of the Oakfather** necklace: six
spells (entangle, barkskin, plant growth, speak with plants, tree shape, goodberry), 1/day each,
**no spell slot** — tracked as independent Daily Abilities checkboxes. Armor and shield are
non-metal (druid-legal). Item JSON may carry `grantedSpells`, `properties`, `warning`.

### 5.5 Live progress and leveling (`characterProgress`)
Fields: `level`, `xp`, `hpRolls[{level,roll}]`, `skills`, `trueBaseAbilityScores`,
`abilityAdjustments[]`, `feats[]` (ids), `classFeatures[]` (free text), `wildShapeUsesPerDay`,
`companionHdRolls[{level,roll}]`. Seeded from `lyra.json`, then Supabase-owned.

- **XP**: `xpForLevel(n) = 1000·n(n−1)/2`; `XpTracker` adds/spends; spending below the current
  level's minimum asks `window.confirm` (3.5e forbids it; the DM may allow it).
- **Level-up** (`LevelUpFlow`, appears when `levelForXp(xp) > level`; never auto-levels):
  1. **HP**: a d8 roll stored as its own `{level, roll}` (free-form input, clamped on blur).
  2. **Ability increase** at levels 4/8/12/16/20; an Int increase only gives skill points for
     *that* level, so the pool is computed against tentative scores including the pending pick.
  3. **Skill points** = 4 + Int mod. **Max rank** (level+3, half for off-list) uses "class skill
     for ANY class" (union in `tables/classSkills.json`); **per-rank cost** (1 vs 2) uses only
     the class whose level is being taken (`classTakenAtLevel`: Druid 1–5, PS 6–15, Druid
     16–20). So Heal/Handle Animal/Ride/Knowledge(religion) cost 2 while PS levels stack in but
     keep the full cap. PS's list is narrower than Druid's; Druid gets Knowledge (religion) by DM
     ruling. Both numbers get their own column.
  4. **Wild shape uses/day**: pre-filled from `tables/wildShapeUsesPerDay.json` (DM-confirmed:
     1 at 5, 2 at 6, 3 at 7–9, 4 at 10–13, 5 at 14–17, 6 at 18–20) but editable.
  5. **Feats / class features**: recorded manually. The picker lists every feat that has a
     mechanical file in `src/data/feats/` (`getFeats` throws on an unknown id) and joins it **by
     name** to the bibliographic catalog in `/data/feats/` for prerequisites and text
     (`loadFeatReferenceData.js`). `calc/featPrerequisites.js` checks ability scores, BAB,
     skills (names normalised: "Knowledge (planes)" ≈ "Knowledge (the planes)"), feats,
     caster level; `classFeatures` and `other` are free text → always "needs check". Status
     `qualifies` / `unqualified` / `needs-check`, shown as badge + colored border, **never
     hidden**. Feats picked earlier in the same session count toward later prerequisites.
  6. **Quen**: a block shows what his progression row grants and one d8 input per new Hit Die.
  Confirm calls `applyLevelUp` + `setSkillRanks`/`addFeat`/`addClassFeature`/`addCompanionHdRolls`.
  Verified 8→9: 5th slot appears, cure critical wounds shows, PS ticks to 4, Druid stays 5.
- The **Ability Score Editor** (`AbilityScoreEditor.jsx`) exposes base scores and every
  adjustment (value, bonus type, source, active) so inherent bonuses and one-offs don't wait
  for a level.
- The original HP rolls for levels 1–8 are a **synthetic reconstruction** (8, then 6s) that
  sums to the true 61; nobody recorded the real ones. Edit them if they surface.

### 5.6 Feats (mechanical files, `src/data/feats/`)
Toughness (+3 HP) · Strong Soul (+1 Fort/Will; rising to +3 vs death/drain isn't modelled) ·
Spontaneous Healer · Greenbound Summoning · Natural Spell · Animal Affinity (+2 Handle Animal,
+2 Ride, shown as skill misc) · Fey Touched (5e; +1 Wis inherent; misty step & charm person
1/day) · Ashbound. Not-yet-taken candidates the picker offers: Dragon Wild Shape, Gatekeeper
Initiate, Planar Wild Shape, Scribe Scroll, Sustain Wild Shape — their "not modelled" caveats
live in a non-displayed `implementationNote`. *Spontaneous Healer*: printed as Wis-mod/day, but
Lyra's Wis is high and the DM ruled cure minor wounds doesn't count — the app shows the
conversions without a counter.

---

## 6. DM house rules encoded (and where)

| Rule | Where |
|---|---|
| Spell slots, caster level, wild shape, companion scale with **character** level, not druid class level | `spellSlots.js`, `computeCharacterSheet`, `wildShape`, `companion.js` |
| PS levels stack with druid for wild shape uses/HD/size/duration — **not** creature type access | `lyra.json` `wildShape`, `getEligibleWildShapeForms` |
| Wild shape uses/day curve | `tables/wildShapeUsesPerDay.json` |
| Feywild-native **magical beasts** from PS 3 (level 8); Feywild elementals/outsiders from PS 9 (level 14); elemental/outsider forms cost **2** uses; **fey forms never** (pixie, satyr) | creature `wildShapeMinLevel`, `wildShapeCost()` |
| Below level 14 a form gives only **Ex** abilities (animals have no Su/Sp; others filter spell-likes + a `KNOWN_SU_ABILITIES` list) | `calc/wildShape.js` |
| Totem Transformation = **permanent** +20 ft movement, no tracker; applies in base form and in `isCanine` wild shapes only | `lyra.json`, `wildShape.js` |
| Totemic Summons: canine summons cast as a **standard action** and gain temp HP = **druid level**; canines only | `summonBuilder.js` |
| **Greenbound Summoning applies to every SNA result except elementals** | `templates/greenbound.json`, `summonBuilder.js` |
| Ashbound: SNA duration ×2, +3 luck attack | feat effects |
| **None of those feats apply to Summon Fey / Dire Hawk / Elementite Swarm** (they name SNA only) — a per-spell flag so the DM can flip it | `tables/summonSpells.json` |
| Young/advanced/giant = **Pathfinder rebuild rules**, canines only (never mix with MM size advances) | `templates/*.json` |
| Orisons unlimited; casting a cure/SNA conversion at levels 1–5 spends a slot of that level | `spontaneousConversions.json`, `TrackersPanel` |
| Druid **Cure progression offset**: light at 1st; moderate/serious/critical at 3rd/4th/5th; no Cure at 2nd | `spontaneousConversions.json` |
| Anarchic template via Iconic Manifestation (Lyra is chaotic neutral) | §7 |
| Quen's armor **reduces his speed to 40**; progression table is the authority | `animal-companion.json` |
| Strong Soul is a PGtF regional feat gifted to the party | feat files |
| Fey Touched ported from 5e | `5e-import.json` |
| Planar attunement is the Feywild (DM uses the 5e interpretation) | `lyra.json` |
| Level-up never auto-applies; XP under the floor and unqualified feats are flagged, not blocked | `LevelUpFlow`, `XpTracker` |
| Knowledge (religion) is a druid class skill | `tables/classSkills.json` |
| **Creature SNA levels: lowest printed wins** (spells use per-book levels — different rule, §13) | §12 |
| Only **one** Wolf Shaman bonus feat is reachable (druid 9 = character level 19) | open question §16 |

---

## 7. Wild shape and the Anarchic overlay

**Wild shape** (`calc/wildShape.js`, `WildShapeCalculator.jsx`). Eligible form = creature has
`wildShapeMinLevel ≤ level`, `lyraFamiliar`, size ≤ max size, HD ≤ max HD. `lyraFamiliar` gates
*only* wild shape (common Greyhawk animals, anything on an SNA list she can cast, DM-approved
Feywild forms) — summoning has no familiarity requirement and uses a separate filter
(`getSummonableCreatures`). Canine forms are grouped first in the picker.

**The polymorph swap.** Retained from Lyra: BAB, base saves, HP, skill ranks, feats, Int/Wis/Cha.
Taken from the form: Str/Dex/Con, size, natural armor, speeds, natural attacks, Ex qualities.
- Attack = BAB + form Str mod + size mod; secondary natural attacks −5.
- A **sole** natural weapon adds **1.5× Str** to damage; with several, primary gets full Str,
  secondaries half. An entry with `primary: false` is treated as secondary even if alone
  (Ur'Epona's hoof).
- Fort = base + form Con + Strong Soul; Ref = base + form Dex; Will unchanged (Wis).
- AC = 10 + size + form Dex + form natural armor + ring (+1). Armor/shield don't carry over.
- Land speed = form's, **+20 only if `isCanine`**.
- `single` vs `full` attack: standard action (best primary, count 1) vs full-round (primary at
  full count + secondaries at −5); the full block is hidden when `hasSecondaries` is false.
- Forms with no attacks (Bat, Toad) show "No attacks in this form" — wild shape has no
  fallback.
- Hit Dice for wild shape purposes never change — she keeps her own.

**One stat block, not two.** While a form is active the main sheet shows its numbers **in
place** (CombatBar, Combat Stats, AC, Saves, Reference-tab Attack Routine): `CharacterSheet`
computes `wildShapeStatBlock` once and passes it down, so each stat has exactly one
`wild ? formValue : base` branch. Reverting nulls `activeWildShapeForm` and every branch
collapses by itself. Changed stats get a 🐾 badge and the base value struck through. The picker
(`Wild Shape Form`) is collapsed by default and rendered into `TrackersPanel`'s
`wildShapeForms` slot so it sits under the use counter it spends from. **Reverting never
refunds a use.**

**Natural Spell** lets her cast while shaped (feat effect; not otherwise modelled).

**Anarchic template** (`templates/anarchic.json`, `calc/anarchic.js`, Manual of the Planes
p.198). An **overlay on Lyra, never a form modifier** — it composes onto whatever stat block is
current and survives wild-shape changes because `state.anarchicTemplate` is a separate key
from `activeWildShapeForm`. Don't couple them. One checkbox ("Iconic Manifestation active")
spends a **4th-level slot and a wild shape use together** and goes straight to the timed
effect (RAW's cast-window/invoke split is documented on the Reference tab but not tracked);
unchecking never refunds. Duration = 1 min × caster level, stepped manually in minutes.
**HD for the template is always her character level** (`computeAnarchicOverlay(hd)` takes it
as a parameter — never wire it to `parseHitDice` of the active form). DR/fast healing by HD:
1–3 none; 4–7 FH 1; 8–11 FH 3; 12+ DR 5/+1 & FH 5. Smite Law 1/day (bonus = HD, cap +20) is
its own resource, reset only by Long Rest. The animal/beast → magical beast note shows only
while invoked *and* currently shaped into such a type. "Use the better of existing DR/FH" is
modelled but a no-op today. UI is split: tracker in the Wild Shape section (Lyra tab), full
write-up in the Reference tab.

---

## 8. Summoning

### 8.1 Two builders, one list (Companions tab)
- **Summon Nature's Ally builder** (`SummonBuilder.jsx`): pick slot level (0 = summon nature's
  minor ally, prepended manually since orisons have no slot entry; spends nothing), pick a
  creature/template loadout, set a quantity (the player rolls it), Summon. SNA clamps a spent
  slot instead of refusing.
- **Other Summon Spells builder** (`SpellSummonBuilder.jsx`): Summon Fey (Drd 1, scalable),
  Summon Dire Hawk (Drd 2), Summon Elementite Swarm (Drd 4). Pick spell → slot → creature →
  Cast; one creature per cast; Cast disables at 0 slots. Config: `src/data/tables/
  summonSpells.json`.
- Both push groups into `state.activeSummons`. A **Summons Out** overview (name, count alive,
  source and slot, rounds left) sits above the per-group sections and has a **Next round**
  button (`advanceSummonRound`) that takes one round off every group (groups at 0 read
  "expired"); each group keeps its own −/+ stepper for corrections. Durations are manual — nothing
  ticks on a clock.

### 8.2 Pipeline (`calc/summonBuilder.js`, `computeSummonStatBlock`)
1. **Simple template** (young/advanced/giant), canines only.
2. **Greenbound**, unless the base creature is an elemental.
3. **Ashbound** and **Totemic Summons**, independent of step 2.
Size resolves first: Greenbound's slam-vs-natural-weapon comparison runs at final size.

Simple templates (Pathfinder rebuild): **Advanced** CR+1, +4 all abilities. **Giant** CR+1 (not
Colossal): size +1, natural armor +3, damage die +1 step, +4 Str, +4 Con, −2 Dex. **Young**
CR−1: size −1, natural armor −2 (min 0), die −1 step, −4 Str, −4 Con, +4 Dex. Spell-level
cost: young −1, advanced/giant +1 (one template at a time). Damage ladder: 1d2 → 1d3 → 1d4 →
1d6 → 1d8 → 2d6 → 2d8 → 3d6 → 3d8.

**Greenbound** (`templates/greenbound.json`): type → Plant (augmented), all HD become d8, natural
armor +6, Str +6 / Dex +2 / Con +4 / Cha +4, gains a slam if it lacked one (damage by size:
Fine 1, Dim 1d2, Tiny 1d3, Small 1d4, Med 1d6, Large 1d8, Huge 2d6, Garg 2d8, Col 4d6 — keep
existing damage if better), DR 10/magic and slashing, fast healing 3, +4 grapple, resist cold &
electricity 10, tremorsense 60 ft., +16 racial Hide/Move Silently in forest; spell-like: at will
entangle / pass without trace / speak with plants, 1/day wall of thorns; CR +2, spell-level
cost +0. **Doesn't recalculate** BAB, base saves or skill points. Fighting unarmed it uses
slam *or* natural weapons — both routines are shown. Greenbound-eligible summons show
`appearanceGreenbound`.

**Verification target** (base wolf: Medium, 2d8+4, AC 14, BAB +1, bite +3 1d6+1, 13/15/15/2/12/6,
Weapon Focus bite): Greenbound 19/17/19, NA +8, AC 21, bite **+9** 1d6+6, ~17 HP, +5 temp;
Advanced Greenbound 23/21/23, AC 23, **+11** 1d6+9; Giant Greenbound Large, 23/15/23, NA +11,
AC 22, **+10** 1d8+9. (Includes Ashbound +3; 1.5× Str because bite is the only weapon.)

### 8.3 Other summon spells — per-spell effect flags
`summonSpells.json` per spell: `slotLevel` (null = scalable), `scalable`, `castingTime`,
`duration` (`roundsPerCasterLevel` + `extraRounds` + label; Fey & Hawk 1 min/level = ×10 rounds;
Swarm = concentration, 1 round/level + 1), and `effects`
`{ greenboundSummoning, ashbound, totemicSummons }` — **all false**, so these creatures appear
**exactly as printed**: no template, no doubled duration, no luck bonus, no temp HP, HP from the
printed Hit Dice line. *Why a flag, not an exclusion:* the DM may later rule these feats apply;
flip a flag and nothing else changes. `computeSummonStatBlock({spell})` takes the spell with
its chosen `slotLevel`; omitted it is SNA with everything on (output was verified identical for
every SNA loadout when this was added). With Greenbound on, the exclusion test uses the *bare*
type, so `Elemental (Air, Swarm)` stays excluded.
- **Pool** (`getSpellSummonPool`): creatures whose `summonedBy` includes the spell's `name`
  (exact string). A scalable spell caps Hit Dice at the slot level (`≤`: 1 HD fey from a 1st
  slot, up to 5 HD from a 5th); the others are fixed-level.
- **Effects ledger**: a stat block where a feat effect applied shows a "Feat effects" box (✓
  applied / ✗ not applied with reason) so a Greenbound summon differs from a plain one at a
  glance. When nothing applied, **no box and no message**. Built in `buildEffectsLedger`,
  stored on the stat block as `effects`.
- **Swarms** can't be crit: their attack `crit` is `null` and any `Swarm`-typed creature's
  attacks read "no critical hits" (other nulls read "crit —"). Spell stat blocks also show the
  creature's `note` sentences (printed errata, how a swarm fits through gaps) after
  `noteSentences()` drops compilation chatter (field names, list membership); extend
  `COMPILATION_NOTE` if new data leaks some.

### 8.4 Hit points, sizes, saves — three places data bit us
- **Hit Dice parsing** (`parseHitDice`): one pool `6d8+18`; fractional `1/2d6-1` (Jermlaine —
  this crashed the whole page once); summed flat terms `7d8+7+9`; **mixed pools**
  `8d10+7d8+75` (racial HD + class levels) → `pools[]`, `count` = total dice, `die` = biggest
  pool, `mod` = summed flat. `averageHpForPools` averages each pool at its own die.
  **An explicit `hitPoints` field beats anything computed — except** under Greenbound or a size
  template (they change Con/HD, so the printed total no longer describes that creature).
  `equipment` entries (the celestial charger's bracers of armor) are documentation only; the
  builder doesn't add them to AC.
- **Sizes are normalised on read.** 3.0 books print "Medium-Size". `normalizeSize` strips a
  `-size` suffix, trims, matches case-insensitively; `loadCreatureData.js` normalises every
  creature and Quen at load, and every lookup goes through `sizeModifier` /
  `grappleSizeModifier` / `sizeIndex` / `normalizeSize` — **never `SIZE_MODIFIER[raw]`**,
  including the Greenbound slam table. (Three Monsters of Faerûn creatures failed to build
  before this.)
- **The base-save table must cover every creature type.** `monsterBaseSaves(type, hd, name)`
  (`rules/dnd35.js`) reads `GOOD_SAVES_BY_TYPE` = the whole of Monster Manual Table 4-1
  (p.290): good = 2 + ⌊HD/2⌋, poor = ⌊HD/3⌋ — Aberration Will; Animal/Beast/Magical Beast
  Fort+Ref; Construct/Ooze none; Dragon/Outsider all; Fey Ref+Will; Giant Fort; Monstrous
  Humanoid Ref+Will; **Plant Fort**; Undead Will; Vermin Fort. Two types aren't a lookup:
  **Elemental** takes its good save from the element subtype (Air/Fire → Ref, Earth/Water →
  Fort; a two-element paraelemental gets the union; a bare `Elemental` reads the element from
  its name) and **Humanoid** ("one good save, varies") is deliberately absent and **throws**
  rather than guessing. A missing type crashes the builder for that creature — when new creature
  data lands, sweep every loadout. Subtypes are stripped with `bareCreatureType()`; use it for
  any plain-name type comparison (the wild shape two-use rule once used an exact match and
  missed `Elemental (Air, Cold)`).
- Saves for a summon are the **creature's own** base progression by type/HD, not Lyra's.

### 8.5 Daily abilities per summoned creature
Every summoned creature shows a checkbox for each limited-use ability from any source
(`limitedUseAbilities(statBlock)`, `calc/summonAbilities.js`, derived at render so old groups
work): the Greenbound template's per-day spell-likes (wall of thorns), only when the template
applied — a Summon Fey pixie shows the pixie's own abilities and no wall of thorns — plus the
creature's own per-**day** abilities parsed from `specialAttacks`/`specialQualities` text
(`name (Sp|Su|Ex, N/day …)` and the spell-like-ability blocks in all their printed layouts:
`at will -- a; 3/day -- b, c`, `(1/day—a, b; caster level …)`, `a, b, and c, each 1/day`,
`x 3/day and y 1/day`). Cooldowns ("once every 10 minutes", "once per round") are not daily
limits and aren't tracked. **Re-check the parser against every pool creature when creature data
changes.** N/day gets N boxes (ticking spends that use and those before it). Uses are stored
**per member** (`member.abilityUses[key]`, `setSummonAbilityUsed`), never per group, and last as
long as the summon. `usedUses()` still reads the legacy `wallOfThornsUsed` boolean.

### 8.6 Stat block display (shared by both builders)
`SummonStatBlock` shows ability grid, saves, AC/touch/flat-footed, initiative, speed, both attack
routines, the creature's full `specialAttacks`/`specialQualities` (rendered through
`AbilityText`, so spell names expand) with Greenbound additions tagged by a `Greenbound` pill,
the `skills` sentence, and a collapsed "Appearance & Behavior". Everything is conditional — a
missing field omits its piece, and a group saved before a field existed still renders. The
preview defaults **collapsed**; an active group's block defaults **expanded**.

### 8.7 Active-summon state
A group = `{ id, label, remainingRounds, hpMax, tempHpMax, greenboundEligible, source, statBlock,
members[] }`, `source = {kind:'sna'|'spell', slotLevel, spellId?, spellName?}` (older groups
without it read as SNA). The **full stat block is stored at cast time** (never recomputed).
Members: `{ id, hp, tempHp, status: active|dead|dismissed, abilityUses }`. **Each cast is its
own group, even for the same creature** — never merge by name; durations, HP and uses are
independent. Group headers read `Dire Rat (Greenbound) ×2 — 12 rounds left`.

**Crash-proofing.** The stat block is computed inside a try/catch in the builder (an
ErrorBoundary can't catch its own component's render) and shows "can't be built right now" with
Cast/Summon disabled; every stat block, active group, Quen's panel and each builder is wrapped
in `ErrorBoundary` (`components/ErrorBoundary.jsx`, logs to console).

---

## 9. Quen — animal companion (wolf, mandated by Wolf Shaman)

`data/creatures/animal-companion.json` holds `baseCreature` (2d8+4, NA +2, 13/15/15/2/12/6), a
7-row `progressionTable` (by `levelRange`), his armor (Custom Masterwork Wooden Studded Honey
Leather: +2 armor, max Dex +5, no check penalty, **speed 40**), tricks and abilities. Effective
druid level = **character level** (PS stacks). `computeEffectiveCompanion(companion, level,
hdRolls)` (`calc/companion.js`) applies every column: bonus HD (d8 + Con each), natural armor,
Str/Dex adjustment (**+2 at 6–8, +3 at 9–11, +4 at 12–14** — the table is the authority; change
the table, not code, if the DM disagrees), BAB = ¾ of total HD, bonus tricks, cumulative special
abilities (Link, Share Spells, Evasion, Devotion, Multiattack at 9…). Saves use the Animal
progression by total HD; initiative = Dex mod. The record's top-level `abilities`, `hitDice`,
`naturalArmor`, `baseAttackBonus`, `bonusHD`, `bonusTricks`, `specialAbilities`,
`companionLevel` are a **level-8 snapshot and are overridden**; level 8 reproduces them (AC 21,
bite +7 1d6+3 plus trip, init +3, 45 HP).

**Max HP can't be derived**: `hp.max` 45 is the baseline at the snapshot; each bonus HD past it
needs a d8 roll recorded in `characterProgress.companionHdRolls`, max HP = 45 + Σ(roll + Con).
He gains HD on entering a new row (character levels 3, 6, 9, 12, 15, 18 — two dice each); the
level-up flow asks for the rolls; a die with no roll adds nothing and shows a "no HP roll yet"
warning (`hdPending`). Devotion = +4 morale vs enchantment (his Will is the weak save). Trip:
free action on a bite hit, +1 check mod, no touch attack, no AoO. +4 racial Survival by scent.
Quen's stat block is `computeCompanionStatBlock`; shown by `CompanionPanel` (ability scores,
Initiative/BAB/Grapple/Hit Dice, abilities, tricks).

---

## 10. Spell preparation

Lyra has the whole druid list and re-prepares after every rest, so prepared spells are **not
data**: `state.preparedSpells {level: string[]}` — one free-text slot per prepared spell
(orisons + each level's `total`). Each slot (`PreparedSpellSlot.jsx`) is free text **plus** an
optional pick-list: after 2 characters it offers up to 8 spells of that slot's druid level
(`suggestSpells`, `lib/preparedSpellSearch.js`); picking fills the canonical name but **nothing
forces a selection** — unmatched text is normal (the DM gifts spells from unextracted books)
and just gets no description. A slot naming any extracted spell shows a chevron expanding its
full reference entry. Long Rest keeps the text; a separate **Clear prepared spells** button
wipes it.

**Always available, outside prepared slots** (`tables/spontaneousConversions.json`): per level,
the Spontaneous Healer cure conversion and the SNA conversion (pills labelled "Always
available"; casting one still spends a slot of that level except at orison level). Separate
`alwaysAvailable` list = at-will spell-like abilities with no slot and no limit, shown under
**"At-will"** (Detect Manifest Zone, PS 2; its description is pulled from `data/spells/` by
`spell` name, lazily).

**Expandable spell references everywhere**: any named spell is expandable, collapsed by
default, with the same entry as the Spells tab (`components/spells/SpellRef.jsx`:
`SpellPillGroup`, `SpellRefWith`, `SpellRef`, `AbilityText`, `RichText`) — conversions, Daily
Abilities (necklace, Fey Touched), feat text (`*italics*`), summon and wild shape abilities,
Greenbound spell-likes. **A spell with no entry renders plain text — no toggle, no empty
block**, the normal case for most arcane spells. Lookup (`lib/spellLookup.js` →
`findSpellByName`) searches the druid extraction then `referenced-spells.json`, lazily, so names
upgrade in place once the chunk arrives. Creature ability text is free prose, so
`lib/spellMentions.js` only looks in three zones (never the whole string — "immune to sleep"
isn't the spell): (1) the leading name of an `(Sp …)` or short `(Su …)` ability; (2) after a
pointer phrase ("as the X spell", "functions as", "as though by", "like a", "with"); (3) the
whole body of a "spell-like abilities …" entry. A name must end its phrase ("polymorph self" ≠
polymorph). Extend the zones, don't scan wider.

---

## 11. Spell Reference tab and spell data

**Layout/loading.** `loadSpellData.js` globs `data/spells/*.json` (drop in a new book file, no
loader edit), validates and sanitises entries, and exports `rawSpells`, `referenceSpells`,
`spellFileCounts` (rendered as a load report) and `spellNameToFile`.
`calc/spellReference.js#mergeSpellEntries` groups raw entries by name (case-insensitive) into
one card per spell with **printings** sorted by level; `otherPrintings` only fills printings
with no full entry anywhere. Source filter groups every Dragon/Dungeon Magazine issue under
one "Dragon Magazine" option (`groupedSourceLabel`; filter-only — each printing keeps its full
citation). Level disagreement badge when a spell's printings differ. `functionsAs`
`[{spellName, source, note?}]` renders an inline expandable of the target's entry (non-null
`source` resolves via `resolveFunctionsAs`; null = plain text + note). `referenced-spells.json`
holds `referenceOnly: true` entries (Polymorph, Antimagic Field…) that exist only so links
resolve — excluded from the list, counts and filters. Search is substring; filters (level 0–9,
`Sp` for spell-likes, source) AND together; results sort by level then name with level headers
(a numeric filter pins the header level; "All"/"Sp" use each spell's lowest). Missing fields
render `—`. The tab is `React.lazy`'d, which pulls the whole data chain into one on-demand chunk
(main bundle ≈ 125 kB gz; the spell chunk ≈ 207 kB gz — check `npm run build` output after touching imports; the main chunk growing by hundreds of kB means a static import leaked).

**Spell schema** (`data/spells/<book>.json`): `name`, `source`, `page` (printed page, not PDF
page; `null` for the Dragon Magazine compilation, which has no recoverable per-issue page),
`spellLevelDruid`, `school`, `subschool`, `descriptors[]`, `components[]`, `castingTime`,
`range`, `targetAreaEffect{type,value}`, `duration`, `savingThrow`, `spellResistance`,
`description` (paraphrased, never printed text — **length follows the spell**: every duration,
area, bonus, save/SR interaction, component and every branch of a multi-mode spell, never "see
text"), `otherPrintings[]`, `abilityType` (`spell` | `spell-like`; spell-like adds `usage`
"at will"/"1/day" and may *also* carry a real level — Intensify Manifest Zone is both). Optional:
`functionsAs`, `scalable`, `article` (Dragon Magazine only), `note`. `null` only for fields a
book genuinely doesn't print.

**`otherPrintings` for spells:** each printing shows **its own book's level** (`spellLevelDruid`
on the entry), and a differing level is recorded on the `otherPrintings` entry, symmetrically in
both books. (Creatures use a different rule — §12.) Verify school before treating a same-name
entry as a reprint; if mechanics differ it's a different spell (Entomb in Frostburn vs QD II).
`[War]` spells need War Magic Study and Dark Sun defiler spells have no equivalent here — both
flagged on the entry, not silently added.

**Coverage** (906 entries / 25 files incl. 12 reference-only): PHB 175, Spell Compendium 261,
Complete Divine 66, Masters of the Wild 62, Frostburn 59, Sandstorm 52, Dragon Magazine 44,
Quintessential Druid 35 + II 18, Savage Species 18, Complete Adventurer 17, Planar Handbook 16,
Complete Mage 15, Complete Arcane 12, Complete Champion 12, PGtF 9 (hand-curated from a 6-page
PDF; the book has no text layer), Serpent Kingdoms 5, Eberron CS 4, Lords of Madness 4, Races
of the Wild 3, Faiths of Eberron 2, Libris Mortis 2, Lost Empires 2, Kingdoms of Kalamar 1
(Summon Fey). Not yet processed: DMG, Forge of War, Manual of the Planes, MM I/II spells.
Open spell-data chores: backfill `otherPrintings` for older files (esp. every PHB spell the
Spell Compendium reprints) and close one-directional links.

---

## 12. Creature data

`data/creatures/<book>.json` — one array per book, merged by `loadCreatureData.js`
(`import.meta.glob`, so a new file is picked up automatically); `animal-companion.json` (an
object, not an array) is Quen and is excluded from the merge. 185 creatures, 171 with an SNA
level, 65 wild-shape-eligible, 17 with `summonedBy`. `build_sna.py` is the Python helper that
generated the first MM entries; `*.bak` is gitignored.

**Fields:** `name`, `source`, `page`, `size` (normalised on read), `type` (with subtypes in
parens), `hitDice` (printed string), `speed{land,fly,swim…}`, `naturalArmor`, `abilities`,
`baseAttackBonus`, `attacks[{name,natural,primary,count?,damage,crit}]` (`crit` `null` when none
printed or when immune), `specialAttacks[]` / `specialQualities[]` (free text with mechanics in
parens — see §8.5, §10 for who parses it), `skills` (one sentence), `feats[]`, `challengeRating`,
`isCanine`, `feywildNative`, `summonNaturesAllyLevel`, `wildShapeMinLevel`, `lyraFamiliar`,
`appearance`, `appearanceGreenbound`, `behavior`, `note` (dev-facing, **not displayed** except
the filtered sentences on spell-summon stat blocks), `otherPrintings`, `summonedBy[]`,
`hitPoints`, `equipment[]`. A creature missing an optional field must still render.

**Conventions (DECIDED Nov 2026):**
- **`summonNaturesAllyLevel` and `summonedBy` are independent.** A creature can be on SNA lists
  *and* reachable through Summon Fey. One never implies or nulls the other. (A wrong "null the
  SNA level of anything Summon Fey makes" instruction once stripped levels from Dryad, Grig
  and Pixie; it was reverted.)
- **Lowest SNA level wins.** When sources disagree, `summonNaturesAllyLevel` holds the lowest
  printed level and the other printings go in `otherPrintings` as `{source, page,
  summonNaturesAllyLevel}`. Sources compared: PHB v3.5 p.288 (levels 1–9) and Dragon Magazine
  #302 p.28 — **#302 is a CR-sorted rebalance, not a reprint**, so broad disagreement is expected
  (13 creatures drop to #302's level; 37 keep PHB's with #302 recorded). Creatures on one list
  only take that level (Dog I, Pegasus IV — #302 only). *(Spells use per-book levels instead; the
  two conventions are deliberately different.)*
- **Variants are separate entries, one per printed capability set.** The pixie is
  `Pixie (no special arrows)` SNA V (PHB VI recorded), `Pixie (sleep arrows)` SNA VII,
  `Pixie (sleep and memory loss arrows)` SNA IX (also has Otto's irresistible dance). Only the
  last — the full printed pixie — carries `summonedBy: ["Summon Fey"]`; the others are
  SNA-specific constructs.
- **`summonedBy` values must equal a spell `name` in `summonSpells.json`.**
- **Mixed Hit Dice** keep the printed `hitDice` string verbatim, add `hitPoints`, and a `note`.
- `isCanine` drives the +20 ft speed, young/advanced/giant availability and Totemic Summons.
- Summon nature's minor ally (level 0): eight creatures tagged `summonNaturesAllyLevel: 0`
  (illustrative — the spell allows any qualifying animal); no special-casing in code.
- Known data caveats: Aranea's feats/CR were unreliable to extract; Thoqqua's type was assigned
  `Elemental (Earth, Fire)` from memory; Hybsil's printed shortbow bonus doesn't reconcile with
  its BAB (recorded as printed); the earth/water elementite swarms' printed initiative/saves
  look misprinted (shown in Notes).

---

## 13. Feat reference data
Two deliberately separate catalogs, joined **by feat name**: (a) `src/data/feats/<id>.json` —
mechanical effect hooks for feats Lyra has or might take (`id`, `name`, `source`, `levelTaken`,
`description` (displayed), `effects[]`, optional `implementationNote`); (b) `/data/feats/
<book>.json` — bibliographic catalog, one file per book (`name`, `source`, `page`, `type`,
structured `prerequisites{abilityScores, baseAttackBonus, skills, feats, classFeatures,
casterLevel, other}`, paraphrased `benefit`, `repeatable`, `note`, optional `grantedSpells`).
14 catalogued feats across 9 non-empty files; `players-handbook-ii.json` is an empty array left
over from a wrong source guess (Strong Soul is PGtF). Gatekeeper Initiate grants nine spells at
1–9 (three are the book's own; six are standard PHB spells newly extracted with
`spellLevelDruid: null` and a note); Initiate of Nature grants spells (Mold Touch, Briartangle,
Thorn Spray, Tree Healing) that aren't extracted yet.

---

## 14. The spell-card tool (`/cards`)

A **printing tool**, not a viewer: search a spell → compose its card → add to the print queue
→ print. Its own page (`cards/index.html` → `src/cards/main.jsx` → `CardsApp.jsx`).
`spell-cards-v2.html` (project root) is the **reference implementation** the card geometry,
type sizes, auto-fitter and pagination were ported from, measured from a PSD at 300 dpi: card
**2.233in × 3.265in** (aspect 0.684), interior rule positions as % of card height (header
18.07%, school band 27.16%, stat rows 39.31%/51.51%, description the remaining 48.49%), point
sizes (name 17.8, level numeral 23.6 Fira Mono Bold, school 13.6, components 13.3, values 9.6,
ST/SR 6.8, body 6.6–9.7), school colours from `[data-school='…']` (nine). Don't change card
dimensions, proportions or sizes.

### The three template gotchas (each one silently breaks cards if edited carelessly)
1. **`@page` cannot read CSS variables.** `var()` there silently no-ops and the browser falls
   back to its own margins. The print margin is a **literal** (`margin: 0.25in`) and the print
   `.sheet` padding is the literal remainder (`0.75in 0.15in` → 1in top / 0.4in sides total).
   Keep them in step by hand with `--page-pad-v/-h`.
2. **The auto-fitter must run after `document.fonts.ready`.** Measuring against fallback font
   metrics sizes cards wrong and text overflows once Fira Sans swaps in. Every fit goes through
   `fontsReady()` / `useFitCards` / `PrintSheets`' effect — **never a bare `useEffect`**.
   (`fitWithin`: nine body steps from 11pt down to a 7pt floor, narrowing Fira Sans → Condensed
   → Extra Condensed; name and school shrink separately; fold pairs fit to the same step; a card
   still overflowing at the floor is flagged "TEXT CLIPPED" — it needs "continue on second card".)
3. **Percentage heights collapse inside nested flex columns.** Interior row heights are
   `calc(var(--card-h) * 0.1807)` etc. (`--r-head`, `--r-band`, `--r-stat`), not percentages —
   browsers resolve percentage heights inconsistently in a nested flex column.

### Other card-rendering rules
- Card faces are built as **raw HTML strings** (`headHTML/bodyHTML/cardHTML/unitHTML`) mounted
  by one `dangerouslySetInnerHTML` at the outermost element — never nested React components
  inside `.card`/`.fold`/`.row`: the fitter's `querySelector('.body')` and the grid depend on
  exact sibling structure, and a React wrapper `<div>` would become the grid item instead of the
  card. `PrintSheets` (the printed output; the only thing not `.no-print`) and `CardPreview`
  both use it. Six upright cards per sheet; a fold pair (continued card) weighs 2 and stays on
  one row (`paginate`).
- **School colour key**: `normalizeSchoolKey()` trims invisible characters and strips
  `(subschool)`/`[descriptor]` before lowercasing — any stray NBSP or zero-width character breaks
  the exact-match attribute selector *silently* (the card just loses its colour; the school
  still reads correctly everywhere else).
- **Level hexagon**: tilted and pinned to the card's top-right as a sibling of `.card-head`
  (a direct child of `.card`, `position:absolute`), with `.level-spacer` reserving width so the
  name fitter shrinks away from it. The geometry is *computed* (`HEX_ROTATE_DEG`, `HEX_R` →
  rotated vertices baked into the SVG `points`, `viewBox` from the rotated bounding box), and
  the numeral is a `<text>` **inside the same SVG** at (0,0). *Lesson (two rounds of bugs):*
  one coordinate system — never position a shape and its label with two mechanisms.
  Retune via `HEX_ROTATE_DEG`/`HEX_R`/`HEX_BOX_W_IN`; nothing about its size lives in CSS.
- Form labels (Flavor, Main description, Mechanics, Material Component/Focus) don't match the
  `card` keys (`flavor`, `primary`, `secondary`, `note`) — those are also print-CSS class names,
  so they're not renamed. `**bold**`, `*italic*` and blank-line paragraphs work (`fmt()`).
  Component pills: V, S, M, DF, F, `M/DF` (its own token), XP, joined in fixed order.

### Data model and persistence
A card = mechanical fields (`mechDraft`: name, level, school, subschool, descriptors,
castingTime, range, components, duration, savingThrow, spellResistance — all editable, since
a card may need another class's level or come from a spell not in `data/spells/`) + a `card`
block `{flavor, primary, secondary, note, table?, continued?, mech?}` (`continued` makes a
fold pair; `table` is `{head, rows}` from `TableBuilder`). Editing never touches `data/spells/`.
`CardsApp.baseFor(name, group)` picks what a loaded card starts from, in priority: (1) a saved
Supabase card **for the current character**; (2) the `data/spells/` canonical fields
(fallback only, never required); (3) blank. Saved cards live in `spell_cards`
(`supabaseCards.js`, same client pattern and env vars as `character_state`); every reader
degrades gracefully on failure (warn + `[]`), `saveCard` throws and `CardsApp` shows a
non-blocking status; **printing never depends on a save succeeding**. `CharacterPicker` seeds
Lyra/Vaelith plus any saved character; both players see all cards (no login). Local-only: the
autosave draft per `${character}::${spell}` (`persist.js`) and the print queue (per-device).
(Old, removed: cards used to be written into `data/spells/*.json` through a dev-only Vite
middleware that 405'd in production; Supabase is now the only path.)

**Editor state rule:** one card in the editor at a time and nothing survives past relevance —
`clearEditor()` runs after a queue-add and on every character change; "New Card" opens a
blank form. Paste/load paths always compute a fresh `baseFor()`.

**Paste to Fill** (`PasteToFill.jsx`, `pasteParser.js`; pure regex, no API): `cleanPastedText`
normalises exotic spaces (NBSP/U+2007/U+202F → space), strips zero-width characters and BOM,
smart quotes/dashes, a small known-word dictionary for PDF ligature splits (`Refl ex`), and
page numbers / *versioned* running headers (a short all-caps line only counts as a header with a
trailing version tag — all-caps alone also describes a spell name). `parsePastedSpell` takes
name and school as the **last two non-empty lines before the stat block** (anything above is
ignored positionally; one line = name+school split on 2+ spaces or ` - `), `toDisplayCase`
fixes all-caps (only when it really is all-caps), `scanStatBlock` finds every label first so a
field bounds at the *next label's position*; the last field uses `looksIncomplete()` (unclosed
paren, trailing `+`/`-`/`,`/"and"/"or"). Description paragraphs: `Material Component:` / `Focus:` /
`XP Cost:` / `Special:` → `note`, first remaining → `flavor`, rest → `primary`. A `missing` list
is shown verbatim. Multi-class `Level:` lines become a radio group (Drd preselected).
**Filling never gates on `data/spells/`** (an early version no-op'd for unknown names — which
is most of Vaelith's sorcerer spells); a non-match shows neutral text, not an error. Several
spells pasted back to back (more than one `Level:`) go straight to queue + Supabase.

---

## 15. Layout

Four tabs via `TabBar` (local `useState`, no router): **Lyra / Companions / Reference / Spells**.
`CombatBar` (HP/AC/Initiative) is pinned above every tab. `PartySection` gives Lyra, Quen,
each summon and the Spells tab their own colour-coded block with a sticky header.
- **Lyra**: Trackers card in this order — sync bar (Export/Import/Long Rest/Test Mode), XP, HP,
  spell slots, **Prepared Spells** (collapsed, "prominent" toggle), Wild Shape uses, **Wild
  Shape Form** (collapsed, prominent), Daily Abilities — then spellcasting reference, Ability
  Score Editor, combat stats, AC, saves, skills.
- **Companions**: Quen → SNA builder → Other Summon Spells builder → Summons Out → active groups.
- **Reference**: spell-slot table, equipment, feats, Anarchic reference, Quicksilver attack
  routine (rarely used mid-combat).
- **Spells**: `SpellReferenceTab` (lazy).
Each tab's `scrollY` is saved on leave and restored via `requestAnimationFrame` (the Spells tab's
height swings with its filters).

**CSS gotchas.** `overflow: hidden` on a `PartySection` breaks `position: sticky` on its header
(changes the sticky containing block) — round corners on the header/body elements instead.
`--combatbar-height` and `--tabbar-height` (`index.css`) must equal the components' real rendered
heights or sticky headers land at the wrong offset (`partySection.css` stacks them).

---

## 16. Built vs deferred

**Built and working**
- Static sheet; trackers (HP, slots, wild shape, daily abilities, Quen HP, Long Rest);
  Supabase sync with offline fallback, export/import, Test Mode.
- Wild shape (full polymorph swap, one-stat-block display); Anarchic overlay.
- SNA builder with the full template pipeline; Other Summon Spells builder; per-instance HP and
  daily-ability tracking; Summons Out + Next round; effects ledger.
- XP tracking, level-up flow, ability score editor, skill purchase, feat picker with prerequisite
  flags, Quen's table-driven progression with HP-roll prompts.
- Spells tab over 894 extracted spells; prepared-spell search; expandable spell references
  everywhere; all 45 skills listed.
- Spell-card tool: composer, paste parser, Supabase persistence, auto-fit, print sheets.

**Known gaps — real, not hypothetical**
- **Wild shape size/HD caps don't scale.** `lyra.json` `wildShape.maxSize` (Large) and `maxHd`
  (8) are static; only `usesPerDay` updates at level-up. Past level 8 the HD cap should rise
  (effective druid level = character level) and Huge arrives at 15.
- **`spellDcBase: 15` is static** (the spell-slot summary and per-level DCs read it), so the
  Wis tome or any Wis change won't update save DCs — spell *attack* bonus is computed.
- **Paraelementals/Thoqqua/Ice Serpent/Galeb Duhr get Greenbound in the SNA builder**: only a
  bare `"Elemental"` type is excluded there (the new builder uses the bare type). Ask the DM
  which is intended before "fixing".
- Level-up can't buy a first rank in a skill she has no entry for.
- Summon builder doesn't add `equipment` AC (celestial charger) or creature feats (Improved
  Initiative) to its stat block.
- SNA VI–IX creatures can't be cast in the UI until Lyra has slots that high.
- Phase-6 sourcebook extraction is unfinished (§11); Mold Touch, Briartangle, Thorn Spray and
  Tree Healing aren't extracted.
- Not modelled by design: Natural Spell's casting rules, Strong Soul's +3 vs death/drain,
  Planar Wild Shape and the other candidate feats' effects (`implementationNote`s).

**Deferred / later**
- Fey Touched follow-ons (level 9 "otherworldly magic" cantrip, level 15 "Otherworldly
  Acumen") — not modelled.
- Wolf Shaman bonus feat at level 19 is recorded by hand as a class feature.
- Greenbound/Ashbound/Totemic for the other summon spells: flags exist, all off.

**Open questions for the DM**
1. **Quen's feats** — at 6 HD he's entitled to three but shows two (Track, Weapon Focus bite).
2. **Wolf Shaman bonus feats** at druid 13/17 are unreachable under the progression — compress?
3. **Young template numbers** — verify −4/−4/+4/−2 NA against the printed text.
4. **Plane Shift / Planar Bubble** (1/day PS abilities) — sourcebook unconfirmed.
5. **Grig** — one entry at SNA II (the lowest, Dragon #302; PHB's IX recorded), but it always carries the fiddle that the notes say only the IX grig has. Split into variants like the pixie?
6. **Paraelementals and Greenbound** (above).
