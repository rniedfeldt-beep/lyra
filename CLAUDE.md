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
duration, active wild shape form, Quen's current HP.

## Directory shape

```
/data
  /creatures     monster-manual.json, animal-companion.json
  /templates     greenbound, advanced, giant, young
  /spells
  /feats
  /items
/sourcebooks     PDFs (never read at runtime)
```

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

The DM approved a custom blended table that is **the PHB druid table run straight through all
20 levels**. Valid because druid and Planar Shepherd share identical BAB and save
progressions (3/4 BAB, good Fort, good Will, poor Ref). So BAB and base saves are a pure
function of character level — one lookup table, no multiclass math.

At level 8: BAB **+6/+1**, base Fort 6, base Ref 2, base Will 6.

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
- **Fort** +8 (6 base + 1 Con + 1 Strong Soul)
- **Ref** +6 (2 base + 4 Dex)
- **Will** +12 (6 base + 5 Wis + 1 Strong Soul)
- **Initiative** +4
- **Spell attack bonus** +11 (BAB + Wis mod, DM-confirmed). Compute, don't hardcode — the WIS
  22 tome must update this automatically.
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
  darkwood studs (druid-legal). Leafweave increases the base masterwork studded leather's max
  Dex bonus by 1 (5→6). Reduces arcane spell failure by 5% — irrelevant since Lyra's casting is
  divine, but worth noting on the sheet rather than silently dropping it.
- Heavy wooden shield: +2 AC, −2 check penalty, 10 lb
- Ring of protection: +1 deflection
- Forestwarden Shroud: no penalty in difficult terrain, Tumble, Move Silently
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
| Single attack | **+8** | 1d6+2 |
| Full attack | **+8 / +8 / +3** | 1d6+2 |

The extra attack is a weapon property injection, not an iterative. Build attack routines from
BAB **plus property injections**.

*Player note, not a rule:* Weapon Finesse would take this to +12/+12/+7. Scimitar is a light
weapon and qualifies. Not currently taken.

### Feats

- **Toughness** (L1)
- **Strong Soul** (L1) — +1 Fort and Will; more vs death effects and energy drain
- **Spontaneous Healer** (L3) — substitute any prepared spell for a Cure spell
- **Greenbound Summoning** (L4–5) — Greenbound template on all *summon nature's ally*
  results except elementals (DM-confirmed). **Automatic, not a toggle.**
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

**`lyraFamiliar` (boolean, in `data/creatures/monster-manual.json`)** gates the wild shape
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

**State machine, two phases, tracked in `state.anarchicTemplate`**
(`AnarchicTemplateTracker.jsx`, rendered on Tab 1 right after Wild Shape):
1. **Cast** (swift action, spends a 4th-level slot) opens an invocation window —
   `castWindowMinutesPerCasterLevel` (10) × caster level, so 80 min at CL 8. Minute-based
   countdown (not rounds — these durations are long enough that a rounds-based stepper would be
   unusable) via a plain `-1/+1` stepper, same interaction pattern as every other tracker in
   this app: nothing auto-decrements on a real clock, the player ticks it down themselves.
2. **Invoke** (spends 1 wild shape use, gated on the window still being open) makes the
   template active — `invokedDurationMinutesPerCasterLevel` (1) × caster level, so 8 min at
   CL 8. Own separate countdown.

