// ===== UI чата с каналами =====

function initGameChat() {
  applyChatMobilePreference();
  wireChatMobileSetting();
  chatActiveChannel = loadChatChannel();
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
