// ===== Cloud UI: баннер lease, логин-формы, рейтинг, автовход =====
// Зависит от cloud-core.js (должен быть подключён ранее).

function updateHomeRatingSubtitle() {
  const el = document.getElementById("homeRatingSub");
  if (!el) return;
  const pending = readPendingSubmissions().length;
  const auth = readCloudAuth();
  if (!cloudEnabled()) {
    el.textContent = pending ? ("Оффлайн · в очереди " + pending) : "Сервер оффлайн";
    return;
  }
  if (!auth?.nick) {
    el.textContent = pending
      ? ("Войдите · в очереди " + pending)
      : "Войдите, чтобы попасть в рейтинг";
    return;
  }
  el.textContent = pending
    ? (auth.nick + " · очередь " + pending)
    : "Заточка · сила · богатство";
}

function isLeaderboardMe(row, me) {
  if (!me || !row) return false;
  const account = String(me).toLowerCase();
  const nick = String(row.nick || "").toLowerCase();
  const cid = typeof state !== "undefined" ? state.activeCharacterId : null;
  if (cid && row.characterId) {
    return nick === account && String(row.characterId) === String(cid);
  }
  if (nick) return nick === account;
  return String(row.name || "").toLowerCase() === account;
}

function isLeaderboardMyAccount(row, me) {
  if (!me || !row) return false;
  const nick = String(row.nick || "").toLowerCase();
  if (nick) return nick === String(me).toLowerCase();
  return String(row.name || "").toLowerCase() === String(me).toLowerCase();
}

function syncCloudUI() {
  const idEl = document.getElementById("playerIdShort");
  const hint = document.getElementById("cloudHint");
  const auth = readCloudAuth();
  const pending = readPendingSubmissions().length;
  if (idEl) {
    if (auth?.nick) {
      idEl.textContent = auth.nick;
      idEl.title = auth.nick;
    } else {
      const id = getPlayerId();
      idEl.textContent = id.length > 10 ? id.slice(0, 6) + "…" + id.slice(-4) : id;
      idEl.title = id;
    }
  }
  if (hint) {
    if (!cloudEnabled()) {
      hint.textContent = pending
        ? "Оффлайн · в очереди " + pending
        : "Сервер оффлайн · демо без аккаунта";
    } else if (auth?.nick) {
      hint.textContent = pending
        ? ("В сети · " + auth.nick + " · в очереди " + pending)
        : ("Прогресс на сервере · аккаунт " + auth.nick + " · «Выйти» — сменить");
    } else {
      hint.textContent = pending
        ? ("Войдите · в очереди " + pending + " · прогресс хранится на сервере")
        : "Войдите или создайте аккаунт · прогресс хранится на сервере";
    }
  }
  const nickInput = document.getElementById("cloudNick");
  const passInput = document.getElementById("cloudPass");
  const statusEl = document.getElementById("cloudAuthStatus");
  if (statusEl) {
    statusEl.textContent = auth?.nick ? ("Вход: " + auth.nick) : "";
    statusEl.hidden = !auth?.nick;
  }
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const cancelBtn = document.getElementById("cloudCancelBtn");
  if (loginBtn) {
    loginBtn.hidden = false;
    loginBtn.textContent = auth?.nick ? "Продолжить" : "Войти";
  }
  if (regBtn) regBtn.hidden = !!auth;
  if (logoutBtn) logoutBtn.hidden = !auth;
  if (cancelBtn) cancelBtn.hidden = cloudEnabled();
  const titleEl = document.getElementById("l2LoginTitle");
  if (titleEl) titleEl.textContent = auth?.nick ? "Сессия" : "Вход";
  if (nickInput) {
    nickInput.hidden = false;
    if (auth?.nick) nickInput.value = auth.nick;
  }
  if (passInput) passInput.hidden = false;
  const tile = document.getElementById("lbTileMeta");
  if (tile) tile.textContent = auth?.nick || (cloudEnabled() ? "Войти" : "Офлайн");

  const homeStatus = document.getElementById("homeAccountStatus");
  if (homeStatus) {
    if (auth?.nick) {
      homeStatus.textContent = "Аккаунт: " + auth.nick;
      homeStatus.classList.remove("is-guest");
    } else if (cloudEnabled()) {
      homeStatus.textContent = "Войдите в аккаунт";
      homeStatus.classList.add("is-guest");
    } else {
      homeStatus.textContent = "Оффлайн · без сервера";
      homeStatus.classList.add("is-guest");
    }
  }
  const homeLoginBtn = document.getElementById("homeLoginBtn");
  if (homeLoginBtn) {
    if (auth?.nick) {
      homeLoginBtn.textContent = "Сменить аккаунт";
      homeLoginBtn.title = "Выйти и открыть вход";
    } else {
      homeLoginBtn.textContent = "Войти в аккаунт";
      homeLoginBtn.title = "Логин или регистрация";
    }
  }
  updateHomeRatingSubtitle();
  if (typeof updateHomeCharsSubtitle === "function") updateHomeCharsSubtitle();
}

