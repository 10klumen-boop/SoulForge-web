# SoulForge cloud API

Ник + пароль, SQLite, рейтинги `enchant` / `power` / `wealth`.
Node отдаёт статику `../game` и JSON API на одном origin.

## Локально

```bat
npm.cmd install
npm.cmd start
```

Открыть `http://localhost:8787`.

## Переменные окружения

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `PORT` | `8787` | Порт Node |
| `HOST` | `0.0.0.0` | Локально слушать все интерфейсы |
| `HOST` (VPS) | **`127.0.0.1`** | Только localhost — снаружи Caddy/nginx |
| `SOULFORGE_DATA` | `server/data` | Каталог SQLite |
| `SOULFORGE_DB` | `…/soulforge.db` | Явный путь к БД |
| `SOULFORGE_SERVE_GAME` | `1` | `0` = только API |
| `SOULFORGE_GAME` | `../game` | Путь к статике |
| `SOULFORGE_ADMIN_KEY` | *(пусто)* | Ключ для `/db-admin/` и API `/admin/*` |

Если `SOULFORGE_ADMIN_KEY` задан, откройте **отдельную консоль** (не в игре):

**http://ваш-сервер/db-admin/**

Запросы к API: заголовок `X-Soulforge-Admin: <ключ>`.

```bash
export SOULFORGE_ADMIN_KEY='your-long-random-secret'
```

```bash
export HOST=127.0.0.1
export PORT=8787
export SOULFORGE_DATA=/var/www/soulforge/server/data
export SOULFORGE_SERVE_GAME=1
```

## Деплой на VPS (шпаргалка)

С ПК (мастерская `L2Raptus`):

```bat
deploy-vps.bat
```

Что делает: `export_release_web.py` → commit/push в `SoulForge-web` → на сервере `git pull` + `pm2`.

SSH-ключ: `%USERPROFILE%\.ssh\soulforge_vps`  
Один раз на VPS (после `ssh root@109.196.103.50` с паролем):

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAvPhJdJyMmUI16wPkJ2TMvDIlgMgLQ3m5iopO8CpuK1 admin@DESKTOP-VG13O3Q' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Вручную на сервере (если bat недоступен):

```bash
cd /var/www/soulforge && git pull --ff-only
cd server && npm ci --omit=dev
pm2 delete soulforge
pm2 start ecosystem.config.cjs && pm2 save
curl -sS http://127.0.0.1:8787/health
```

Админ-ключ: `SOULFORGE_ADMIN_KEY` в `ecosystem.config.cjs` **на VPS** (не коммить секреты в git). После смены:

```bash
pm2 delete soulforge && pm2 start ecosystem.config.cjs && pm2 save
```

## PM2

```bash
cd /var/www/soulforge/server
npm ci --omit=dev
HOST=127.0.0.1 PORT=8787 pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## HTTPS (Caddy)

См. [`Caddyfile.example`](Caddyfile.example). DNS **A** `@` → IP VPS, затем:

```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
# замените your.domain
sudo systemctl reload caddy
```

Порты снаружи: **80, 443** (и 22 для SSH). Порт 8787 наружу не открывать.

## Бэкап SQLite

```bash
# раз в сутки
cp /var/www/soulforge/server/data/soulforge.db /var/backups/soulforge-$(date +%F).db
```

Cron: `0 3 * * * cp …`

## API

- `GET /admin/enabled` — включена ли админка (без ключа)
- `GET /admin/overview` · `GET /admin/users` · `PUT /admin/users/:id/score` · `DELETE /admin/users/:id` — заголовок `X-Soulforge-Admin`
- `POST /auth/register` `{ nick, password }`
- `POST /auth/login`
- `POST /auth/logout` (Bearer)
- `POST /runs` (Bearer) — maxPlus, farmPower, earned, adena
- `GET /leaderboard/:mode` — `enchant` | `power` | `wealth`
