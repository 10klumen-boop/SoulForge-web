// ===== Угловые панели: «От Автора» и патчноут =====

const CORNER_PANELS = [
  { panelId: "authorPanel", btnId: "authorFab", closeId: "authorPanelClose" },
  { panelId: "patchPanel", btnId: "patchFab", closeId: "patchPanelClose" },
];

function setCornerPanelOpen(panelId, open) {
  const cfg = CORNER_PANELS.find((c) => c.panelId === panelId);
  const panel = document.getElementById(panelId);
  const btn = cfg && document.getElementById(cfg.btnId);
  if (!panel) return;
  panel.hidden = !open;
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeAllCornerPanels(exceptId) {
  CORNER_PANELS.forEach((c) => {
    if (c.panelId !== exceptId) setCornerPanelOpen(c.panelId, false);
  });
}

function toggleCornerPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const open = panel.hidden;
  if (typeof Audio2 !== "undefined") Audio2.click();
  if (open) closeAllCornerPanels(panelId);
  setCornerPanelOpen(panelId, open);
}

function wireCornerPanel(cfg) {
  const panel = document.getElementById(cfg.panelId);
  const btn = document.getElementById(cfg.btnId);
  const close = document.getElementById(cfg.closeId);
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";

  btn.onclick = (e) => {
    e.stopPropagation();
    toggleCornerPanel(cfg.panelId);
  };
  if (close) {
    close.onclick = (e) => {
      e.stopPropagation();
      if (typeof Audio2 !== "undefined") Audio2.click();
      setCornerPanelOpen(cfg.panelId, false);
    };
  }
}

function wireAuthorPanel() {
  if (document.body.dataset.cornerPanelsWired) return;
  document.body.dataset.cornerPanelsWired = "1";

  CORNER_PANELS.forEach(wireCornerPanel);

  document.addEventListener("click", (e) => {
    const inside = e.target.closest(".corner-panel") || e.target.closest(".corner-bar");
    if (!inside) closeAllCornerPanels(null);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = CORNER_PANELS.find((c) => {
      const p = document.getElementById(c.panelId);
      return p && !p.hidden;
    });
    if (open) setCornerPanelOpen(open.panelId, false);
  });
}
