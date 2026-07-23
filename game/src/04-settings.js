let pipWindow = null;
const isDesktopApp = !!(window.soulforgeDesktop && window.soulforgeDesktop.isDesktop);

const AUDIO_VOL_CHANNELS = [
  { id: "music", key: "music", label: "Музыка" },
  { id: "sfx", key: "sfx", label: "Эффекты" },
  { id: "ui", key: "ui", label: "Интерфейс" },
  { id: "amb", key: "amb", label: "Атмосфера" },
  { id: "voice", key: "voice", label: "Голоса" },
];

function pctFromVol(v) {
  return Math.round(Math.max(0, Math.min(1, v || 0)) * 100);
}

function volFromPct(p) {
  return Math.max(0, Math.min(1, (Number(p) || 0) / 100));
}

function syncSettingsUI() {
  const muteBtn = $("#settMute");
  if (muteBtn) {
    muteBtn.textContent = state.muted ? "Выкл" : "Вкл";
    muteBtn.classList.toggle("on", !state.muted);
  }

  if (typeof syncChatMobileSettingUi === "function") syncChatMobileSettingUi();

  if (typeof defaultAudioVol === "function") {
    if (!state.audioVol || typeof state.audioVol !== "object") state.audioVol = defaultAudioVol();
    AUDIO_VOL_CHANNELS.forEach((ch) => {
      const slider = document.getElementById("settVol" + ch.id.charAt(0).toUpperCase() + ch.id.slice(1));
      const valEl = document.getElementById("settVol" + ch.id.charAt(0).toUpperCase() + ch.id.slice(1) + "Val");
      const v = state.audioVol[ch.key];
      const pct = pctFromVol(v);
      if (slider) slider.value = String(pct);
      if (valEl) valEl.textContent = pct + "%";
    });
  }
}

function setAudioChannel(key, pct) {
  if (typeof defaultAudioVol !== "function") return;
  if (!state.audioVol || typeof state.audioVol !== "object") state.audioVol = defaultAudioVol();
  state.audioVol[key] = volFromPct(pct);
  save();
  syncSettingsUI();
  if (typeof Audio2 !== "undefined" && Audio2.refreshVolumes) Audio2.refreshVolumes();
}

function wireAudioVolumeSettings() {
  AUDIO_VOL_CHANNELS.forEach((ch) => {
    const cap = ch.id.charAt(0).toUpperCase() + ch.id.slice(1);
    const slider = document.getElementById("settVol" + cap);
    if (!slider || slider.dataset.wired) return;
    slider.dataset.wired = "1";
    slider.addEventListener("input", () => {
      setAudioChannel(ch.key, slider.value);
    });
  });
}

function setSettingsOpen(open) {
  const pop = $("#settingsPop");
  if (pop) pop.hidden = false;
  const btn = $("#settingsBtn");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleMute() {
  state.muted = !state.muted;
  save();
  syncSettingsUI();
  if (typeof Audio2 !== "undefined") {
    if (Audio2.refreshVolumes) Audio2.refreshVolumes();
    else if (state.muted && Audio2.stopAmbience) {
      Audio2.stopAmbience();
      if (Audio2.stopMusic) Audio2.stopMusic();
    } else if (Audio2.refreshAmbience) Audio2.refreshAmbience();
  }
}

function copyStylesTo(targetDoc) {
  document.querySelectorAll("style, link[rel=stylesheet]").forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });
}

function restoreFromPip() {
  const app = document.querySelector(".app");
  const toastEl = $("#toast");
  if (app && app.parentElement !== document.body) document.body.insertBefore(app, toastEl);
  if (toastEl && toastEl.parentElement !== document.body) document.body.appendChild(toastEl);
  pipWindow = null;
  if (state.alwaysOnTop) { state.alwaysOnTop = false; save(); syncSettingsUI(); }
}

async function enableAlwaysOnTop() {
  if (!window.documentPictureInPicture) {
    toast("Режим «поверх окон» — только Chrome / Edge");
    return false;
  }
  if (pipWindow && !pipWindow.closed) return true;
  try {
    pipWindow = await documentPictureInPicture.requestWindow({ width: 1000, height: 720 });
    const pipDoc = pipWindow.document;
    pipDoc.title = document.title;
    const base = pipDoc.createElement("base");
    base.href = new URL("./", window.location.href).href;
    pipDoc.head.appendChild(base);
    copyStylesTo(pipDoc);
    pipDoc.body.style.cssText = "margin:0;padding:16px;min-height:100vh;background:#100c08;color:#d9cdb2;display:flex;align-items:center;justify-content:center;overflow:hidden;";
    const app = document.querySelector(".app");
    const toastEl = $("#toast");
    pipDoc.body.appendChild(app);
    pipDoc.body.appendChild(toastEl);
    pipWindow.addEventListener("pagehide", restoreFromPip, { once: true });
    return true;
  } catch (e) {
    pipWindow = null;
    return false;
  }
}

async function toggleAlwaysOnTop() {
  if (state.alwaysOnTop) {
    if (isDesktopApp) await window.soulforgeDesktop.setAlwaysOnTop(false);
    else {
      if (pipWindow && !pipWindow.closed) pipWindow.close();
      else restoreFromPip();
    }
    state.alwaysOnTop = false;
  } else {
    let ok = false;
    if (isDesktopApp) ok = await window.soulforgeDesktop.setAlwaysOnTop(true);
    else ok = await enableAlwaysOnTop();
    if (!ok) { toast("Не удалось включить режим поверх окон"); return; }
    state.alwaysOnTop = true;
  }
  save();
  syncSettingsUI();
}
