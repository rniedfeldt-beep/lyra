import json

def load(fp):
    return json.load(open(fp, encoding='utf-8'))

def save(fp, data):
    json.dump(data, open(fp, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

def find(data, name_substr, page=None):
    matches = [s for s in data if name_substr.lower() in s['name'].lower() and (page is None or s['page']==page)]
    assert len(matches)==1, (name_substr, page, len(matches))
    return matches[0]

def set_op_level(spell, source, level, keep_note=False, new_note=None):
    found = False
    for op in spell.get('otherPrintings', []):
        if op['source'] == source:
            found = True
            if level is None:
                op.pop('spellLevelDruid', None)
            else:
                op['spellLevelDruid'] = level
            if new_note is not None:
                op['note'] = new_note
            elif not keep_note:
                op.pop('note', None)
    assert found, (spell['name'], source)

changes = []

# --- complete-adventurer.json ---
fp = 'complete-adventurer.json'
d = load(fp)
s = find(d, 'Branch to Branch')
s['spellLevelDruid'] = 2
set_op_level(s, 'Spell Compendium', 1)
s = find(d, 'Embrace the Wild')
set_op_level(s, 'Savage Species', 3)
set_op_level(s, 'Spell Compendium', None)
set_op_level(s, 'Masters of the Wild', 3)
s = find(d, "Nature's Favor")
set_op_level(s, 'Spell Compendium', None)
set_op_level(s, 'Complete Divine', 3)
set_op_level(s, 'Masters of the Wild', 3)
s = find(d, 'Forestfold')
s['spellLevelDruid'] = 4
set_op_level(s, 'Savage Species', None)
set_op_level(s, 'Spell Compendium', 3)
set_op_level(s, 'Complete Divine', None)
set_op_level(s, 'Masters of the Wild', None)
save(fp, d)
changes.append(fp)

# --- complete-arcane.json ---
fp = 'complete-arcane.json'
d = load(fp)
s = find(d, 'Animate Fire')
s['spellLevelDruid'] = 2
set_op_level(s, 'Spell Compendium', 1)
s = find(d, 'Wood Rot')
s['spellLevelDruid'] = 5
set_op_level(s, 'Spell Compendium', 4)
save(fp, d)
changes.append(fp)

# --- complete-divine.json ---
fp = 'complete-divine.json'
d = load(fp)
s = find(d, 'Forestfold')
set_op_level(s, 'Complete Adventurer', None)
s = find(d, 'Favor')  # Nature's Favor (curly apostrophe)
set_op_level(s, 'Complete Adventurer', 2)
save(fp, d)
changes.append(fp)

# --- eberron-campaign-setting.json ---
fp = 'eberron-campaign-setting.json'
d = load(fp)
s = find(d, 'Detect Aberration')
set_op_level(s, 'Lords of Madness', 2, keep_note=True,
    new_note="Related but not identical — Lords of Madness prints a generally-available version (also cleric/sorcerer-wizard) with a quarter-circle area, different HD breakpoints for aura strength, and lingering auras (this Gatekeeper-only version explicitly does not detect lingering auras).")
save(fp, d)
changes.append(fp)

# --- lords-of-madness.json ---
fp = 'lords-of-madness.json'
d = load(fp)
s = find(d, 'Detect Aberration')
set_op_level(s, 'Eberron Campaign Setting', 1, keep_note=True,
    new_note="Eberron Campaign Setting's version is a distinct Gatekeeper-only variant (cone-shaped emanation) rather than a straight reprint — this Lords of Madness printing is generally available to any druid (as well as clerics and sorcerers/wizards), with a quarter-circle area.")
save(fp, d)
changes.append(fp)

# --- masters-of-the-wild.json ---
fp = 'masters-of-the-wild.json'
d = load(fp)
s = find(d, 'Countermoon')
set_op_level(s, 'Spell Compendium', 2)
s = find(d, 'Embrace the Wild')
set_op_level(s, 'Spell Compendium', 2)
set_op_level(s, 'Complete Adventurer', 2)
s = find(d, "Nature's Favor")
set_op_level(s, 'Complete Divine', None)
set_op_level(s, 'Spell Compendium', 2)
set_op_level(s, 'Complete Adventurer', 2)
s = find(d, 'Forestfold')
set_op_level(s, 'Complete Divine', None)
set_op_level(s, 'Spell Compendium', 3)
set_op_level(s, 'Complete Adventurer', None)
save(fp, d)
changes.append(fp)

# --- planar-handbook.json ---
fp = 'planar-handbook.json'
d = load(fp)
s = find(d, 'Babau Slime')
s['spellLevelDruid'] = 3
set_op_level(s, 'Spell Compendium', 1)
s = find(d, 'Miasma of Entropy')
s['spellLevelDruid'] = 6
set_op_level(s, 'Spell Compendium', 4)
save(fp, d)
changes.append(fp)

# --- savage-species.json ---
fp = 'savage-species.json'
d = load(fp)
s = find(d, 'Buoyant Lifting')
s['spellLevelDruid'] = 2
set_op_level(s, 'Spell Compendium', 1)
s = find(d, 'Countermoon')
s['spellLevelDruid'] = 3
set_op_level(s, 'Spell Compendium', 2)
set_op_level(s, 'Masters of the Wild', None)
s = find(d, 'Embrace the Wild')
s['spellLevelDruid'] = 3
set_op_level(s, 'Spell Compendium', 2)
set_op_level(s, 'Masters of the Wild', None)
set_op_level(s, 'Complete Adventurer', 2)
s = find(d, 'Forestfold')
s['spellLevelDruid'] = 4
set_op_level(s, 'Complete Divine', None)
set_op_level(s, 'Spell Compendium', 3)
set_op_level(s, 'Masters of the Wild', None)
set_op_level(s, 'Complete Adventurer', None)
s = find(d, 'Plant Body')
s['spellLevelDruid'] = 6
set_op_level(s, 'Spell Compendium', 5)
save(fp, d)
changes.append(fp)

# --- spell-compendium.json ---
fp = 'spell-compendium.json'
d = load(fp)
s = find(d, 'Animate Fire')
set_op_level(s, 'Complete Arcane', 2)
s = find(d, 'Babau Slime')
set_op_level(s, 'Planar Handbook', 3)
s = find(d, 'Branch to Branch')
set_op_level(s, 'Complete Adventurer', 2)
s = find(d, 'Forestfold')
set_op_level(s, 'Complete Divine', 4)
set_op_level(s, 'Complete Adventurer', 4)
s = find(d, 'Miasma of Entropy')
set_op_level(s, 'Planar Handbook', 6)
s = find(d, 'Wood Rot')
set_op_level(s, 'Complete Arcane', 5)
s = find(d, 'Embrace the Wild')
set_op_level(s, 'Complete Adventurer', None)
save(fp, d)
changes.append(fp)

print('Updated:', changes)
