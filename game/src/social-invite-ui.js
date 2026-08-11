/**
 * Неблокирующие баннеры социнвайтов (группа / инстанс / клан / дуэль).
 * Не использует #modalBackdrop — автофарм не паузится.
 */
const SOCIAL_INVITE_MAX = 3;
const SOCIAL_INVITE_DEFAULT_MS = 22000;
const SOCIAL_INVITE_KIND_LABEL = {
  party: "Группа",
  instance: "Инстанс",
  clan: "Клан",
  duel: "Дуэль",
};

const _socialInviteShownIds = new Set();

function socialInviteEsc(s) {
  if (typeof escHtml === "function") return escHtml(s);
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ensureSocialInviteHost() {
  let host = document.getElementById("socialInviteHost");
  if (host) {
    host.hidden = false;
    return host;
  }
  host = document.createElement("div");
  host.id = "socialInviteHost";
  host.className = "social-invite-host";
  host.setAttribute("aria-live", "polite");
  host.setAttribute("aria-relevant", "additions");
  document.body.appendChild(host);
  return host;
}

function dismissSocialInviteBanner(el, reason) {
  if (!el || el._socialDismissing) return;
  el._socialDismissing = true;
  if (el._dismissTimer) {
    clearTimeout(el._dismissTimer);
    el._dismissTimer = null;
  }
  const id = el.dataset && el.dataset.socialInviteId;
  if (id) _socialInviteShownIds.delete(id);

  const cb =
    reason === "accept"
      ? el._onAccept
      : reason === "reject"
        ? el._onReject
        : el._onLater;
  el._onAccept = el._onLater = el._onReject = null;

  // Снимаем с хоста сразу — иначе overflow-очередь зациклится на анимации.
  el.classList.add("social-invite--out");
  if (el.parentNode && typeof el.parentNode.removeChild === "function") {
    el.parentNode.removeChild(el);
  } else if (typeof el.remove === "function") {
    el.remove();
  }

  if (typeof cb === "function") {
    try {
      const ret = cb();
      if (ret && typeof ret.then === "function") ret.catch(() => {});
    } catch (_) {}
  }
}

/**
 * @param {object} opts
 * @param {string} opts.id
 * @param {"party"|"instance"|"clan"|"duel"} [opts.kind]
 * @param {string} [opts.title]
 * @param {string} [opts.message]
 * @param {string} [opts.acceptText]
 * @param {string} [opts.laterText]
 * @param {string} [opts.rejectText] — если задан, кнопка «Отклонить»
 * @param {Function} [opts.onAccept]
 * @param {Function} [opts.onLater]
 * @param {Function} [opts.onReject]
 * @param {number} [opts.stickyMs]
 * @param {boolean} [opts.playSound]
 * @returns {boolean} показан ли баннер
 */
function showSocialInviteBanner(opts) {
  if (!opts || !opts.id) return false;
  const id = String(opts.id);
  if (_socialInviteShownIds.has(id)) return false;
  const host = ensureSocialInviteHost();
  if (!host) return false;
  const safeId = id.replace(/"/g, "");
  if (host.querySelector && host.querySelector('[data-social-invite-id="' + safeId + '"]')) {
    return false;
  }

  _socialInviteShownIds.add(id);
  const kind = opts.kind || "party";
  const el = document.createElement("div");
  el.className = "social-invite social-invite--" + kind;
  if (!el.dataset) el.dataset = {};
  el.dataset.socialInviteId = id;
  el.setAttribute("role", "status");
  el._onAccept = opts.onAccept;
  el._onLater = opts.onLater;
  el._onReject = opts.onReject;

  const title = opts.title || SOCIAL_INVITE_KIND_LABEL[kind] || "Приглашение";
  const message = opts.message || "";
  const acceptText = opts.acceptText || "Принять";
  const laterText = opts.laterText || "Позже";
  const rejectText = opts.rejectText || "";

  el.innerHTML =
    '<div class="social-invite-glow" aria-hidden="true"></div>' +
    '<div class="social-invite-body">' +
    '<div class="social-invite-kicker"></div>' +
    '<div class="social-invite-title"></div>' +
    (message ? '<div class="social-invite-msg"></div>' : "") +
    "</div>" +
    '<div class="social-invite-actions"></div>';

  const kickerEl = el.querySelector(".social-invite-kicker");
  if (kickerEl) kickerEl.textContent = SOCIAL_INVITE_KIND_LABEL[kind] || "Запрос";
  const titleEl = el.querySelector(".social-invite-title");
  if (titleEl) titleEl.textContent = title;
  const msgEl = el.querySelector(".social-invite-msg");
  if (msgEl) msgEl.textContent = message;

  const actions = el.querySelector(".social-invite-actions");

  function makeBtn(label, cls, reason) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "social-invite-btn " + cls;
    btn.textContent = label;
    btn.addEventListener("click", (ev) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      if (el._socialBusy || el._socialDismissing) return;
      el._socialBusy = true;
      if (actions && actions.querySelectorAll) {
        actions.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
        });
      }
      dismissSocialInviteBanner(el, reason);
    });
    return btn;
  }

  if (actions) {
    actions.appendChild(makeBtn(acceptText, "social-invite-btn--ok", "accept"));
    actions.appendChild(makeBtn(laterText, "social-invite-btn--later", "later"));
    if (rejectText) {
      actions.appendChild(makeBtn(rejectText, "social-invite-btn--reject", "reject"));
    }
  }

  host.appendChild(el);
  while (host.children && host.children.length > SOCIAL_INVITE_MAX) {
    const oldest = host.firstElementChild;
    if (!oldest || oldest === el) break;
    dismissSocialInviteBanner(oldest, "later");
  }

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => el.classList.add("social-invite--in"));
  } else {
    el.classList.add("social-invite--in");
  }

  const ms = opts.stickyMs == null ? SOCIAL_INVITE_DEFAULT_MS : opts.stickyMs;
  if (ms > 0) {
    el._dismissTimer = setTimeout(() => {
      dismissSocialInviteBanner(el, "later");
    }, ms);
  }

  if (opts.playSound !== false && typeof Audio2 !== "undefined" && Audio2.quest) {
    try {
      Audio2.quest();
    } catch (_) {}
  }

  return true;
}

function hasSocialInviteBanner(id) {
  if (!id) return false;
  if (_socialInviteShownIds.has(String(id))) return true;
  const host = document.getElementById("socialInviteHost");
  if (!host || !host.querySelector) return false;
  return !!host.querySelector(
    '[data-social-invite-id="' + String(id).replace(/"/g, "") + '"]'
  );
}

function dismissSocialInviteById(id, reason) {
  if (!id) return;
  const host = document.getElementById("socialInviteHost");
  if (!host || !host.querySelector) return;
  const el = host.querySelector(
    '[data-social-invite-id="' + String(id).replace(/"/g, "") + '"]'
  );
  if (el) dismissSocialInviteBanner(el, reason || "later");
}
