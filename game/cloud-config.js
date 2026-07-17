// Cloud bootstrap. Auto-detect in 14-cloud.js:
// - http://localhost:8787 (local API)
// - VPS IP/domain (http/https, not GitHub Pages) → same-origin online
// - *.github.io / *.pages.dev → offline (static only)
//
// Force / override:
// window.SOULFORGE_CLOUD = { baseUrl: "https://api.example.com", enabled: true };
window.SOULFORGE_CLOUD = window.SOULFORGE_CLOUD || {
  baseUrl: null,
  enabled: false,
};
