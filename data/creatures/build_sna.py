import json

SRC = "Monster Manual 3.5"

def c(name, page, size, type_, hd, speed, na, ab, bab, attacks, sa, sq, feats, cr,
      canine=False, fey=None, sna=None, wsl=None):
    return {
        "name": name, "source": SRC, "page": page, "size": size, "type": type_,
        "hitDice": hd, "speed": speed, "naturalArmor": na,
        "abilities": {"str": ab[0], "dex": ab[1], "con": ab[2], "int": ab[3], "wis": ab[4], "cha": ab[5]},
        "baseAttackBonus": bab, "attacks": attacks, "specialAttacks": sa,
        "specialQualities": sq, "feats": feats, "challengeRating": cr,
        "isCanine": canine, "feywildNative": fey, "summonNaturesAllyLevel": sna,
        "wildShapeMinLevel": wsl
    }

def atk(name, natural, primary, damage, crit="20/x2", count=None):
    d = {"name": name, "natural": natural, "primary": primary, "damage": damage, "crit": crit}
    if count:
        d["count"] = count
    return d

new_creatures = []

# ---------- LEVEL 1 ----------
new_creatures.append(c("Monkey", 276, "Tiny", "Animal", "1d8", {"land": 30, "climb": 30}, 0,
    (3,15,10,2,12,5), 0, [atk("bite", True, True, "1d3")], [], ["low-light vision"],
    ["Weapon Finesse"], 0.17, False, False, 1, 5))

new_creatures.append(c("Octopus", 276, "Small", "Animal", "2d8", {"land": 20, "swim": 30}, 2,
    (12,17,11,2,12,3), 1, [atk("arms", True, True, "0"), atk("bite", True, False, "1d3")],
    ["improved grab"], ["ink cloud", "jet", "low-light vision"], ["Weapon Finesse"], 1,
    False, False, 1, 5))

new_creatures.append(c("Owl", 277, "Tiny", "Animal", "1d8", {"land": 10, "fly": 40}, 2,
    (4,17,10,2,14,4), 0, [atk("talons", True, True, "1d4")], [], ["low-light vision"],
    ["Weapon Finesse"], 0.25, False, False, 1, 5))

new_creatures.append(c("Porpoise", 278, "Medium", "Animal", "2d8+2", {"swim": 80}, 2,
    (11,17,13,2,12,6), 1, [atk("slam", True, True, "2d4")], [],
    ["blindsight 120 ft.", "hold breath", "low-light vision"], ["Weapon Finesse"], 0.5,
    False, False, 1, 5))

new_creatures.append(c("Snake, Small Viper", 280, "Small", "Animal", "1d8",
    {"land": 20, "climb": 20, "swim": 20}, 2, (6,17,11,1,12,2), 0,
    [atk("bite", True, True, "1d2")], ["poison"], ["scent"], ["Weapon Finesse"], 0.5,
    False, False, 1, 5))

# ---------- LEVEL 2 ----------
new_creatures.append(c("Bear, Black", 269, "Medium", "Animal", "3d8+6", {"land": 40}, 2,
    (19,13,15,2,12,6), 2, [atk("claw", True, True, "1d4", count=2), atk("bite", True, False, "1d6")],
    [], ["low-light vision", "scent"], ["Endurance", "Run"], 2, False, False, 2, 5))

new_creatures.append(c("Dire Badger", 62, "Medium", "Animal", "3d8+15", {"land": 30, "burrow": 10}, 3,
    (14,17,19,2,12,10), 2, [atk("claw", True, True, "1d4", count=2), atk("bite", True, False, "1d6")],
    ["rage"], ["low-light vision", "scent"], ["Alertness", "Toughness", "Track"], 2,
    False, False, 2, 5))

new_creatures.append(c("Elemental, Small Air", 96, "Small", "Elemental", "2d8", {"fly": 100}, 3,
    (10,17,10,4,11,11), 1, [atk("slam", True, True, "1d4")], ["air mastery", "whirlwind"],
    ["darkvision 60 ft.", "elemental traits"], ["Flyby Attack", "Improved Initiative", "Weapon Finesse"],
    1, False, False, 2, None))

new_creatures.append(c("Elemental, Small Earth", 97, "Small", "Elemental", "2d8+2", {"land": 20}, 7,
    (17,8,13,4,11,11), 1, [atk("slam", True, True, "1d6")], ["earth mastery", "push"],
    ["darkvision 60 ft.", "earth glide", "elemental traits"], ["Power Attack"], 1,
    False, False, 2, None))

