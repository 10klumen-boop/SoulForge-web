// ===== Профессии: UI (баннер + модалка выбора) =====

function setProfessionPickOpen(open) {
  const el = document.getElementById("professionPickBackdrop");
  if (!el) return;
  el.hidden = !open;
  if (open) {
    if (typeof setGamePaused === "function") setGamePaused(true);
  } else if (typeof syncGamePauseState === "function") {
    syncGamePauseState();
  } else if (typeof setGamePaused === "function") {
    setGamePaused(false);
  }
}

function professionTierTitle(tier) {
  if (tier === 1) return "Выбор 1-й профессии";
  if (tier === 2) return "Выбор 2-й профессии";
  return "Выбор профессии";
}

function renderProfessionPickModal() {
  const grid = document.getElementById("professionPickGrid");
  const title = document.getElementById("professionPickTitle");
  const lead = document.getElementById("professionPickLead");
  if (!grid) return;
  const a = state.avatar;
  const choices = typeof availableProfessionChoices === "function" ? availableProfessionChoices(a) : [];
  const tier = typeof pendingProfessionTier === "function" ? pendingProfessionTier(a) : 0;
  if (title) title.textContent = professionTierTitle(tier);
  if (lead) {
    const starter =
      typeof avatarClassInfo === "function"
        ? avatarClassInfo(a.classId, a.raceId)?.name
        : a.classId;
    const cur =
      typeof currentProfession === "function" && currentProfession(a)
        ? currentProfession(a).name
        : starter;
    lead.textContent =
      "Сейчас: " +
      (cur || "—") +
      " · ур. " +
      (a.level || 1) +
      ". Выбери ветку — обратно сменить нельзя.";
  }
  grid.innerHTML = "";
  choices.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "avatar-pick-card";
    const pref = p.armorPref || "";
    const prefLabel =
      (typeof ARMOR_KIND_LABELS !== "undefined" && ARMOR_KIND_LABELS[pref]) || pref;
    const passiveBlurb = (p.passiveIds || [])
      .map((id) => (typeof passiveSkillById === "function" ? passiveSkillById(id) : null))
      .filter(Boolean)
      .map((s) => s.blurb || s.name)
      .join(" · ");
    btn.innerHTML =
      '<img src="' +
      (p.icon || "") +
      '" alt="">' +
      "<strong>" +
      p.name +
      "</strong>" +
      "<span>" +
      (p.desc || "") +
      "</span>" +
      (prefLabel
        ? '<small class="avatar-race-passive"><span>Броня: ' + prefLabel + "</span></small>"
        : "") +
      (passiveBlurb
        ? '<small class="avatar-race-passive"><span>' + passiveBlurb + "</span></small>"
        : "");
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      if (typeof chooseProfession === "function" && chooseProfession(p.id)) {
        setProfessionPickOpen(false);
      }
    };
    grid.appendChild(btn);
  });
}

function openProfessionPickModal() {
  if (typeof canChooseProfession !== "function" || !canChooseProfession(state.avatar)) {
    if (typeof toast === "function") toast("Смена класса пока недоступна", "warn");
    return;
  }
  renderProfessionPickModal();
  setProfessionPickOpen(true);
}

function closeProfessionPickModal() {
  setProfessionPickOpen(false);
}

function renderProfessionBanner() {
  const el = document.getElementById("avatarProfessionBanner");
  const classEl = document.getElementById("avatarClass");
  if (!el) return;

  const canPick =
    state.avatar?.created &&
    typeof canChooseProfession === "function" &&
    canChooseProfession(state.avatar);

  if (!canPick) {
    el.hidden = true;
    el.textContent = "";
    if (classEl) classEl.classList.remove("avatar-class--pickable");
    return;
  }

  const tier = typeof pendingProfessionTier === "function" ? pendingProfessionTier(state.avatar) : 0;
  const need =
    typeof PROFESSION_TIER_LEVELS !== "undefined" ? PROFESSION_TIER_LEVELS[tier] : tier === 1 ? 10 : 40;
  el.hidden = false;
  el.textContent =
    (tier === 1 ? "Выбрать 1-ю профессию" : "Выбрать 2-ю профессию") +
    " (с ур. " +
    need +
    ") →";
  if (classEl) classEl.classList.add("avatar-class--pickable");
}

function bindProfessionPickUi() {
  const later = document.getElementById("professionPickLater");
  if (later && !later._sfBound) {
    later._sfBound = true;
    later.addEventListener("click", () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      closeProfessionPickModal();
    });
  }
  const banner = document.getElementById("avatarProfessionBanner");
  if (banner && !banner._sfBound) {
    banner._sfBound = true;
    banner.addEventListener("click", () => {
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      openProfessionPickModal();
    });
  }
  const classEl = document.getElementById("avatarClass");
  if (classEl && !classEl._sfProfBound) {
    classEl._sfProfBound = true;
    classEl.addEventListener("click", () => {
      if (!classEl.classList.contains("avatar-class--pickable")) return;
      if (typeof Audio2 !== "undefined" && Audio2.click) Audio2.click();
      openProfessionPickModal();
    });
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindProfessionPickUi);
  } else {
    bindProfessionPickUi();
  }
}
