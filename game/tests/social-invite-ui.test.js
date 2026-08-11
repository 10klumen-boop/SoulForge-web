// ===== social-invite-ui: неблокирующие баннеры =====
const assert = require("assert");
const { loadScripts } = require("./setup.js");

loadScripts(["src/social-invite-ui.js"]);

const children = [];
const host = {
  id: "socialInviteHost",
  className: "social-invite-host",
  hidden: false,
  children,
  get firstElementChild() {
    return children[0] || null;
  },
  querySelector(sel) {
    const m = /data-social-invite-id="([^"]*)"/.exec(sel);
    if (!m) return null;
    return children.find((c) => c.dataset && c.dataset.socialInviteId === m[1]) || null;
  },
  appendChild(el) {
    children.push(el);
    el.parentNode = host;
  },
  removeChild(el) {
    const i = children.indexOf(el);
    if (i >= 0) children.splice(i, 1);
    el.parentNode = null;
    return el;
  },
};

const realGet = document.getElementById;
document.getElementById = (id) => {
  if (id === "socialInviteHost") return host;
  if (id === "modalBackdrop") return { hidden: true, id: "modalBackdrop" };
  return realGet ? realGet(id) : null;
};

document.createElement = (tag) => {
  const listeners = {};
  const childMap = {};
  const el = {
    tagName: String(tag).toUpperCase(),
    className: "",
    classList: {
      _s: new Set(),
      add(c) {
        this._s.add(c);
        el.className = [...this._s].join(" ");
      },
      remove(c) {
        this._s.delete(c);
        el.className = [...this._s].join(" ");
      },
      toggle() {},
      contains(c) {
        return this._s.has(c);
      },
    },
    style: {},
    hidden: false,
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    parentNode: null,
    _achDismissing: false,
    setAttribute() {},
    getAttribute() {
      return null;
    },
    removeAttribute() {},
    appendChild(child) {
      if (!el._kids) el._kids = [];
      el._kids.push(child);
      if (child.className) childMap[child.className.split(" ")[0]] = child;
    },
    remove() {
      const i = children.indexOf(el);
      if (i >= 0) children.splice(i, 1);
      el.parentNode = null;
    },
    querySelector(sel) {
      if (!el._kids) return null;
      const cls = sel.replace(/^\./, "");
      return (
        el._kids.find((k) => (k.className || "").split(/\s+/).includes(cls)) ||
        null
      );
    },
    querySelectorAll(sel) {
      if (!el._kids) return [];
      const cls = sel.replace(/^button$/, "button");
      if (sel === "button") return el._kids.filter((k) => k.tagName === "BUTTON");
      return el._kids.filter((k) => (k.className || "").includes(cls.replace(/^\./, "")));
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      (listeners.click || []).forEach((fn) => fn({ preventDefault() {}, stopPropagation() {} }));
    },
  };
  // innerHTML setter builds stub nodes for known classes
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get() {
      return _html;
    },
    set(v) {
      _html = String(v);
      el._kids = [];
      const classes = [
        "social-invite-glow",
        "social-invite-body",
        "social-invite-kicker",
        "social-invite-title",
        "social-invite-msg",
        "social-invite-actions",
      ];
      classes.forEach((c) => {
        if (_html.includes(c)) {
          const node = document.createElement("div");
          node.className = c;
          el.appendChild(node);
        }
      });
    },
  });
  return el;
};

document.body.appendChild = () => {};

assert(typeof showSocialInviteBanner === "function", "showSocialInviteBanner exported");
assert(typeof hasSocialInviteBanner === "function", "hasSocialInviteBanner exported");

let accepted = false;
let rejected = false;
let latered = false;

const shown = showSocialInviteBanner({
  id: "party:test-1",
  kind: "party",
  title: "Приглашение в группу",
  message: "Tester приглашает",
  acceptText: "Принять",
  laterText: "Позже",
  rejectText: "Отклонить",
  stickyMs: 0,
  playSound: false,
  onAccept: () => {
    accepted = true;
  },
  onReject: () => {
    rejected = true;
  },
  onLater: () => {
    latered = true;
  },
});

assert(shown === true, "banner shown");
assert(hasSocialInviteBanner("party:test-1"), "dedupe id registered");
assert(children.length === 1, "one banner in host");
assert(document.getElementById("modalBackdrop").hidden === true, "modal stays closed");

const dup = showSocialInviteBanner({
  id: "party:test-1",
  kind: "party",
  title: "dup",
  playSound: false,
  stickyMs: 0,
});
assert(dup === false, "same id not duplicated");
assert(children.length === 1, "still one banner");

const banner = children[0];
const actions = banner.querySelector(".social-invite-actions");
assert(actions && actions._kids && actions._kids.length === 3, "three action buttons");

const laterBtn = actions._kids.find((b) => (b.className || "").includes("later"));
assert(!!laterBtn, "later button present");
laterBtn.click();
assert(latered === true, "Later callback fired");
assert(accepted === false && rejected === false, "Later is not accept/reject");

console.log("social-invite-ui: ok");
