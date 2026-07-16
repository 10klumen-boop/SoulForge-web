const PORTABLE_MAGIC = "SF2SAVE";
const PORTABLE_VER = 1;

function b64FromBytes(bytes) {
  let s = "";
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function bytesFromB64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function portableKey() {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(_savePepper + "|export|aes256"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptEnvelope(env) {
  const key = await portableKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(env));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { magic: PORTABLE_MAGIC, ver: PORTABLE_VER, iv: b64FromBytes(iv), ct: b64FromBytes(new Uint8Array(ct)) };
}

async function decryptPortable(text) {
  const trimmed = text.trim();
  let pack;
  if (trimmed.startsWith(PORTABLE_MAGIC + "1:")) {
    pack = JSON.parse(trimmed.slice(PORTABLE_MAGIC.length + 2));
  } else {
    pack = JSON.parse(trimmed);
  }
  if (!pack || pack.magic !== PORTABLE_MAGIC || pack.ver !== PORTABLE_VER) throw new Error("format");
  const key = await portableKey();
  const iv = bytesFromB64(pack.iv);
  const ct = bytesFromB64(pack.ct);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  const env = JSON.parse(new TextDecoder().decode(plain));
  if (!verifyEnvelope(env)) throw new Error("sig");
  return env;
}

function portableFilename() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `soulforge-${stamp}.sfsave`;
}

function shortPath(filePath) {
  if (!filePath) return "";
  const parts = filePath.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : filePath;
}

async function buildPortablePayload() {
  const env = getCurrentEnvelope();
  const pack = await encryptEnvelope(env);
  return PORTABLE_MAGIC + PORTABLE_VER + ":" + JSON.stringify(pack);
}

async function desktopExport(line, name, portable) {
  const api = window.soulforgeDesktop;
  if (!api) return null;
  try {
    if (portable && api.exportSaveQuick) {
      const quick = await api.exportSaveQuick(name, line);
      if (quick?.ok) return quick;
    }
    if (api.exportSave) {
      return await api.exportSave(name, line);
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
  return null;
}

function saveTransferAllowed() {
  if (!FEATURE_SAVE_TRANSFER) return false;
  if (typeof CLOUD_CONFIG !== "undefined" && CLOUD_CONFIG.enabled && CLOUD_CONFIG.baseUrl) return false;
  return true;
}

async function exportPortableSave() {
  if (!saveTransferAllowed()) return;
  if (!window.crypto?.subtle) { toast("Шифрование недоступно в этом браузере"); return; }
  try {
    const line = await buildPortablePayload();
    const name = portableFilename();
    const info = window.soulforgeDesktop?.portableInfo ? await window.soulforgeDesktop.portableInfo().catch(() => null) : null;
    const portable = !!info?.portable;
    const desktop = await desktopExport(line, name, portable);
    if (desktop) {
      if (desktop.ok) {
        toast(portable ? "Экспорт рядом с exe: " + shortPath(desktop.filePath) : "Сохранение экспортировано");
        return;
      }
      if (desktop.canceled) return;
      toast("Не удалось экспортировать" + (desktop.error ? ": " + desktop.error : "") + (portable ? "" : " — пересоберите desktop/dist-portable.bat"));
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([line], { type: "application/octet-stream" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Сохранение экспортировано");
  } catch (e) {
    toast("Не удалось экспортировать: " + (e.message || "ошибка шифрования"));
  }
}

async function importPortableSave(text, allowOlder) {
  if (!saveTransferAllowed()) return false;
  if (!window.crypto?.subtle) { toast("Шифрование недоступно в этом браузере"); return false; }
  try {
    const env = await decryptPortable(text);
    const result = applyEnvelope(env, { allowOlder: !!allowOlder });
    if (!result.ok) {
      if (result.reason === "older") return false;
      toast(result.reason === "bad_sig" ? "Файл повреждён или изменён" : "Импорт отклонён");
      return false;
    }
    refreshProgressUI();
    toast(allowOlder ? "Сохранение восстановлено (откат)" : "Сохранение импортировано");
    return true;
  } catch (e) {
    toast("Неверный или повреждённый файл .sfsave");
    return false;
  }
}

async function confirmAndImportPortable(text) {
  const preview = await decryptPortable(text).catch(() => null);
  if (!preview) { toast("Неверный или повреждённый файл .sfsave"); return; }
  const localMax = maxStoredSeq();
  let allowOlder = false;
  if (preview.seq < localMax) {
    allowOlder = await showConfirm({
      title: "Откат прогресса",
      message:
        `Файл старее текущего прогресса (seq ${preview.seq} < ${localMax}).\n` +
        "Восстановить его и откатить локальный прогресс?",
      okText: "Восстановить",
      danger: true,
    });
    if (!allowOlder) { toast("Импорт отменён"); return; }
  }
  await importPortableSave(text, allowOlder);
}

async function syncPortableUI() {
  const hint = $("#portableHint");
  if (!hint || !window.soulforgeDesktop?.portableInfo) return;
  try {
    const info = await window.soulforgeDesktop.portableInfo();
    if (info.portable) {
      hint.textContent = "Портативный режим · экспорт сохраняет .sfsave рядом с exe";
      hint.title = info.dataDir || "";
    } else if (window.soulforgeDesktop?.isDesktop) {
      hint.textContent = "Десктоп · экспорт через диалог «Сохранить как»";
      hint.title = info.dataDir || "";
    } else {
      hint.hidden = true;
    }
  } catch (e) {
    hint.textContent = "Десктоп · обновите exe (dist-portable.bat) для экспорта файлов";
  }
}

function wirePortableSaveUI() {
  const block = $("#saveTransferBlock");
  if (!saveTransferAllowed()) {
    if (block) block.hidden = true;
    return;
  }
  if (block) block.hidden = false;
  $("#settExport").onclick = async () => { Audio2.click(); await exportPortableSave(); };
  $("#settImport").onclick = async () => {
    Audio2.click();
    if (window.soulforgeDesktop?.importSave) {
      try {
        const r = await window.soulforgeDesktop.importSave();
        if (r.ok) await confirmAndImportPortable(r.text);
        else if (!r.canceled) toast("Импорт не удался" + (r.error ? ": " + r.error : ""));
      } catch (e) {
        toast("Импорт не удался — пересоберите desktop exe");
      }
      return;
    }
    $("#saveFileInput").click();
  };
  $("#saveFileInput").onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await confirmAndImportPortable(await file.text());
  };
  syncPortableUI();
}