`endAnarchic` returns straight to `inactive` from either phase (letting the window lapse
unused, or ending the invoked effect early/on expiry) — there's no third "back to cast, window
still open" state; re-invoking means casting again.

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
only by Long Rest, deliberately untouched by `startAnarchicCast`/`invokeAnarchic`/`endAnarchic`
so it persists correctly across multiple cast/invoke cycles in the same day. Bonus damage =
HD, capped at +20 (`computeSmiteLawBonus`) — +8 at CL 8.

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
  Completed so far (18 files, `data/spells/`): `players-handbook.json` (169), `complete-
  divine.json` (66), `frostburn.json` (59), `spell-compendium.json` (261), `masters-of-the-
  wild.json` (62), `quintessential-druid.json` (35), `quintessential-druid-ii.json` (18),
  `savage-species.json` (18), `planar-handbook.json` (16), `complete-adventurer.json` (17),
  `complete-mage.json` (15), `complete-arcane.json` (12), `complete-champion.json` (12),
  `races-of-the-wild.json` (3), `eberron-campaign-setting.json` (4), `faiths-of-
  eberron.json` (2), `lords-of-madness.json` (4), `serpent-kingdoms.json` (5) — 778 druid
  spell entries total. `quintessential-druid.json`'s three Friendship spells (Beast/
  Elemental/Magical Beast) and Brother's Staff were corrected per DM/user input (Aug 2026
  session): Animal Friendship is a retired 3.0 spell with no 3.5 stat block anywhere in the
  sourcebooks, so its mechanical fields are `null` — same pattern as Charm Animal's
  unresolved reference to Charm Person — rather than guessed; Brother's Staff's Spell
  Resistance is confirmed `"No"`. Player's Guide to Faerûn was attempted (CHOCR-extracted,
  since the PDF has no embedded text layer) but abandoned per Rae's instruction — of its ~74
  druid-list spells, all but 3 turned out to be reprints with no new stat block in that book,
  and Rae chose to skip it rather than extract the 3 new ones; no `players-guide-to-
  faerun.json` exists. Eberron Campaign Setting's and Lords of Madness's same-named "Detect
  Aberration" entries were determined to be related-but-distinct spells (different scope,
  area shape, and HD breakpoints) rather than one reprinting the other — both kept at their
  own printed level with a disambiguating `otherPrintings` note. Sourcebooks still
  unprocessed and sitting in `/sourcebooks`: Dungeon Master's Guide v3.5, Forge of War,
  Libris Mortis, Lost Empires of Faerûn, Manual of the Planes, Monster Manual I & II,
  Player's Guide to Faerûn (abandoned, see above), Sandstorm (most of these are not
  druid-relevant in full — spot-check for druid-list spells before running the full pipeline
  on any of them).
- **Phase 7** — Manual entry for DM-gifted Pathfinder / 5e content.
- **Phase 8** — Three-tab restructure (Lyra / Companions / Reference). Done. Replaced the
  single-scroll layout — see Layout section above for the per-tab breakdown. Added
  `src/lib/calc/companion.js` for Quen's full combat block (AC, saves, attack routine) and
  `TabBar` for navigation. `CombatBar` stays pinned across all tabs.

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
bonuses, material/focus components, save/SR interactions), `otherPrintings` (array). Use
`null` only for fields a book genuinely doesn't print.

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
`import.meta.glob` (not named imports, unlike `loadCreatureData.js`) specifically so dropping
in a new sourcebook file needs no loader edit — the extraction pipeline is still adding books.
Exports the flat `rawSpells` array plus `spellFileCounts` (`{ bookTitle: count }`, keyed by
each file's own `source` field rather than its filename — falls back to the filename only if a
file loaded with zero entries to read a title from), which the tab renders as a load report (a
one-line "Spell count: N" plus a collapsed-by-default per-book breakdown) so a truncated or
malformed extraction is visible at a glance rather than silently missing.

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

**Level disagreement.** A spell's `levels` is the distinct set of non-null
`spellLevelDruid` values across its printings; `levelsDisagree` is true when that set has more
than one member, surfaced as a badge on the card ("Levels differ across printings") — printing
order (ascending by level) already puts the lower-level book first, so the disagreement reads
directly off the stacked printing blocks underneath the badge.

**Missing fields.** Extraction completeness varies a lot by sourcebook (subschool, descriptors,
components, casting time, range, target/area/effect, duration, save, and SR are null on a
meaningful fraction of entries — `description` and `spellLevelDruid` are the only fields
consistently populated, description always and level all but once). Every field renders `—`
when absent rather than the literal word "null" or a blank gap.

**Layout.** Search-by-name (substring, live), level filter (0–9 buttons, `All` default), and
source-book filter (`<select>`, `All sources` default) are AND'd together; a spell matches the
level filter if *any* of its printings are at that level, not just its lowest. No connection to
`state.preparedSpells` — this tab doesn't read or write live state at all.

**Sort order.** Results sort by level first (ascending), then alphabetically by name within
each level, with an `<h4>` header ("Orisons", "1st Level", … "9th Level") wherever the level
changes — `sortLevelFor()` in `SpellReferenceTab.jsx`. The level a spell sorts/groups under
depends on which level filter is active: with a specific level selected, every result shares
that level by construction of the filter, so they all group under one header for it (even a
spell whose *other* printings sit at a different level — e.g. filtering to 4th shows
Forestfold under "4th Level" even though its Spell Compendium printing is 3rd). With `All`
selected, a spell groups under its lowest printed level instead, since there's no filter level
to defer to. A spell with no known level anywhere (`levels: []`) sorts last, under "Level
Unknown".

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
