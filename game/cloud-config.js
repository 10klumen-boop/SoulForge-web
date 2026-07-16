// Cloud bootstrap. Auto-detect also runs in 14-cloud.js:
// - http://localhost:8787 (local API)
// - https://your.domain (VPS behind Caddy) → enabled, same-origin
//
// Force / override:
// window.SOULFORGE_CLOUD = { baseUrl: "https://api.example.com", enabled: true };
// Same-origin prod (optional explicit):
// window.SOULFORGE_CLOUD = { baseUrl: "", enabled: true };
window.SOULFORGE_CLOUD = window.SOULFORGE_CLOUD || {
  baseUrl: null,
  enabled: false,
};
