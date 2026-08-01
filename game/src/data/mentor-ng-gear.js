// ===== NG учебный сет брони/бижи для ментора (по классу) =====

const MENTOR_NG_ARMOR_BY_KIND = {
  heavy: {
    setId: "ng_heavy",
    chest: "ng_heavy_chest",
    rest: ["ng_heavy_helmet", "ng_heavy_legs", "ng_heavy_gloves", "ng_heavy_boots"],
  },
  light: {
    setId: "ng_light",
    chest: "ng_light_chest",
    rest: ["ng_light_helmet", "ng_light_legs", "ng_light_gloves", "ng_light_boots"],
  },
  robe: {
    setId: "ng_robe",
    chest: "ng_robe_chest",
    rest: ["ng_robe_helmet", "ng_robe_legs", "ng_robe_gloves", "ng_robe_boots"],
  },
};

const MENTOR_NG_JEWELRY_BY_ROLE = {
  resist: {
    setId: "ng_guard",
    necklace: "ng_guard_necklace",
    earring: "ng_guard_earring",
    ring: "ng_guard_ring",
  },
  cdr: {
    setId: "ng_adept",
    necklace: "ng_adept_necklace",
    earring: "ng_adept_earring",
    ring: "ng_adept_ring",
  },
};

function mentorNgArmorKind() {
  if (typeof professionArmorPref === "function") {
    const pref = professionArmorPref(state.avatar);
    if (pref && MENTOR_NG_ARMOR_BY_KIND[pref]) return pref;
  }
  if (typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar?.classId)) {
    return "robe";
  }
  return "heavy";
}

function mentorNgJewelryRole() {
  if (typeof isMysticArchetype === "function" && isMysticArchetype(state.avatar?.classId)) {
    return "cdr";
  }
  return "resist";
}

function mentorNgArmorKit() {
  return MENTOR_NG_ARMOR_BY_KIND[mentorNgArmorKind()] || MENTOR_NG_ARMOR_BY_KIND.heavy;
}

function mentorNgJewelryKit() {
  return MENTOR_NG_JEWELRY_BY_ROLE[mentorNgJewelryRole()] || MENTOR_NG_JEWELRY_BY_ROLE.resist;
}
