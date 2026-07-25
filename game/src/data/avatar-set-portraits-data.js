// ===== Маппинг игровых сетов → рендеры ivory-tower.de =====
// URL: /{IvoryFolder}_{Gender}/front_{type}_{file}_high.png

/** setId → { type: heavy|light|robe, file: ivory filename stem } */
const AVATAR_SET_IVORY = {
  bone: { type: "light", file: "bone" },
  brigandine: { type: "heavy", file: "brigandine" },
  manticore: { type: "light", file: "manticore" },
  reinforced: { type: "light", file: "reinforcedleather" },
  elven_mithril: { type: "robe", file: "elvenmithril" },
  knowledge: { type: "robe", file: "knowledge" },
  mithril: { type: "heavy", file: "mithril" },
  chain: { type: "heavy", file: "chainmail" },
  tempered: { type: "light", file: "mithril" },
  theca: { type: "light", file: "theca" },
  plated: { type: "light", file: "platedleather" },
  drake: { type: "light", file: "drake" },
  composite: { type: "heavy", file: "composite" },
  full_plate: { type: "heavy", file: "fullplate" },
  karmian: { type: "robe", file: "karmian" },
  divine: { type: "robe", file: "divine" },
  demon: { type: "robe", file: "demons" },
};

/** Минимум кусков одного сета, чтобы сменить портрет на «одетый сет». */
const AVATAR_SET_PORTRAIT_MIN_PIECES = 2;
