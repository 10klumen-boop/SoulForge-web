// ===== Наставник Ючи (Yuchi) — один NPC на все расы =====
// Не путать с QUEST_NPC_BY_RACE_ZONE — те выдают поручения глав.

const MENTOR_NPC = {
  id: "yuchi",
  name: "Ючи",
  nameEn: "Yuchi",
  role: "Наставница Кузницы душ",
  avatar: "icons/npc/yuchi.png?v=5",
  avatarFallback: "icons/npc/yuchi_happy.png?v=5",
  /** Key art / превью (промо, сплеш) */
  preview: "icons/npc/yuchi_preview.png?v=1",
  previewBanner: "icons/npc/yuchi_preview_banner.png?v=1",
  /** Эмоции из спрайт-листа */
  emotions: {
    neutral: "icons/npc/yuchi_neutral.png?v=5",
    happy: "icons/npc/yuchi_happy.png?v=5",
    angry: "icons/npc/yuchi_angry.png?v=5",
    surprised: "icons/npc/yuchi_surprised.png?v=5",
    tired: "icons/npc/yuchi_tired.png?v=5",
    sad: "icons/npc/yuchi_sad.png?v=5",
    /** Варианты облика (второй лист) */
    rogue: "icons/npc/yuchi_rogue.png?v=5",
    mage: "icons/npc/yuchi_mage.png?v=5",
  },
};

function mentorNpc() {
  return MENTOR_NPC;
}

/** Портрет по эмоции бита (neutral|happy|angry|surprised|tired|sad|…). */
function mentorAvatarSrc(emotion) {
  const n = mentorNpc();
  const key = emotion || "happy";
  if (n.emotions && n.emotions[key]) return n.emotions[key];
  return n.avatar || n.avatarFallback || "icons/npc/yuchi_happy.png?v=5";
}

/** Эмоция по id шага, если в бите не задана. */
function mentorEmotionForBit(bit) {
  if (!bit) return "happy";
  if (bit.emotion) return bit.emotion;
  const map = {
    eyra_after_quest: "happy",
    eyra_open_zone: "neutral",
    eyra_farm_click: "angry",
    eyra_quest_hud: "happy",
    eyra_autoclicker: "happy",
    eyra_inventory: "neutral",
    eyra_inv_ng: "tired",
    eyra_kit: "happy",
    eyra_enchant_open: "surprised",
    eyra_enchant_btn: "angry",
    eyra_crystals_lesson: "surprised",
    eyra_workshop_open: "happy",
    eyra_workshop_shots: "happy",
    eyra_shots_done: "happy",
    eyra_journal: "tired",
    eyra_loop: "happy",
    eyra_ch2: "neutral",
    eyra_ch3: "neutral",
    eyra_ng_chest: "happy",
    eyra_ng_armor: "happy",
    eyra_ng_jewelry: "surprised",
    eyra_ch4: "tired",
    eyra_ch5: "neutral",
    eyra_hunting: "happy",
    eyra_finale: "sad",
    eyra_soft_avatar: "neutral",
    eyra_soft_ach: "tired",
  };
  return map[bit.id] || "happy";
}
