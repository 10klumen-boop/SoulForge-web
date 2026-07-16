# SoulForge Lineage 2

Фан-симулятор заточки Lineage 2 (Enchant Sim). Веб-версия: игра + API аккаунтов и рейтингов.

## Структура

```
game/     — клиент (index.html, src/, assets, icons)
server/   — Node API + статика game/ (ник/пароль, SQLite, рейтинги)
```

## Запуск локально

**С аккаунтами и рейтингом (рекомендуется):**

```bat
start-web.bat
```

Или вручную:

```bat
cd server
npm.cmd install
npm.cmd start
```

Открыть http://localhost:8787 — Node отдаёт `game/` и API (`/auth/*`, `/runs`, `/leaderboard/:mode`).

Рейтинги: **Заточка** (max +), **Сила** (`avatarFarmPower`), **Богатство** (`totals.earned`).  
Регистрация: ник 3–16 символов, пароль от 6.

**Только статика (без API):** открыть `game/index.html` или:

```bat
cd game
python -m http.server 8080
```

## GitHub Pages (статика без API)

1. Settings → Pages → **Source: GitHub Actions**.
2. Workflow `.github/workflows/pages.yml` выкладывает `game/` при пуше в `main` или вручную.
3. URL: `https://<user>.github.io/<repo>/`

Облако на `*.github.io` не включается автоматически.

## Хостинг: VPS + свой домен

Рекомендуемая схема — **один origin**: Caddy (HTTPS) → Node `server/` на `127.0.0.1:8787`.

### 1. Домен и DNS

1. Купите домен.
2. DNS **A** для `@` → IP VPS (`www` → тот же IP или CNAME на `@`).
3. Дождитесь распространения DNS.

### 2. VPS

Ubuntu 22.04/24.04, от **1 vCPU / 1 GB RAM**.  
Порты снаружи: **22, 80, 443**. Порт **8787 наружу не открывать**.

### 3. Установка

```bash
# Node 20+, git, Caddy, PM2
sudo mkdir -p /var/www && sudo git clone YOUR_REPO_URL /var/www/soulforge
cd /var/www/soulforge/server
npm ci --omit=dev
HOST=127.0.0.1 PORT=8787 pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

Caddy — см. `server/Caddyfile.example`. Переменные — `server/README.md` (`HOST=127.0.0.1` на VPS).

Клиент на своём домене сам включает облако (same-origin). Явно:

```js
// game/cloud-config.js
window.SOULFORGE_CLOUD = { baseUrl: "", enabled: true };
```

### 4. Обновление

```bash
export SOULFORGE_SSH=user@YOUR_VPS_IP
./deploy.sh
```

```bat
set SOULFORGE_SSH=user@YOUR_VPS_IP
deploy.bat
```

### 5. Бэкап

Раз в сутки копируйте `server/data/soulforge.db` (см. `server/README.md`).

## Требования

- Node.js 18+ (для `server/`)
