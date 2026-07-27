/**
 * Live-атлас баланса SoulForge.
 * Данные — из глобалов клиента (weapons / armor / economy / zones…).
 * Открывать: http://localhost:8787/balance-atlas.html
 */
(function (global) {
  "use strict";

  const RACE_RU = {
    human: "Люди",
    elf: "Эльфы",
    dark_elf: "Тёмные эльфы",
    orc: "Орки",
    dwarf: "Гномы",
  };
  const CLASS_RU = { fighter: "Воин", mystic: "Мистик", shaman: "Шаман" };
  const ROLE_RU = {
    tank: "Танк",
    melee: "Мили",
    dagger: "Кинжал",
    archer: "Лучник",
    mage: "Маг",
    support: "Саппорт",
    craft: "Крафт",
  };
  const KIND_RU = { heavy: "Тяжёлая", light: "Лёгкая", robe: "Роба" };
  const SLOT_RU = {
    helmet: "Шлем",
    chest: "Грудь",
    legs: "Ноги",
    gloves: "Перчатки",
    boots: "Ботинки",
  };
  const BONUS_RU = {
    armorSustain: "Sustain (HP golden/boss)",
    bossResist: "Сопр. боссу",
    mineAdena: "Адена с поля",
    mineXp: "XP с поля",
    enchant: "Шанс заточки",
    avatarXp: "XP души",
    patk: "PATK",
    matk: "MATK",
    pdef: "PDEF",
    mdef: "MDEF",
    pvpAtk: "ATK арены",
    pvpDef: "DEF арены",
    pvpHp: "HP арены",
  };
  const WEAPON_KIND_RU = { physical: "Физ", magical: "Маг", hybrid: "Гибрид" };
  const LS = "sf_balance_atlas_edits_v1";

  function g(name) {
    const pack = global.__SF_ATLAS;
    if (pack && name in pack && pack[name] !== undefined) return pack[name];
    return global[name];
  }

  function iconHref(icon) {
    if (!icon) return "";
    let p = String(icon).split("?")[0].replace(/\\/g, "/");
    if (p.startsWith("icons/") || p.startsWith("assets/")) return p;
    if (p.startsWith("/icons/") || p.startsWith("/assets/")) return p.slice(1);
    if (p.startsWith("../")) return p.replace(/^\.\.\//, "");
    return "icons/" + p.replace(/^\/+/, "");
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function stdev(arr, m) {
    if (arr.length < 2) return 0;
    return Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1));
  }

  function fmtBonusVal(key, v) {
    if (typeof v !== "number") return String(v);
    if (key === "enchant") return "+" + Math.round(v * 10000) / 100 + " п.п.";
    if (key === "pvpHp") return "+" + Math.round(v);
    if (["mineAdena", "mineXp", "armorSustain", "bossResist", "avatarXp", "pvpAtk", "pvpDef"].includes(key)) {
      return "+" + Math.round(v * 1000) / 10 + "%";
    }
    return (v >= 0 ? "+" : "") + v;
  }

  function setBonusScore(bonuses) {
    let score = 0;
    const weights = {
      mineAdena: 100,
      mineXp: 80,
      armorSustain: 70,
      bossResist: 90,
      enchant: 12000,
      pvpAtk: 120,
      pvpDef: 120,
      pvpHp: 0.8,
    };
    Object.values(bonuses || {}).forEach((tier) => {
      Object.entries(tier || {}).forEach(([k, v]) => {
        score += (weights[k] || 50) * Number(v || 0);
      });
    });
    return Math.round(score * 10) / 10;
  }

  function fmtSetBonuses(bonuses) {
    return Object.keys(bonuses || {})
      .sort((a, b) => Number(a) - Number(b))
      .map((n) => {
        const parts = Object.entries(bonuses[n]).map(
          ([k, v]) => (BONUS_RU[k] || k) + " " + fmtBonusVal(k, v)
        );
        return { pieces: Number(n), text: parts.join(", "), raw: bonuses[n] };
      });
  }

  function buildAtlas() {
    const WEAPONS = g("WEAPONS") || [];
    const CATEGORIES = g("CATEGORIES") || [];
    const ARMOR = g("ARMOR") || [];
    const ARMOR_SETS = g("ARMOR_SETS") || {};
    const ARMOR_CRAFT = g("ARMOR_CRAFT") || [];
    const ARMOR_FRAG_ZONES = g("ARMOR_FRAG_ZONES") || {};
    const ARMOR_FRAG_DROP = g("ARMOR_FRAG_DROP") || {};
    const FARM_ZONES = g("FARM_ZONES") || [];
    const ZONE_RACE_BONUS = g("ZONE_RACE_BONUS") || {};
    const PROFESSIONS = g("PROFESSIONS") || {};
    const ROLE_ARMOR_PREF = g("ROLE_ARMOR_PREF") || {};
    const STARTER_ARMOR_PREF = g("STARTER_ARMOR_PREF") || {};
    const ROLE_WEAPON_CATS = g("ROLE_WEAPON_CATS") || {};
    const STARTER_WEAPON_CATS = g("STARTER_WEAPON_CATS") || {};
    const WEAPON_CAT_LABELS = g("WEAPON_CAT_LABELS") || {};
    const WEAPON_CAT_POWER_MULT = g("WEAPON_CAT_POWER_MULT") || {};
    const ARMOR_AFFINITY_MULT = g("ARMOR_AFFINITY_MULT");
    const WEAPON_MASTERY_MULT = g("WEAPON_MASTERY_MULT");
    const GRADE_UNLOCK_LEVEL = g("GRADE_UNLOCK_LEVEL") || { NG: 1, D: 10, C: 40 };
    const GRADE_OVERLEVEL_MULT = g("GRADE_OVERLEVEL_MULT");
    const GRADE_OVERLEVEL_STEP = g("GRADE_OVERLEVEL_STEP");
    const GRADE_OVERLEVEL_FLOOR = g("GRADE_OVERLEVEL_FLOOR");
    const WEAPON_AFFINITY_OFF_MULT = g("WEAPON_AFFINITY_OFF_MULT");
    const WEAPON_AFFINITY_HYBRID_MULT = g("WEAPON_AFFINITY_HYBRID_MULT");
    const GRADE_VALUE = g("GRADE_VALUE") || {};
    const CRYSTAL_VALUE = g("CRYSTAL_VALUE") || {};
    const COLLECTIBLES = g("COLLECTIBLES") || {};
    const ECONOMY = g("ECONOMY") || {};
    const PASSIVE_INCOME = g("PASSIVE_INCOME") || {};
    const AUTO_CLICKER = g("AUTO_CLICKER") || {};
    const ORE = g("ORE") || {};
    const SHOT_RECIPE = g("SHOT_RECIPE") || {};
    const SHOT_BATCH = g("SHOT_BATCH");
    const MINE_ADENA_REWARD = g("MINE_ADENA_REWARD") || {};
    const MINE_ADENA_GOLDEN = g("MINE_ADENA_GOLDEN") || {};
    const version = g("GAME_VERSION") || "?";
    const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

    const craftById = {};
    ARMOR_CRAFT.forEach((c) => {
      craftById[c.armorId || c.id] = c;
    });
    const piecesBySet = {};
    ARMOR.forEach((p) => {
      if (!piecesBySet[p.setId]) piecesBySet[p.setId] = [];
      piecesBySet[p.setId].push(p);
    });

    const byGroup = {};
    WEAPONS.forEach((w) => {
      const key = (w.grade || "?") + "|" + (w.cat || "?");
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(w);
    });
    const outlierIds = new Set();
    Object.values(byGroup).forEach((list) => {
      const pats = list.map((w) => Number(w.patk) || 0);
      const mats = list.map((w) => Number(w.matk) || 0);
      const mp = mean(pats);
      const mm = mean(mats);
      const sp = stdev(pats, mp);
      const sm = stdev(mats, mm);
      list.forEach((w) => {
        const flags = [];
        if (sp > 0 && (w.patk - mp) / sp >= 1.4) flags.push("patk+");
        if (sm > 0 && (w.matk - mm) / sm >= 1.4) flags.push("matk+");
        if (flags.length) {
          outlierIds.add(w.id);
          w._atlasFlags = flags;
        }
      });
    });

    const weapons = WEAPONS.map((w) => {
      const catMult = WEAPON_CAT_POWER_MULT[w.cat] != null ? WEAPON_CAT_POWER_MULT[w.cat] : 1;
      const patk = Number(w.patk) || 0;
      const matk = Number(w.matk) || 0;
      const effPatk = Math.round(patk * catMult);
      return {
        uid: "weapon:" + w.id,
        id: w.id,
        name: w.name,
        grade: w.grade,
        cat: w.cat,
        weaponKind: w.weaponKind || "physical",
        weaponKindRu: WEAPON_KIND_RU[w.weaponKind] || w.weaponKind,
        patk,
        matk,
        effPatk,
        catMult,
        ps: w.ps,
        ms: w.ms,
        cc: w.cc,
        score: Math.round(effPatk + matk * 0.85),
        icon: iconHref(w.icon),
        outlier: outlierIds.has(w.id),
        flags: w._atlasFlags || [],
      };
    });

    const armorSets = Object.values(ARMOR_SETS)
      .map((s) => {
        const pcs = piecesBySet[s.id] || [];
        const pdef = pcs.reduce((a, p) => a + (p.pdef || 0), 0);
        const mdef = pcs.reduce((a, p) => a + (p.mdef || 0), 0);
        let craftAdena = 0,
          craftOre = 0,
          craftCry = 0,
          craftFrags = 0;
        pcs.forEach((p) => {
          const c = craftById[p.id];
          if (!c) return;
          craftAdena += c.adena || 0;
          craftOre += c.oreSoul || c.ore || 0;
          craftCry += c.cry || c.crystals || 0;
          craftFrags += c.fragQty || c.frags || 0;
        });
        return {
          uid: "armorset:" + s.id,
          id: s.id,
          name: s.name,
          grade: s.grade,
          kind: s.kind,
          kindRu: KIND_RU[s.kind] || s.kind,
          farmZoneId: s.farmZoneId || "",
          icon: iconHref((pcs.find((p) => p.slot === "chest") || pcs[0] || {}).icon),
          pdef,
          mdef,
          bonuses: fmtSetBonuses(s.bonuses),
          bonusScore: setBonusScore(s.bonuses),
          craftAdena,
          craftOre,
          craftCry,
          craftFrags,
          pieces: pcs.map((p) => ({
            id: p.id,
            name: p.name,
            pdef: p.pdef,
            mdef: p.mdef,
            icon: iconHref(p.icon),
          })),
        };
      })
      .sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || b.bonusScore - a.bonusScore);

    const professions = Object.values(PROFESSIONS)
      .map((p) => {
        const armorPref = p.armorPref || ROLE_ARMOR_PREF[p.role] || STARTER_ARMOR_PREF[p.baseClass] || "";
        return {
          uid: "prof:" + p.id,
          id: p.id,
          name: p.name,
          tier: p.tier,
          role: p.role,
          roleRu: ROLE_RU[p.role] || p.role,
          classRu: CLASS_RU[p.baseClass] || p.baseClass,
          races: (p.races || []).map((r) => RACE_RU[r] || r).join(", "),
          armorPrefRu: KIND_RU[armorPref] || armorPref,
          weaponCatsRu: ((ROLE_WEAPON_CATS[p.role] || []).map((c) => WEAPON_CAT_LABELS[c] || c) || []).join(", "),
          passives: (p.passiveIds || []).length,
          overlays: (p.skillOverlay || []).length,
          icon: iconHref(p.icon),
        };
      })
      .sort(
        (a, b) =>
          String(a.races).localeCompare(b.races, "ru") || a.tier - b.tier || a.name.localeCompare(b.name, "ru")
      );

    const zones = FARM_ZONES.map((z) => {
      const mine = z.mine || {};
      const raceBonus = ZONE_RACE_BONUS[z.id] || {};
      return {
        uid: "zone:" + z.id,
        id: z.id,
        name: z.name,
        chapter: z.chapter,
        side: !!z.side,
        typeRu: z.side ? "Side / фарм" : "Сюжет",
        reqPower: z.reqPower,
        targetPower: z.targetPower,
        spawnMs: mine.spawnMs,
        goldenChance: mine.goldenChance,
        rewardScale: mine.rewardScale,
        icon: iconHref(z.icon),
        raceBonusText: Object.entries(raceBonus)
          .map(([r, v]) => (RACE_RU[r] || r) + " ×" + v)
          .join(", "),
        fragSets: (ARMOR_FRAG_ZONES[z.id] || []).join(", "),
      };
    });

    const collectibles = Object.values(COLLECTIBLES).map((c) => ({
      uid: "collectible:" + c.id,
      id: c.id,
      name: c.name,
      slot: c.slot,
      desc: c.desc || "",
      icon: iconHref(c.icon),
      bonuses: Object.entries(c.bonuses || {}).map(([k, v]) => ({
        label: BONUS_RU[k] || k,
        text: fmtBonusVal(k, v),
      })),
    }));

    const imbaFlags = [];
    ["D", "C", "B", "A"].forEach((grade) => {
      const top = weapons.filter((w) => w.grade === grade).sort((a, b) => b.effPatk - a.effPatk)[0];
      if (top && top.cat === "Bow" && top.effPatk >= (weapons.filter((w) => w.grade === grade && w.cat === "Sword").sort((a, b) => b.effPatk - a.effPatk)[0]?.effPatk || 0) * 1.25) {
        imbaFlags.push({
          severity: "warn",
          area: "weapon",
          title: "Лук топ eff.PATK грейда " + grade,
          detail: top.name + " eff " + top.effPatk + " (raw " + top.patk + " ×" + top.catMult + ")",
          ref: top.id,
        });
      }
    });
    const bowD = weapons.filter((w) => w.grade === "D" && w.cat === "Bow").sort((a, b) => b.effPatk - a.effPatk)[0];
    const swordD = weapons.filter((w) => w.grade === "D" && w.cat === "Sword").sort((a, b) => b.effPatk - a.effPatk)[0];
    if (bowD && swordD) {
      const ratio = Math.round((bowD.effPatk / Math.max(1, swordD.effPatk)) * 100) / 100;
      imbaFlags.push({
        severity: ratio >= 1.35 ? "hot" : "info",
        area: "weapon",
        title: "D: лук vs меч (eff.PATK)",
        detail:
          bowD.name +
          " " +
          bowD.effPatk +
          " vs " +
          swordD.name +
          " " +
          swordD.effPatk +
          " (×" +
          ratio +
          "; raw " +
          bowD.patk +
          ")",
        ref: bowD.id,
      });
    }
    ["Dualsword", "Fist"].forEach((cat) => {
      const dual = weapons.filter((w) => w.grade === "D" && w.cat === cat).sort((a, b) => b.effPatk - a.effPatk)[0];
      if (dual && swordD) {
        const ratio = Math.round((dual.effPatk / Math.max(1, swordD.effPatk)) * 100) / 100;
        if (ratio >= 1.12) {
          imbaFlags.push({
            severity: "warn",
            area: "weapon",
            title: "D: " + cat + " vs меч (eff.PATK)",
            detail: dual.name + " " + dual.effPatk + " vs " + swordD.effPatk + " (×" + ratio + ")",
            ref: dual.id,
          });
        }
      }
    });
    [...armorSets]
      .sort((a, b) => b.bonusScore - a.bonusScore)
      .slice(0, 4)
      .forEach((s) => {
        imbaFlags.push({
          severity: s.bonusScore >= 25 ? "hot" : "warn",
          area: "armor",
          title: "Сильный сет: " + s.name,
          detail:
            "score " +
            s.bonusScore +
            " · PDEF " +
            s.pdef +
            " / MDEF " +
            s.mdef +
            " · " +
            s.bonuses.map((b) => b.pieces + "pc: " + b.text).join(" · "),
          ref: s.id,
        });
      });

    imbaFlags.push({
      severity: "info",
      area: "affinity",
      title: "Affinity / mastery",
      detail:
        "Броня ×" +
        ARMOR_AFFINITY_MULT +
        " · Оружие ×" +
        WEAPON_MASTERY_MULT +
        " · off ×" +
        WEAPON_AFFINITY_OFF_MULT +
        " · hybrid ×" +
        WEAPON_AFFINITY_HYBRID_MULT,
      ref: "affinity",
    });

    const knobs = [
      { group: "Affinity", key: "ARMOR_AFFINITY_MULT", value: ARMOR_AFFINITY_MULT, note: "5/5 кусков pref" },
      { group: "Affinity", key: "WEAPON_MASTERY_MULT", value: WEAPON_MASTERY_MULT, note: "" },
      { group: "Affinity", key: "OFF / HYBRID", value: WEAPON_AFFINITY_OFF_MULT + " / " + WEAPON_AFFINITY_HYBRID_MULT, note: "" },
      {
        group: "Weapon",
        key: "CAT_POWER_MULT",
        value: Object.keys(WEAPON_CAT_POWER_MULT)
          .map((k) => k + "×" + WEAPON_CAT_POWER_MULT[k])
          .join(", ") || "—",
        note: "farm/fighter power",
      },
      { group: "Grade", key: "unlock D/C", value: "D@" + GRADE_UNLOCK_LEVEL.D + " / C@" + GRADE_UNLOCK_LEVEL.C, note: "" },
      {
        group: "Grade",
        key: "OVERLEVEL step/floor",
        value: (GRADE_OVERLEVEL_STEP != null ? GRADE_OVERLEVEL_STEP : "?") + " / " + (GRADE_OVERLEVEL_FLOOR != null ? GRADE_OVERLEVEL_FLOOR : "?"),
        note: "−step/ранг, floor; gap2≈" + GRADE_OVERLEVEL_MULT,
      },
      { group: "Enchant", key: "chanceBase/Step/Min", value: "0.72 / 0.048 / 0.12", note: "tune defaults" },
      { group: "Farm", key: "MINE_ADENA", value: (MINE_ADENA_REWARD.min || "?") + "–" + (MINE_ADENA_REWARD.max || "?"), note: "" },
      { group: "Farm", key: "GOLDEN", value: (MINE_ADENA_GOLDEN.min || "?") + "–" + (MINE_ADENA_GOLDEN.max || "?"), note: "" },
      { group: "Economy", key: "farmAdenaPerHour", value: (ECONOMY.farmAdenaPerHour || []).join(", "), note: "" },
      { group: "Auto", key: "intervalMs", value: AUTO_CLICKER.intervalMs, note: "" },
      { group: "PvP", key: "DEF_SOFT / ATK_SCALE", value: g("PVP_DEF_SOFT") + " / " + g("PVP_ATK_SCALE"), note: "" },
    ];

    return {
      meta: {
        version,
        generatedAt,
        live: true,
        counts: {
          weapons: weapons.length,
          armorSets: armorSets.length,
          armorPieces: ARMOR.length,
          professions: professions.length,
          zones: zones.length,
          collectibles: collectibles.length,
          outliers: outlierIds.size,
        },
      },
      knobs,
      imbaFlags,
      affinity: {
        armorMult: ARMOR_AFFINITY_MULT,
        weaponMult: WEAPON_MASTERY_MULT,
        offMult: WEAPON_AFFINITY_OFF_MULT,
        hybridMult: WEAPON_AFFINITY_HYBRID_MULT,
        gradeUnlock: GRADE_UNLOCK_LEVEL,
        overlevelMult: GRADE_OVERLEVEL_MULT,
        overlevelStep: GRADE_OVERLEVEL_STEP,
        overlevelFloor: GRADE_OVERLEVEL_FLOOR,
        roleArmor: ROLE_ARMOR_PREF,
        roleWeapons: ROLE_WEAPON_CATS,
        starterWeapons: STARTER_WEAPON_CATS,
        labels: { kind: KIND_RU, role: ROLE_RU, weaponCat: WEAPON_CAT_LABELS },
      },
      enchant: {
        safeLevel: g("SAFE_LEVEL") != null ? g("SAFE_LEVEL") : 3,
        chanceBase: 0.72,
        chanceStep: 0.048,
        chanceMin: 0.12,
        destructionChanceBase: 0.16,
        destructionChanceStep: 0.02,
        gradeValue: GRADE_VALUE,
        crystalValue: CRYSTAL_VALUE,
        crystalPlusMult: g("CRYSTAL_PLUS_MULT"),
        funpayWipe: g("FUNPAY_WIPE_CHANCE"),
        funpayReward: g("FUNPAY_REWARD"),
        collectibles,
        chanceTable: Array.from({ length: 16 }, (_, plus) => ({
          plus,
          normal: Math.round(Math.max(0.12, 0.72 - plus * 0.048) * 1000) / 10,
          destruction: Math.round(Math.min(1, 0.16 + plus * 0.02) * 1000) / 10,
        })),
      },
      economy: {
        ECONOMY,
        PASSIVE_INCOME,
        AUTO_CLICKER,
        farm: {
          MINE_ADENA_REWARD,
          MINE_ADENA_GOLDEN,
          MINE_GOLDEN_CHANCE: g("MINE_GOLDEN_CHANCE"),
          MINE_BANAN_CHANCE: g("MINE_BANAN_CHANCE"),
          BANAN_ADENA_REWARD: g("BANAN_ADENA_REWARD"),
        },
        workshop: { ORE, SHOT_BATCH, SHOT_RECIPE },
      },
      pvp: {
        DEF_SOFT: g("PVP_DEF_SOFT"),
        ATK_SCALE: g("PVP_ATK_SCALE"),
        VARIANCE: g("PVP_VARIANCE"),
        SKILL_MULT_CAP: g("PVP_SKILL_MULT_CAP"),
        GUARD_INCOMING_MULT: g("PVP_GUARD_INCOMING_MULT"),
        SHOT_MULT: g("PVP_SHOT_MULT"),
        HP_BASE: g("PVP_HP_BASE"),
        HP_PER_LVL: g("PVP_HP_PER_LVL"),
        HP_FROM_PDEF: g("PVP_HP_FROM_PDEF"),
        HP_FROM_MDEF: g("PVP_HP_FROM_MDEF"),
        MAX_ROUNDS: g("PVP_MAX_ROUNDS"),
      },
      categories: CATEGORIES,
      weapons,
      armorSets,
      professions,
      zones,
      fragDrop: ARMOR_FRAG_DROP,
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function start(prebuilt) {
    const DATA = prebuilt || (global.BALANCE_ATLAS && global.BALANCE_ATLAS.weapons ? global.BALANCE_ATLAS : null) || buildAtlas();
    if (!DATA || !DATA.meta) throw new Error("Нет данных атласа");
    global.BALANCE_ATLAS = DATA;
    let edits = {};
    try {
      edits = JSON.parse(localStorage.getItem(LS) || "{}") || {};
    } catch (e) {
      edits = {};
    }

    const TABS = [
      { id: "overview", label: "Обзор / имба" },
      { id: "weapons", label: "Оружие" },
      { id: "armor", label: "Броня" },
      { id: "affinity", label: "Affinity" },
      { id: "enchant", label: "Заточка" },
      { id: "zones", label: "Зоны" },
      { id: "economy", label: "Экономика" },
      { id: "pvp", label: "PvP" },
      { id: "prof", label: "Профессии" },
    ];

    let tab = "overview";
    let sortKey = "score";
    let sortDir = -1;

    const tabsEl = document.getElementById("tabs");
    const panelsEl = document.getElementById("panels");
    const toolbar = document.getElementById("toolbar");
    const metaEl = document.getElementById("meta");

    metaEl.textContent =
      "v" +
      DATA.meta.version +
      " · " +
      DATA.meta.generatedAt +
      " · " +
      (DATA.meta.live ? "live из game/src" : "снимок") +
      " · оружие " +
      DATA.meta.counts.weapons +
      " · сеты " +
      DATA.meta.counts.armorSets +
      " · outliers " +
      DATA.meta.counts.outliers;

    tabsEl.innerHTML = "";
    TABS.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab" + (t.id === tab ? " on" : "");
      b.textContent = t.label;
      b.dataset.tab = t.id;
      b.onclick = () => {
        tab = t.id;
        render();
      };
      tabsEl.appendChild(b);
    });

    function saveEdits() {
      localStorage.setItem(LS, JSON.stringify(edits));
    }
    function markDirty(uid) {
      return edits[uid] && (edits[uid].propose || edits[uid].note);
    }
    function editFields(uid, compact) {
      const e = edits[uid] || {};
      return (
        '<div class="edit-box' +
        (compact ? " compact" : "") +
        '" data-uid="' +
        esc(uid) +
        '">' +
        '<label>Предложение<textarea class="propose" placeholder="Что поменять и почему (имба / слабо / кривая)…">' +
        esc(e.propose || "") +
        "</textarea></label>" +
        '<label>Комментарий<textarea class="note" placeholder="Контекст, билд, глава…">' +
        esc(e.note || "") +
        "</textarea></label>" +
        "</div>"
      );
    }
    function bindEdits(root) {
      root.querySelectorAll(".edit-box").forEach((box) => {
        const uid = box.dataset.uid;
        const on = () => {
          const propose = box.querySelector(".propose").value.trim();
          const note = box.querySelector(".note").value.trim();
          if (!propose && !note) delete edits[uid];
          else edits[uid] = { propose, note, tab };
          saveEdits();
          const row = box.closest("tr, .card");
          if (row) row.classList.toggle("is-dirty", !!(propose || note));
          updateStats();
        };
        box.querySelector(".propose").oninput = on;
        box.querySelector(".note").oninput = on;
      });
    }
    function exportJson() {
      const payload = {
        meta: DATA.meta,
        exportedAt: new Date().toISOString(),
        edits: Object.keys(edits).map((uid) => ({ uid, ...edits[uid] })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "soulforge-balance-feedback.json";
      a.click();
    }
    function exportCsv() {
      const lines = ["uid;tab;propose;note"];
      Object.keys(edits).forEach((uid) => {
        const e = edits[uid];
        const cell = (s) => '"' + String(s || "").replace(/"/g, '""') + '"';
        lines.push([cell(uid), cell(e.tab), cell(e.propose), cell(e.note)].join(";"));
      });
      const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "soulforge-balance-feedback.csv";
      a.click();
    }
    function clearEdits() {
      if (!confirm("Сбросить все правки в браузере?")) return;
      edits = {};
      saveEdits();
      render();
    }
    function updateStats() {
      const n = Object.keys(edits).length;
      const el = document.getElementById("stats");
      if (el) el.textContent = n ? "правок: " + n : "";
    }

    function renderToolbar() {
      let extra = "";
      if (tab === "weapons") {
        extra =
          '<label>Грейд <select id="fGrade"><option value="">Все</option><option>D</option><option>C</option><option>B</option><option>A</option></select></label>' +
          '<label>Кат <select id="fCat"><option value="">Все</option>' +
          (DATA.categories || [])
            .map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name || c.id) + "</option>")
            .join("") +
          "</select></label>" +
          '<label>Kind <select id="fKind"><option value="">Все</option><option value="physical">Физ</option><option value="magical">Маг</option><option value="hybrid">Гибрид</option></select></label>' +
          '<label><input type="checkbox" id="fOut" /> outliers</label>' +
          '<label>Поиск <input type="search" id="fQ" placeholder="Shyeed, Bow…" /></label>';
      } else if (tab === "armor") {
        extra =
          '<label>Грейд <select id="fGrade"><option value="">Все</option><option>D</option><option>C</option></select></label>' +
          '<label>Вид <select id="fKind"><option value="">Все</option><option value="heavy">Тяжёлая</option><option value="light">Лёгкая</option><option value="robe">Роба</option></select></label>' +
          '<label>Поиск <input type="search" id="fQ" placeholder="Mithril…" /></label>';
      } else if (tab === "prof") {
        extra = '<label>Поиск <input type="search" id="fQ" placeholder="Hawkeye…" /></label>';
      }
      toolbar.innerHTML =
        extra +
        '<button type="button" class="btn" id="btnJson">Скачать правки JSON</button>' +
        '<button type="button" class="btn ghost" id="btnCsv">CSV</button>' +
        '<button type="button" class="btn ghost" id="btnClear">Сбросить</button>' +
        '<span id="stats"></span>';
      document.getElementById("btnJson").onclick = exportJson;
      document.getElementById("btnCsv").onclick = exportCsv;
      document.getElementById("btnClear").onclick = clearEdits;
      ["fGrade", "fCat", "fKind", "fOut", "fQ"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.oninput = el.onchange = () => renderPanel();
      });
      updateStats();
    }

    function renderOverview() {
      const c = DATA.meta.counts;
      let html = '<div class="cards">';
      html +=
        '<div class="card"><h3>Каталог (live)</h3><div class="dim">Оружие ' +
        c.weapons +
        " · сеты " +
        c.armorSets +
        " · куски " +
        c.armorPieces +
        "<br>Профессии " +
        c.professions +
        " · зоны " +
        c.zones +
        " · эпики " +
        c.collectibles +
        "<br>Outliers: " +
        c.outliers +
        "</div></div>";
      (DATA.imbaFlags || []).forEach((f) => {
        html +=
          '<div class="card ' +
          esc(f.severity) +
          '"><div class="sev ' +
          esc(f.severity) +
          '">' +
          esc(f.severity) +
          " · " +
          esc(f.area) +
          "</div><h3>" +
          esc(f.title) +
          '</h3><div class="dim">' +
          esc(f.detail) +
          "</div>" +
          editFields(f.ref ? "flag:" + f.ref : "flag:" + f.title) +
          "</div>";
      });
      html += '</div><h3 style="margin:18px 0 8px;color:var(--gold)">Ключевые константы</h3><div class="kv">';
      (DATA.knobs || []).forEach((k) => {
        html +=
          "<div><b>" +
          esc(k.group) +
          " · " +
          esc(k.key) +
          "</b></div><div>" +
          esc(k.value) +
          (k.note ? ' <span class="dim">(' + esc(k.note) + ")</span>" : "") +
          "</div>";
      });
      html += "</div>";
      return html;
    }

    function renderWeapons() {
      const grade = (document.getElementById("fGrade") || {}).value || "";
      const cat = (document.getElementById("fCat") || {}).value || "";
      const kind = (document.getElementById("fKind") || {}).value || "";
      const onlyOut = !!(document.getElementById("fOut") || {}).checked;
      const q = ((document.getElementById("fQ") || {}).value || "").toLowerCase().trim();
      let rows = DATA.weapons.filter((w) => {
        if (grade && w.grade !== grade) return false;
        if (cat && w.cat !== cat) return false;
        if (kind && w.weaponKind !== kind) return false;
        if (onlyOut && !w.outlier) return false;
        if (q && !(w.name + " " + w.id + " " + w.cat).toLowerCase().includes(q)) return false;
        return true;
      });
      rows.sort((a, b) => {
        const av = a[sortKey],
          bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
        return String(av).localeCompare(String(bv), "ru") * sortDir;
      });
      let html =
        '<table class="grid"><thead><tr>' +
        ["", "", "grade", "cat", "kind", "name", "patk", "eff", "matk", "cc", "score", "предложение"]
          .map((h) => {
            if (["patk", "eff", "matk", "cc", "score", "name", "grade"].includes(h)) {
              return (
                '<th data-sort="' +
                (h === "eff" ? "effPatk" : h) +
                '">' +
                h +
                (sortKey === (h === "eff" ? "effPatk" : h) ? (sortDir > 0 ? " ↑" : " ↓") : "") +
                "</th>"
              );
            }
            return "<th>" + h + "</th>";
          })
          .join("") +
        "</tr></thead><tbody>";
      rows.forEach((w) => {
        html +=
          '<tr class="' +
          (w.outlier ? "out " : "") +
          (markDirty(w.uid) ? "is-dirty" : "") +
          '"><td>' +
          (w.icon ? '<img class="ico" src="' + esc(w.icon) + '" alt="" />' : "") +
          "</td><td>" +
          (w.outlier ? '<span class="chip out">' + esc((w.flags || []).join(" ")) + "</span>" : "") +
          "</td><td>" +
          esc(w.grade) +
          "</td><td>" +
          esc(w.cat) +
          "</td><td>" +
          esc(w.weaponKindRu) +
          "</td><td>" +
          esc(w.name) +
          '<div class="dim">' +
          esc(w.id) +
          '</div></td><td class="num">' +
          w.patk +
          '</td><td class="num">' +
          w.effPatk +
          (w.catMult !== 1 ? '<div class="dim">×' + w.catMult + "</div>" : "") +
          '</td><td class="num">' +
          w.matk +
          '</td><td class="num">' +
          w.cc +
          '</td><td class="num">' +
          w.score +
          "</td><td>" +
          editFields(w.uid, true) +
          "</td></tr>";
      });
      html +=
        '</tbody></table><div class="dim" style="margin-top:8px">Показано ' +
        rows.length +
        " / " +
        DATA.weapons.length +
        ". Outlier = ≥ mean+1.4σ внутри грейд+кат.</div>";
      return html;
    }

    function renderArmor() {
      const grade = (document.getElementById("fGrade") || {}).value || "";
      const kind = (document.getElementById("fKind") || {}).value || "";
      const q = ((document.getElementById("fQ") || {}).value || "").toLowerCase().trim();
      const sets = DATA.armorSets.filter((s) => {
        if (grade && s.grade !== grade) return false;
        if (kind && s.kind !== kind) return false;
        if (q && !(s.name + " " + s.id).toLowerCase().includes(q)) return false;
        return true;
      });
      let html = '<div class="cards">';
      sets.forEach((s) => {
        html +=
          '<div class="card ' +
          (markDirty(s.uid) ? "is-dirty " : "") +
          (s.bonusScore >= 25 ? "hot" : "") +
          '"><div class="row">' +
          (s.icon ? '<img class="ico" src="' + esc(s.icon) + '" alt="" />' : "") +
          "<div><h3>" +
          esc(s.name) +
          '</h3><div class="dim">' +
          esc(s.grade) +
          " · " +
          esc(s.kindRu) +
          " · " +
          esc(s.farmZoneId) +
          ' · score <b style="color:var(--gold)">' +
          s.bonusScore +
          "</b></div></div></div>" +
          '<div class="dim" style="margin-top:6px">PDEF ' +
          s.pdef +
          " · MDEF " +
          s.mdef +
          " · крафт: " +
          s.craftFrags +
          " frag / " +
          s.craftCry +
          " cry / " +
          s.craftOre +
          " ore / " +
          Number(s.craftAdena).toLocaleString("ru-RU") +
          " adena</div>";
        (s.bonuses || []).forEach((b) => {
          html += '<div class="bonus-line"><b>' + b.pieces + "</b> шт: " + esc(b.text) + "</div>";
        });
        html +=
          '<div class="pieces">' +
          (s.pieces || [])
            .map((p) =>
              p.icon
                ? '<img class="piece" title="' +
                  esc(p.name) +
                  " P" +
                  p.pdef +
                  "/M" +
                  p.mdef +
                  '" src="' +
                  esc(p.icon) +
                  '" />'
                : ""
            )
            .join("") +
          "</div>" +
          editFields(s.uid) +
          "</div>";
      });
      return html + "</div>";
    }

    function renderAffinity() {
      const a = DATA.affinity;
      let html =
        '<div class="kv"><div><b>Armor affinity</b></div><div>×' +
        a.armorMult +
        "</div><div><b>Weapon mastery</b></div><div>×" +
        a.weaponMult +
        "</div><div><b>Off / hybrid</b></div><div>×" +
        a.offMult +
        " / ×" +
        a.hybridMult +
        "</div><div><b>Grade unlock</b></div><div>D@" +
        a.gradeUnlock.D +
        " · C@" +
        a.gradeUnlock.C +
        "</div><div><b>Overlevel</b></div><div>−" +
        Math.round((a.overlevelStep || 0.4) * 100) +
        "%/ранг · floor ×" +
        (a.overlevelFloor != null ? a.overlevelFloor : 0.1) +
        " (броня + оружие)" +
        '</div></div><h3 style="margin:16px 0 8px;color:var(--gold)">Роль → броня / оружие</h3><div class="cards">';
      Object.keys(a.roleArmor || {}).forEach((role) => {
        const uid = "affinity:role:" + role;
        html +=
          '<div class="card ' +
          (markDirty(uid) ? "is-dirty" : "") +
          '"><h3>' +
          esc((a.labels.role || {})[role] || role) +
          '</h3><div class="dim">Броня: ' +
          esc((a.labels.kind || {})[a.roleArmor[role]] || a.roleArmor[role]) +
          "<br>Оружие: " +
          esc((a.roleWeapons[role] || []).map((c) => (a.labels.weaponCat || {})[c] || c).join(", ")) +
          "</div>" +
          editFields(uid) +
          "</div>";
      });
      return html + "</div>";
    }

    function renderEnchant() {
      const e = DATA.enchant;
      let html =
        '<div class="kv"><div><b>Safe</b></div><div>+' +
        e.safeLevel +
        "</div><div><b>Chance</b></div><div>" +
        e.chanceBase +
        " − " +
        e.chanceStep +
        " · min " +
        e.chanceMin +
        "</div><div><b>Destruction</b></div><div>" +
        e.destructionChanceBase +
        " + " +
        e.destructionChanceStep +
        "</div><div><b>Sell D–A</b></div><div>" +
        [e.gradeValue.D, e.gradeValue.C, e.gradeValue.B, e.gradeValue.A]
          .map((n) => Number(n || 0).toLocaleString("ru-RU"))
          .join(" / ") +
        '</div></div><h3 style="margin:16px 0 8px;color:var(--gold)">Кривая (без бонусов)</h3><table class="grid"><thead><tr><th>+</th><th>Обычный %</th><th>Разрушение %</th></tr></thead><tbody>';
      e.chanceTable.forEach((r) => {
        html +=
          "<tr><td>+" +
          r.plus +
          '</td><td class="num">' +
          r.normal +
          '</td><td class="num">' +
          r.destruction +
          "</td></tr>";
      });
      html += '</tbody></table><h3 style="margin:16px 0 8px;color:var(--gold)">Эпики</h3><div class="cards">';
      (e.collectibles || []).forEach((c) => {
        html +=
          '<div class="card ' +
          (markDirty(c.uid) ? "is-dirty" : "") +
          '"><div class="row">' +
          (c.icon ? '<img class="ico" src="' + esc(c.icon) + '" />' : "") +
          "<div><h3>" +
          esc(c.name) +
          '</h3><div class="dim">' +
          esc(c.slot) +
          "</div><div>" +
          (c.bonuses || [])
            .map((b) => '<span class="chip">' + esc(b.label) + " " + esc(b.text) + "</span>")
            .join("") +
          '</div><div class="dim">' +
          esc(c.desc) +
          "</div></div></div>" +
          editFields(c.uid) +
          "</div>";
      });
      return html + "</div>";
    }

    function renderZones() {
      let html =
        '<table class="grid"><thead><tr><th></th><th>Гл</th><th>Тип</th><th>Зона</th><th>reqP</th><th>targetP</th><th>spawn</th><th>scale</th><th>фраги</th><th>раса</th><th>предложение</th></tr></thead><tbody>';
      DATA.zones.forEach((z) => {
        html +=
          '<tr class="' +
          (markDirty(z.uid) ? "is-dirty" : "") +
          '"><td>' +
          (z.icon ? '<img class="ico" src="' + esc(z.icon) + '" />' : "") +
          "</td><td>" +
          z.chapter +
          "</td><td>" +
          esc(z.typeRu) +
          "</td><td>" +
          esc(z.name) +
          '<div class="dim">' +
          esc(z.id) +
          '</div></td><td class="num">' +
          z.reqPower +
          '</td><td class="num">' +
          z.targetPower +
          '</td><td class="num">' +
          z.spawnMs +
          '</td><td class="num">' +
          z.rewardScale +
          '</td><td class="dim">' +
          esc(z.fragSets || "—") +
          '</td><td class="dim">' +
          esc(z.raceBonusText || "—") +
          "</td><td>" +
          editFields(z.uid, true) +
          "</td></tr>";
      });
      const fd = DATA.fragDrop || {};
      return (
        html +
        '</tbody></table><div class="dim" style="margin-top:10px">Frag drop: normal ' +
        fd.normal +
        " · golden " +
        fd.golden +
        " · boss " +
        fd.boss +
        "</div>"
      );
    }

    function renderEconomy() {
      const e = DATA.economy;
      let html = '<div class="kv">';
      html +=
        "<div><b>Farm adena/час</b></div><div>" +
        (e.ECONOMY.farmAdenaPerHour || []).map((n) => Number(n).toLocaleString("ru-RU")).join(" · ") +
        "</div>";
      html += "<div><b>Passive of farm</b></div><div>" + e.ECONOMY.passiveOfFarm + "</div>";
      html +=
        "<div><b>Mine adena</b></div><div>" +
        e.farm.MINE_ADENA_REWARD.min +
        "–" +
        e.farm.MINE_ADENA_REWARD.max +
        " / golden " +
        e.farm.MINE_ADENA_GOLDEN.min +
        "–" +
        e.farm.MINE_ADENA_GOLDEN.max +
        "</div>";
      html +=
        "<div><b>Golden / banan</b></div><div>" +
        e.farm.MINE_GOLDEN_CHANCE +
        " / " +
        e.farm.MINE_BANAN_CHANCE +
        "</div>";
      html += "<div><b>Auto interval</b></div><div>" + e.AUTO_CLICKER.intervalMs + " ms</div>";
      html +=
        "<div><b>Auto packs</b></div><div>" +
        (e.AUTO_CLICKER.packs || [])
          .map((p) => p.label + "=" + Number(p.price).toLocaleString("ru-RU"))
          .join(" · ") +
        "</div>";
      ["D", "C", "B", "A"].forEach((gr) => {
        const r = (e.workshop.SHOT_RECIPE || {})[gr];
        if (!r) return;
        html +=
          "<div><b>Shot " + gr + "</b></div><div>cry " + r.cry + " · ore " + r.ore + " · sell " + r.sell + "/шт</div>";
      });
      html += "</div>" + editFields("economy:global");
      return html;
    }

    function renderPvp() {
      const p = DATA.pvp;
      let html = '<div class="kv">';
      Object.keys(p).forEach((k) => {
        html += "<div><b>" + esc(k) + "</b></div><div>" + esc(p[k]) + "</div>";
      });
      return html + "</div>" + editFields("pvp:global");
    }

    function renderProf() {
      const q = ((document.getElementById("fQ") || {}).value || "").toLowerCase().trim();
      const rows = DATA.professions.filter((p) => {
        if (!q) return true;
        return (p.name + " " + p.roleRu + " " + p.races + " " + p.weaponCatsRu).toLowerCase().includes(q);
      });
      let html =
        '<div class="cards">';
      rows.forEach((p) => {
        html +=
          '<div class="card ' +
          (markDirty(p.uid) ? "is-dirty" : "") +
          '"><div class="row">' +
          (p.icon ? '<img class="ico" src="' + esc(p.icon) + '" />' : "") +
          "<div><h3>" +
          esc(p.name) +
          '</h3><div class="dim">T' +
          p.tier +
          " · " +
          esc(p.races) +
          " · " +
          esc(p.classRu) +
          " · " +
          esc(p.roleRu) +
          "<br>Броня: " +
          esc(p.armorPrefRu) +
          " · Оружие: " +
          esc(p.weaponCatsRu) +
          "<br>Скиллы: " +
          p.passives +
          "p / " +
          p.overlays +
          "a</div></div></div>" +
          editFields(p.uid) +
          "</div>";
      });
      return html + "</div>";
    }

    function renderPanel() {
      const map = {
        overview: renderOverview,
        weapons: renderWeapons,
        armor: renderArmor,
        affinity: renderAffinity,
        enchant: renderEnchant,
        zones: renderZones,
        economy: renderEconomy,
        pvp: renderPvp,
        prof: renderProf,
      };
      panelsEl.innerHTML = '<div class="panel">' + (map[tab] || renderOverview)() + "</div>";
      bindEdits(panelsEl);
      panelsEl.querySelectorAll("th[data-sort]").forEach((th) => {
        th.onclick = () => {
          const k = th.dataset.sort;
          if (sortKey === k) sortDir *= -1;
          else {
            sortKey = k;
            sortDir = k === "name" || k === "grade" ? 1 : -1;
          }
          renderPanel();
        };
      });
      updateStats();
    }

    function render() {
      [...tabsEl.children].forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
      renderToolbar();
      renderPanel();
    }

    render();
  }

  global.BalanceAtlasApp = { start, buildAtlas };
})(typeof window !== "undefined" ? window : globalThis);