function noteLeaderboardEvent(event, extra, opts) {
  submitLeaderboardEvent(event, extra, opts).then((r) => {
    if (!r?.queued || (event !== "record" && event !== "sell")) return;
    if (typeof toast !== "function") return;
    const auth = readCloudAuth();
    if (!auth?.token) return;
    if (r.offline) toast("Нет сети · рекорд в очереди", "warn");
  });
}

function formatLbValue(mode, row) {
  const v = row.value != null ? row.value : 0;
  if (mode === "enchant") return "+" + v;
  if (mode === "wealth") return typeof fmtAdena === "function" ? fmtAdena(v) : String(v);
  if (mode === "mobs") {
    const n = typeof fmt === "function" ? fmt(v) : String(v);
    return n + " мобов";
  }
  return typeof fmt === "function" ? fmt(v) : String(v);
}

async function renderLeaderboard() {
  const list = document.getElementById("lbList");
  const status = document.getElementById("lbStatus");
  const cta = document.getElementById("lbLoginCta");
  if (!list) return;
  list.innerHTML = "";
  const auth = readCloudAuth();
  const pending = readPendingSubmissions().length;
  const modeLabel = { enchant: "Заточка", power: "Сила", wealth: "Богатство", mobs: "Мобы" }[_lbMode] || _lbMode;

  if (cta) {
    cta.hidden = !!(auth?.nick) || !cloudEnabled();
  }

  if (status) {
    if (!cloudEnabled()) {
      status.textContent = pending
        ? "Сервер недоступен · в очереди " + pending + " событий"
        : "Сервер не подключён";
    } else if (!auth?.nick) {
      status.textContent = pending
        ? "Войдите · в очереди " + pending
        : "Войдите, чтобы попасть в рейтинг";
    } else if (pending) {
      status.textContent = modeLabel + " · " + (state.avatar?.name || auth.nick) + " · очередь: " + pending;
    } else {
      const hero = state.avatar?.name;
      status.textContent = hero
        ? modeLabel + " · " + hero + " · " + auth.nick
        : modeLabel + " · " + auth.nick;
    }
  }
  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.classList.toggle("sel", btn.dataset.mode === _lbMode);
  });
  const res = await fetchLeaderboard(_lbMode);
  if (!res.ok) {
    if (status) status.textContent = res.offline ? "Нет связи с сервером" : "Не удалось загрузить рейтинг";
    return;
  }
  if (!res.rows.length) {
    const empty = document.createElement("p");
    empty.className = "lb-empty";
    empty.textContent = auth?.nick
      ? "Пока пусто — заточи оружие или заверши фарм, затем обнови."
      : "Пока пусто. Войди и сыграй, чтобы появиться в таблице.";
    list.appendChild(empty);
    return;
  }
  const me = getCloudNick();
  let foundMe = false;
  res.rows.forEach((row) => {
    const isMe = isLeaderboardMe(row, me);
    const isMine = !isMe && isLeaderboardMyAccount(row, me);
    if (isMe) foundMe = true;
    const el = document.createElement("div");
    el.className = "lb-row" + (isMe ? " me" : isMine ? " mine" : "");
    el.innerHTML =
      '<span class="lb-rank">' + row.rank + "</span>" +
      '<span class="lb-name"></span>' +
      '<span class="lb-val"></span>';
    const nameEl = el.querySelector(".lb-name");
    const hero = row.charName || row.name || "—";
    const account = row.nick || "";
    const main = document.createElement("span");
    main.className = "lb-name-main";
    main.textContent = hero;
    nameEl.appendChild(main);
    if (account && String(account).toLowerCase() !== String(hero).toLowerCase()) {
      const nickEl = document.createElement("span");
      nickEl.className = "lb-nick";
      nickEl.textContent = account;
      nameEl.appendChild(nickEl);
    }
    if (isMe) {
      const tag = document.createElement("span");
      tag.className = "lb-me-tag";
      tag.textContent = "ты";
      nameEl.appendChild(tag);
    } else if (isMine) {
      const tag = document.createElement("span");
      tag.className = "lb-mine-tag";
      tag.textContent = "твой";
      nameEl.appendChild(tag);
    }
    el.querySelector(".lb-val").textContent = formatLbValue(_lbMode, row);
    list.appendChild(el);
  });
  if (me && !foundMe && status) {
    status.textContent =
      (status.textContent || modeLabel) + " · тебя ещё нет в топе — сыграй и нажми «Обновить»";
  }
}