new_creatures.append(c("Elemental, Small Fire", 99, "Small", "Elemental", "2d8", {"land": 50}, 3,
    (10,13,10,4,11,11), 1, [atk("slam", True, True, "1d4")], ["burn"],
    ["darkvision 60 ft.", "elemental traits", "immunity to fire", "vulnerability to cold"],
    ["Dodge", "Improved Initiative", "Weapon Finesse"], 1, False, False, 2, None))

new_creatures.append(c("Elemental, Small Water", 100, "Small", "Elemental", "2d8+2",
    {"land": 20, "swim": 90}, 6, (14,10,13,4,11,11), 1, [atk("slam", True, True, "1d6")],
    ["water mastery", "drench", "vortex"], ["darkvision 60 ft.", "elemental traits"],
    ["Power Attack"], 1, False, False, 2, None))

new_creatures.append(c("Hippogriff", 152, "Large", "Magical Beast", "3d10+9",
    {"land": 50, "fly": 100}, 4, (18,15,16,2,13,8), 3,
    [atk("claw", True, True, "1d4", count=2), atk("bite", True, False, "1d8")], [],
    ["darkvision 60 ft.", "low-light vision", "scent"], ["Dodge", "Wingover"], 2,
    False, False, 2, None))

new_creatures.append(c("Shark, Medium", 279, "Medium", "Animal", "3d8+3", {"swim": 60}, 3,
    (13,15,13,1,12,2), 2, [atk("bite", True, True, "1d6")], [],
    ["blindsense", "keen scent"], ["Alertness", "Weapon Finesse"], 1, False, False, 2, 5))

new_creatures.append(c("Snake, Medium Viper", 280, "Medium", "Animal",
    "2d8", {"land": 20, "climb": 20, "swim": 20}, 3, (8,17,11,1,12,2), 1,
    [atk("bite", True, True, "1d4")], ["poison"], ["scent"], ["Weapon Finesse"], 1,
    False, False, 2, 5))

new_creatures.append(c("Squid", 281, "Medium", "Animal", "3d8", {"swim": 60}, 3,
    (14,17,11,1,12,2), 2, [atk("arms", True, True, "0"), atk("bite", True, False, "1d6")],
    ["improved grab"], ["ink cloud", "jet", "low-light vision"], ["Alertness", "Endurance"],
    1, False, False, 2, 5))

