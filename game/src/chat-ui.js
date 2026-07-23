// ===== UI чата с каналами =====

function wireChatResize() {
  const body = document.getElementById("gameChatBody");
  if (!body || body.dataset.resizeWired) return;
  body.dataset.resizeWired = "1";

  const handles = [
    { el: document.getElementById("gameChatResize"), mode: "both" },
    { el: document.getElementById("gameChatResizeW"), mode: "w" },
    { el: document.getElementById("gameChatResizeH"), mode: "h" },
  ];

  let drag = null;

  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    // Панель справа: тянем влево → шире, вниз → выше
    const next = {
      w: drag.mode === "h" ? drag.w0 : drag.w0 - dx,
      h: drag.mode === "w" ? drag.h0 : drag.h0 + dy,
    };
    applyChatSize(next);
  };

  const onUp = () => {
    if (!drag) return;
    drag = null;
    document.body.classList.remove("sf-chat-resizing");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    saveChatSize({
      w: parseFloat(getComputedStyle(body).getPropertyValue("--chat-w")) || CHAT_SIZE_DEFAULT.w,
      h: parseFloat(getComputedStyle(body).getPropertyValue("--chat-h")) || CHAT_SIZE_DEFAULT.h,
    });
  };

  handles.forEach(({ el, mode }) => {
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const size = loadChatSize();
      drag = { mode, x0: e.clientX, y0: e.clientY, w0: size.w, h0: size.h };
      document.body.classList.add("sf-chat-resizing");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  });

  window.addEventListener("resize", () => {
    applyChatSize(loadChatSize());
  });
}

function initGameChat() {
  applyChatMobilePreference();
  wireChatMobileSetting();
  chatActiveChannel = loadChatChannel();
  applyChatSize(loadChatSize());
  wireChatResize();
  syncChatChannelTabs();
  syncChatComposeUi();
  setChatCollapsed(loadChatCollapsed());

  const toggle = document.getElementById("gameChatToggle");
  const collapse = document.getElementById("gameChatCollapse");
  const form = document.getElementById("gameChatForm");
  const input = document.getElementById("gameChatInput");
  const toNick = document.getElementById("gameChatToNick");
  const channels = document.getElementById("gameChatChannels");

  if (channels && !channels.dataset.wired) {
    channels.dataset.wired = "1";
    channels.addEventListener("click", (e) => {
      const btn = e.target.closest(".game-chat-chan[data-channel]");
      if (!btn) return;
      if (typeof Audio2 !== "undefined") Audio2.click();
      setChatChannel(btn.dataset.channel);
    });
  }

  if (toggle && !toggle.dataset.wired) {
    toggle.dataset.wired = "1";
    toggle.addEventListener("click", () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      toggleGameChat();
    });
  }
  if (collapse && !collapse.dataset.wired) {
    collapse.dataset.wired = "1";
    collapse.addEventListener("click", () => {
      if (typeof Audio2 !== "undefined") Audio2.click();
      setChatCollapsed(true);
    });
  }
  if (form && !form.dataset.wired) {
    form.dataset.wired = "1";
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!input) return;
      const text = input.value;
      const r = await chatSendMessage(text);
      if (r.ok) {
        input.value = "";
        if (typeof Audio2 !== "undefined" && Audio2.ui) Audio2.ui();
      }
    });
  }
  if (toNick && !toNick.dataset.wired) {
    toNick.dataset.wired = "1";
    toNick.addEventListener("change", () => {
      chatWhisperTarget = toNick.value.trim();
    });
    toNick.addEventListener("input", () => {
      chatWhisperTarget = toNick.value.trim();
    });
  }
  if (input) {
    input.maxLength = typeof CHAT_MAX_LEN !== "undefined" ? CHAT_MAX_LEN : 200;
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setChatCollapsed(true);
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "c" || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
    const modalOpen = document.getElementById("modalBackdrop") && !document.getElementById("modalBackdrop").hidden;
    if (modalOpen) return;
    e.preventDefault();
    toggleGameChat();
  });

  if (typeof matchMedia === "function") {
    try {
      matchMedia("(max-width: 640px)").addEventListener("change", () => refreshChatPolling());
    } catch (_) {}
  }

  refreshChatPolling();
  setInterval(() => {
    if (chatCanUse() && !chatPollTimer) refreshChatPolling();
  }, 8000);
}