function openLeaderboard(opts) {
  opts = opts || {};
  const back = document.querySelector("#screen-leaderboard .back[data-to], #screen-leaderboard .panel-head .back");
  if (back) {
    const to = opts.from === "home" ? "home" : "menu";
    back.dataset.to = to;
    back.textContent = to === "home" ? "← Главное меню" : "← В меню";
    back.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      show(to);
    };
  }
  if (readCloudAuth()?.token) flushPendingSubmissions();
  renderLeaderboard();
  show("leaderboard");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
}

function enterMainMenuFromLogin(opts) {
  opts = opts || {};
  if (!cloudMainMenuAllowed(opts)) {
    if (typeof show === "function") show("login");
    return;
  }
  if (typeof openHome === "function") openHome();
  else if (typeof show === "function") show("home");
  if (typeof Audio2 !== "undefined" && Audio2.open) Audio2.open();
  const emptyRoster =
    typeof listCreatedCharacters === "function"
      ? listCreatedCharacters().length === 0
      : !(state?.avatar?.created);
  if (opts.afterRegister || (opts.guideCreate && emptyRoster)) {
    if (typeof toast === "function") {
      toast(
        opts.afterRegister
          ? "Аккаунт пустой — открой «Персонажи» и создай героя"
          : "Сначала создай персонажа в «Персонажи»",
        "system"
      );
    }
  }
}