# ---------- LEVEL 3 ----------
new_creatures.append(c("Ape", 268, "Large", "Animal", "4d8+11", {"land": 30, "climb": 30}, 3,
    (21,15,14,2,12,7), 3, [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d6")],
    [], ["low-light vision", "scent"], ["Alertness", "Toughness"], 2, False, False, 3, 5))

new_creatures.append(c("Dire Weasel", 65, "Medium", "Animal", "3d8", {"land": 40}, 2,
    (14,19,10,2,12,11), 2, [atk("bite", True, True, "1d6")], ["attach", "blood drain"],
    ["low-light vision", "scent"], ["Alertness", "Stealthy", "Weapon Finesse"], 2,
    False, False, 3, 5))

new_creatures.append(c("Eagle, Giant", 93, "Large", "Magical Beast", "4d10+4",
    {"land": 10, "fly": 80}, 3, (18,17,12,10,14,10), 4,
    [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d8")], [],
    ["low-light vision", "evasion"], ["Alertness", "Flyby Attack"], 3, False, False, 3, None))

new_creatures.append(c("Lion", 274, "Large", "Animal", "5d8+10", {"land": 40}, 3,
    (21,17,15,2,12,6), 3, [atk("claw", True, True, "1d4", count=2), atk("bite", True, False, "1d8")],
    ["pounce", "improved grab", "rake"], ["low-light vision", "scent"], ["Alertness", "Run"],
    3, False, False, 3, 5))

new_creatures.append(c("Owl, Giant", 205, "Large", "Magical Beast", "4d10+4",
    {"land": 10, "fly": 70}, 3, (18,17,12,10,14,10), 4,
    [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d8")], [],
    ["superior low-light vision"], ["Alertness", "Wingover"], 3, False, False, 3, None))

new_creatures.append(c("Satyr (without pipes)", 219, "Medium", "Fey", "5d6+5", {"land": 40}, 4,
    (10,13,12,12,13,13), 2, [atk("head butt", True, True, "1d6")], [],
    ["damage reduction 5/cold iron", "low-light vision"], ["Alertness", "Dodge", "Mobility"],
    2, False, None, 3, None))

new_creatures.append(c("Shark, Large", 279, "Large", "Animal", "7d8+7", {"swim": 60}, 4,
    (17,15,13,1,12,2), 5, [atk("bite", True, True, "1d8")], [], ["blindsense", "keen scent"],
    ["Alertness", "Great Fortitude", "Improved Initiative"], 2, False, False, 3, 5))

new_creatures.append(c("Snake, Constrictor", 279, "Medium", "Animal", "3d8+6",
    {"land": 20, "climb": 20, "swim": 20}, 2, (17,17,13,1,12,2), 2,
    [atk("bite", True, True, "1d3")], ["constrict", "improved grab"], ["scent"],
    ["Alertness", "Toughness"], 2, False, False, 3, 5))

new_creatures.append(c("Snake, Large Viper", 280, "Large", "Animal",
    "3d8", {"land": 20, "climb": 20, "swim": 20}, 3, (10,17,11,1,12,2), 2,
    [atk("bite", True, True, "1d4")], ["poison"], ["scent"],
    ["Improved Initiative", "Weapon Finesse"], 2, False, False, 3, 5))

new_creatures.append(c("Thoqqua", 242, "Medium", "Elemental", "3d8+3", {"land": 30, "burrow": 20}, 7,
    (15,13,13,6,12,10), 2, [atk("slam", True, True, "1d6")], ["heat", "burn"],
    ["darkvision 60 ft.", "elemental traits", "immunity to fire", "tremorsense 60 ft.",
     "vulnerability to cold"], ["Alertness", "Track"], 2, False, False, 3, None))

# ---------- LEVEL 4 ----------
new_creatures.append(c("Arrowhawk, Juvenile", 19, "Small", "Outsider", "3d8+3", {"fly": 60}, 4,
    (12,21,12,10,13,13), 3,
    [atk("electricity ray", False, True, "2d6"), atk("bite", True, True, "1d6")],
    ["electricity ray"],
    ["darkvision 60 ft.", "immunity to acid, electricity, and poison", "resistance to cold 10 and fire 10"],
    ["Dodge", "Weapon Finesse"], 3, False, False, 4, None))

new_creatures.append(c("Crocodile, Giant", 271, "Huge", "Animal", "7d8+28",
    {"land": 20, "swim": 30}, 7, (27,12,19,1,12,2), 5,
    [atk("bite", True, True, "2d8"), atk("tail slap", True, True, "1d12")],
    ["improved grab"], ["hold breath", "low-light vision"],
    ["Alertness", "Endurance", "Skill Focus (Hide)"], 4, False, False, 4, 5))

new_creatures.append(c("Deinonychus", 60, "Large", "Animal", "4d8+16", {"land": 60}, 5,
    (19,15,19,2,12,10), 3,
    [atk("talons", True, True, "2d6"), atk("foreclaw", True, False, "1d3", count=2),
     atk("bite", True, False, "2d4")],
    ["pounce"], ["low-light vision", "scent"], ["Run", "Track"], 3, False, False, 4, 5))

new_creatures.append(c("Dire Ape", 62, "Large", "Animal", "5d8+13", {"land": 30, "climb": 15}, 4,
    (22,15,14,2,12,7), 3, [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d8")],
    ["rend"], ["low-light vision", "scent"], ["Alertness", "Toughness"], 3, False, False, 4, 5))

new_creatures.append(c("Dire Boar", 63, "Large", "Animal", "7d8+21", {"land": 40}, 6,
    (27,10,17,2,13,8), 5, [atk("gore", True, True, "1d8")], ["ferocity"],
    ["low-light vision", "scent"], ["Alertness", "Endurance", "Iron Will"], 4, False, False, 4, 5))

new_creatures.append(c("Elemental, Medium Air", 96, "Medium", "Elemental", "4d8+8", {"fly": 100}, 3,
    (12,21,14,4,11,11), 3, [atk("slam", True, True, "1d6")], ["air mastery", "whirlwind"],
    ["darkvision 60 ft.", "elemental traits"],
    ["Dodge", "Flyby Attack", "Improved Initiative", "Weapon Finesse"], 3, False, False, 4, None))

new_creatures.append(c("Elemental, Medium Earth", 97, "Medium", "Elemental", "4d8+12", {"land": 20}, 9,
    (21,8,17,4,11,11), 3, [atk("slam", True, True, "1d8")], ["earth mastery", "push"],
    ["darkvision 60 ft.", "earth glide", "elemental traits"], ["Cleave", "Power Attack"],
    3, False, False, 4, None))

new_creatures.append(c("Elemental, Medium Fire", 99, "Medium", "Elemental", "4d8+8", {"land": 50}, 3,
    (12,17,14,4,11,11), 3, [atk("slam", True, True, "1d6")], ["burn"],
    ["darkvision 60 ft.", "elemental traits", "immunity to fire", "vulnerability to cold"],
    ["Dodge", "Improved Initiative", "Mobility", "Weapon Finesse"], 3, False, False, 4, None))

new_creatures.append(c("Elemental, Medium Water", 100, "Medium", "Elemental", "4d8+12",
    {"land": 20, "swim": 90}, 8, (16,12,17,4,11,11), 3, [atk("slam", True, True, "1d8")],
    ["water mastery", "drench", "vortex"], ["darkvision 60 ft.", "elemental traits"],
    ["Cleave", "Power Attack"], 3, False, False, 4, None))

new_creatures.append(c("Salamander, Flamebrother", 218, "Small", "Outsider", "4d8+8", {"land": 20}, 7,
    (12,13,14,14,15,13), 4,
    [atk("spear", False, True, "1d6", crit="x3"), atk("tail slap", True, False, "1d4")],
    ["constrict", "heat", "improved grab"],
    ["darkvision 60 ft.", "immunity to fire", "vulnerability to cold"],
    ["Alertness", "Multiattack"], 3, False, False, 4, None))

new_creatures.append(c("Sea Cat", 219, "Large", "Magical Beast", "6d10+18",
    {"land": 10, "swim": 40}, 8, (19,12,17,2,13,10), 6,
    [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d8")], ["rend"],
    ["darkvision 60 ft.", "hold breath", "low-light vision", "scent"],
    ["Alertness", "Endurance", "Iron Will"], 4, False, False, 4, None))

new_creatures.append(c("Shark, Huge", 279, "Huge", "Animal", "10d8+20", {"swim": 60}, 5,
    (21,15,15,1,12,2), 7, [atk("bite", True, True, "2d6")], [], ["blindsense", "keen scent"],
    ["Alertness", "Great Fortitude", "Improved Initiative", "Iron Will"], 4, False, False, 4, 5))

new_creatures.append(c("Snake, Huge Viper", 280, "Huge", "Animal",
    "6d8+6", {"land": 20, "climb": 20, "swim": 20}, 5, (16,15,13,1,12,2), 4,
    [atk("bite", True, True, "1d6")], ["poison"], ["scent"],
    ["Improved Initiative", "Run", "Weapon Focus (bite)"], 3, False, False, 4, 5))

new_creatures.append(c("Tiger", 281, "Large", "Animal", "6d8+18", {"land": 40}, 3,
    (23,15,17,2,12,6), 4, [atk("claw", True, True, "1d8", count=2), atk("bite", True, False, "2d6")],
    ["improved grab", "pounce", "rake"], ["low-light vision", "scent"],
    ["Alertness", "Improved Natural Attack (bite)", "Improved Natural Attack (claw)"],
    4, False, False, 4, 5))

new_creatures.append(c("Tojanida, Juvenile", 243, "Small", "Outsider", "3d8+6",
    {"land": 10, "swim": 90}, 10, (14,13,15,10,12,9), 3,
    [atk("bite", True, True, "2d6"), atk("claw", True, False, "1d4", count=2)],
    ["improved grab", "ink cloud"],
    ["all-around vision", "darkvision 60 ft.", "immunity to acid and cold",
     "resistance to electricity 10 and fire 10"], ["Blind-Fight", "Dodge"], 3,
    False, False, 4, None))

new_creatures.append(c("Unicorn", 250, "Large", "Magical Beast", "4d10+20", {"land": 60}, 6,
    (20,17,21,10,21,24), 4,
    [atk("horn", True, True, "1d8"), atk("hoof", True, False, "1d4", count=2)], [],
    ["darkvision 60 ft.", "magic circle against evil", "spell-like abilities",
     "immunity to poison, charm, and compulsion", "low-light vision", "scent", "wild empathy"],
    ["Alertness", "Skill Focus (Survival)"], 3, False, False, 4, None))

new_creatures.append(c("Xorn, Minor", 261, "Small", "Outsider", "3d8+9", {"land": 20, "burrow": 20},
    12, (15,10,15,10,11,10), 3,
    [atk("bite", True, True, "2d8"), atk("claw", True, False, "1d3", count=3)], [],
    ["all-around vision", "earth glide", "damage reduction 5/bludgeoning", "darkvision 60 ft.",
     "immunity to cold and fire", "resistance to electricity 10", "tremorsense 60 ft."],
    ["Multiattack", "Toughness"], 3, False, False, 4, None))

# ---------- LEVEL 5 ----------
new_creatures.append(c("Arrowhawk, Adult", 19, "Medium", "Outsider", "7d8+7", {"fly": 60}, 6,
    (14,21,12,10,13,13), 7,
    [atk("electricity ray", False, True, "2d8"), atk("bite", True, True, "1d8")],
    ["electricity ray"],
    ["darkvision 60 ft.", "immunity to acid, electricity, and poison", "resistance to cold 10 and fire 10"],
    ["Dodge", "Flyby Attack", "Weapon Finesse"], 5, False, False, 5, None))

new_creatures.append(c("Bear, Polar", 269, "Large", "Animal", "8d8+32", {"land": 40, "swim": 30}, 5,
    (27,13,19,2,12,6), 6, [atk("claw", True, True, "1d8", count=2), atk("bite", True, False, "2d6")],
    ["improved grab"], ["low-light vision", "scent"], ["Endurance", "Run", "Track"],
    4, False, False, 5, 5))

new_creatures.append(c("Dire Lion", 63, "Large", "Animal", "8d8+24", {"land": 40}, 4,
    (25,15,17,2,12,10), 6, [atk("claw", True, True, "1d6", count=2), atk("bite", True, False, "1d8")],
    ["improved grab", "pounce", "rake"], ["low-light vision", "scent"],
    ["Alertness", "Run", "Weapon Focus (claw)"], 5, False, False, 5, 5))

new_creatures.append(c("Elasmosaurus", 60, "Huge", "Animal", "10d8+66", {"land": 20, "swim": 50}, 3,
    (26,14,22,2,13,9), 7, [atk("bite", True, True, "2d8")], [], ["low-light vision", "scent"],
    ["Dodge", "Great Fortitude", "Toughness"], 7, False, False, 5, 5))

new_creatures.append(c("Elemental, Large Air", 96, "Large", "Elemental", "8d8+24", {"fly": 100}, 4,
    (14,25,16,6,11,11), 6, [atk("slam", True, True, "2d6", count=2)], ["air mastery", "whirlwind"],
    ["damage reduction 5/-", "darkvision 60 ft.", "elemental traits"],
    ["Combat Reflexes", "Dodge", "Flyby Attack", "Improved Initiative", "Weapon Finesse"],
    5, False, False, 5, None))

new_creatures.append(c("Elemental, Large Earth", 97, "Large", "Elemental", "8d8+32", {"land": 20}, 10,
    (25,8,19,6,11,11), 6, [atk("slam", True, True, "2d8", count=2)], ["earth mastery", "push"],
    ["damage reduction 5/-", "earth glide", "darkvision 60 ft.", "elemental traits"],
    ["Cleave", "Great Cleave", "Power Attack"], 5, False, False, 5, None))

new_creatures.append(c("Elemental, Large Fire", 99, "Large", "Elemental", "8d8+24", {"land": 50}, 4,
    (18,25,18,6,11,11), 6, [atk("slam", True, True, "2d6", count=2)], ["burn"],
    ["damage reduction 5/-", "darkvision 60 ft.", "elemental traits", "immunity to fire",
     "vulnerability to cold"],
    ["Alertness", "Combat Reflexes", "Dodge", "Improved Initiative", "Spring Attack", "Weapon Finesse"],
    5, False, False, 5, None))

new_creatures.append(c("Elemental, Large Water", 100, "Large", "Elemental", "8d8+32",
    {"land": 20, "swim": 90}, 9, (20,14,19,6,11,11), 6, [atk("slam", True, True, "2d8", count=2)],
    ["water mastery", "drench", "vortex"],
    ["damage reduction 5/-", "darkvision 60 ft.", "elemental traits"],
    ["Alertness", "Cleave", "Great Cleave", "Power Attack", "Improved Bull Rush", "Iron Will"],
    5, False, False, 5, None))

new_creatures.append(c("Griffon", 139, "Large", "Magical Beast", "7d10+21",
    {"land": 30, "fly": 80}, 6, (18,15,16,5,13,8), 7,
    [atk("bite", True, True, "2d6"), atk("claw", True, False, "1d4", count=2)],
    ["pounce", "rake"], ["darkvision 60 ft.", "low-light vision", "scent"],
    ["Iron Will", "Multiattack", "Weapon Focus (bite)"], 4, False, False, 5, None))

new_creatures.append(c("Janni", 116, "Medium", "Outsider", "6d8+6", {"land": 30, "fly": 20}, 1,
    (16,15,12,14,15,13), 6,
    [atk("scimitar", False, True, "1d6", crit="18-20/x2"), atk("longbow", False, True, "1d8", crit="20/x3")],
    ["change size", "spell-like abilities"],
    ["darkvision 60 ft.", "elemental endurance", "plane shift", "resistance to fire 10",
     "telepathy 100 ft."], ["Combat Reflexes", "Dodge", "Improved Initiative", "Mobility"],
    4, False, False, 5, None))

new_creatures.append(c("Rhinoceros", 278, "Large", "Animal", "8d8+40", {"land": 30}, 7,
    (26,10,21,2,13,2), 6, [atk("gore", True, True, "2d6")], ["powerful charge"],
    ["low-light vision"], ["Alertness", "Endurance", "Improved Natural Attack (gore)"],
    4, False, False, 5, 5))

new_creatures.append(c("Satyr (with pipes)", 219, "Medium", "Fey", "5d6+5", {"land": 40}, 4,
    (10,13,12,12,13,13), 2, [atk("head butt", True, True, "1d6")], ["pipes"],
    ["damage reduction 5/cold iron", "low-light vision"], ["Alertness", "Dodge", "Mobility"],
    4, False, None, 5, None))

new_creatures.append(c("Snake, Giant Constrictor", 280, "Huge", "Animal", "11d8+14",
    {"land": 20, "climb": 20, "swim": 20}, 4, (25,17,13,1,12,2), 8,
    [atk("bite", True, True, "1d8")], ["constrict", "improved grab"], ["scent"],
    ["Alertness", "Endurance", "Skill Focus (Hide)", "Toughness"], 5, False, False, 5, 5))

new_creatures.append(c("Nixie", 235, "Small", "Fey", "1d6", {"land": 20, "swim": 30}, 0,
    (7,16,11,12,13,18), 0,
    [atk("short sword", False, True, "1d4", crit="19-20/x2"),
     atk("light crossbow", False, True, "1d6", crit="19-20/x2")],
    ["charm person"],
    ["amphibious", "damage reduction 5/cold iron", "low-light vision", "spell resistance 16",
     "water breathing", "wild empathy"], ["Dodge", "Weapon Finesse"], 1, False, None, 5, None))

new_creatures.append(c("Tojanida, Adult", 243, "Medium", "Outsider", "7d8+14",
    {"land": 10, "swim": 90}, 12, (16,13,15,10,12,9), 7,
    [atk("bite", True, True, "2d8"), atk("claw", True, False, "1d6", count=2)],
    ["improved grab", "ink cloud"],
    ["all-around vision", "darkvision 60 ft.", "immunity to acid and cold",
     "resistance to electricity 10 and fire 10"], ["Blind-Fight", "Dodge", "Power Attack"], 5,
    False, False, 5, None))

new_creatures.append(c("Whale, Orca", 283, "Huge", "Animal", "9d8+48", {"swim": 50}, 6,
    (27,15,21,2,14,6), 6, [atk("bite", True, True, "2d6")], [],
    ["blindsight 120 ft.", "hold breath", "low-light vision"],
    ["Alertness", "Endurance", "Run", "Toughness"], 5, False, False, 5, 5))

print("Total new creatures:", len(new_creatures))

path = "monster-manual.json"
with open(path) as f:
    data = json.load(f)

existing_names = {x["name"] for x in data}
dupes = [nc["name"] for nc in new_creatures if nc["name"] in existing_names]
if dupes:
    print("WARNING duplicate names:", dupes)

data.extend(new_creatures)

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")

print("Final count:", len(data))