async function wireCloudAuthForms() {
  const loginBtn = document.getElementById("cloudLoginBtn");
  const regBtn = document.getElementById("cloudRegisterBtn");
  const logoutBtn = document.getElementById("cloudLogoutBtn");
  const cancelBtn = document.getElementById("cloudCancelBtn");
  const nickEl = document.getElementById("cloudNick");
  const passEl = document.getElementById("cloudPass");
  const msgEl = document.getElementById("cloudAuthMsg");
  const setMsg = (t, warn) => {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.classList.toggle("warn", !!warn);
  };
  const setAuthBusy = (busy) => {
    _cloudAuthBusy = !!busy;
    if (loginBtn) loginBtn.disabled = busy;
    if (regBtn) regBtn.disabled = busy;
    if (logoutBtn) logoutBtn.disabled = busy;
  };
  const tryLogin = async () => {
    if (_cloudAuthBusy) return;
    const nick = (nickEl?.value || "").trim();
    const password = passEl?.value || "";
    const existing = readCloudAuth();
    if (existing?.nick && existing?.token && !password) {
      setAuthBusy(true);
      setMsg("Синхронизация…");
      try {
        await bindSaveToCloudNick(existing.nick);
        const sync = await syncCloudProgress({ notify: true });
        if (!sync.ok && !sync.readOnly) {
          setMsg(
            sync.locked
              ? (sync.error || "Аккаунт открыт на другом устройстве")
              : (sync.error || "Не удалось загрузить сейв"),
            true
          );
          return;
        }
        setMsg(sync.readOnly ? "Только просмотр — " + existing.nick : "С возвращением, " + existing.nick);
        await flushPendingSubmissions({ notify: true });
        enterMainMenuFromLogin({ guideCreate: true });
      } finally {
        setAuthBusy(false);
      }
      return;
    }
    setAuthBusy(true);
    setMsg("Вход…");
    try {
      const r = await cloudLogin(nick, password);
      if (r.ok) {
        setMsg("Добро пожаловать, " + r.nick);
        if (passEl) passEl.value = "";
        await flushPendingSubmissions({ notify: true });
        enterMainMenuFromLogin({ guideCreate: true });
      } else setMsg(r.error || "Ошибка входа", true);
    } finally {
      setAuthBusy(false);
    }
  };
  if (loginBtn) {
    loginBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      await tryLogin();
    };
  }
  if (regBtn) {
    regBtn.onclick = async () => {
      if (_cloudAuthBusy) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      const nick = (nickEl?.value || "").trim();
      const password = passEl?.value || "";
      setAuthBusy(true);
      setMsg("Создание аккаунта…");
      try {
        const r = await cloudRegister(nick, password);
        if (r.ok) {
          setMsg("Аккаунт создан: " + r.nick);
          if (passEl) passEl.value = "";
          await flushPendingSubmissions({ notify: true });
          enterMainMenuFromLogin({ afterRegister: true });
        } else setMsg(r.error || "Ошибка регистрации", true);
      } finally {
        setAuthBusy(false);
      }
    };
  }
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (_cloudAuthBusy) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      setAuthBusy(true);
      try {
        await cloudLogout();
        setMsg("Выход выполнен");
        if (passEl) passEl.value = "";
      } finally {
        setAuthBusy(false);
      }
    };
  }
  if (cancelBtn) {
    cancelBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setMsg("");
      if (nickEl) nickEl.value = "";
      if (passEl) passEl.value = "";
      if (!cloudEnabled()) {
        await bindSaveToCloudNick(null);
        enterMainMenuFromLogin();
      }
    };
  }
  const devSkip = document.getElementById("loginDevSkip");
  if (devSkip) {
    const allowDev = typeof FEATURE_DEV_PANEL !== "undefined" && FEATURE_DEV_PANEL;
    devSkip.hidden = !allowDev;
    if (allowDev && !devSkip.dataset.wired) {
      devSkip.dataset.wired = "1";
      devSkip.onclick = () => {
        if (typeof Audio2 !== "undefined") Audio2.click();
        setMsg("DEV · пропуск");
        _cloudDevBypass = true;
        enterMainMenuFromLogin({ devBypass: true });
      };
    }
  }
  const onEnter = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (typeof Audio2 !== "undefined") Audio2.click();
    tryLogin();
  };
  if (nickEl && !nickEl.dataset.enterWired) {
    nickEl.dataset.enterWired = "1";
    nickEl.addEventListener("keydown", onEnter);
  }
  if (passEl && !passEl.dataset.enterWired) {
    passEl.dataset.enterWired = "1";
    passEl.addEventListener("keydown", onEnter);
  }
  document.querySelectorAll(".lb-tab").forEach((btn) => {
    btn.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      _lbMode = btn.dataset.mode || "enchant";
      renderLeaderboard();
    };
  });
  const refreshBtn = document.getElementById("lbRefreshBtn");
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      await flushPendingSubmissions({ notify: true });
      await submitLeaderboardEvent("snapshot", null, { force: true });
      await renderLeaderboard();
    };
  }
  const lbCta = document.getElementById("lbLoginCta");
  if (lbCta && !lbCta.dataset.wired) {
    lbCta.dataset.wired = "1";
    lbCta.onclick = () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      if (typeof openLoginScreen === "function") openLoginScreen();
      else show("login");
    };
  }
}

function initCloud() {
  syncCloudUI();
  wireCloudAuthForms();
  wireCloudSaveLifecycle();
  wireLeaseYieldChannel();
  if (cloudEnabled() && readCloudAuth()?.token) {
    flushPendingSubmissions({ notify: false });
    flushPendingEvents().catch(() => {});
  }
}

/** Автовход: токен есть → синхронизация с сервера → главное меню. */
async function tryResumeCloudSession() {
  if (!cloudEnabled() || !readCloudAuth()?.token) return { ok: false, skipped: true };
  const auth = readCloudAuth();
  const msgEl = document.getElementById("cloudAuthMsg");
  const setMsg = (t, warn) => {
    if (!msgEl) return;
    msgEl.textContent = t || "";
    msgEl.classList.toggle("warn", !!warn);
  };
  setMsg("Синхронизация…");
  await bindSaveToCloudNick(auth.nick);
  const sync = await syncCloudProgress({ notify: false });
  if (!sync.ok) {
    const msg = sync.locked
      ? (sync.error || "Аккаунт открыт на другом устройстве")
      : sync.offline
        ? "Нет связи с сервером"
        : (sync.error || "Не удалось загрузить сейв");
    setMsg(msg, true);
    return sync;
  }
  setMsg("");
  await flushPendingSubmissions({ notify: false });
  flushPendingEvents().catch(() => {});
  enterMainMenuFromLogin({ guideCreate: true });
  return sync;
}
