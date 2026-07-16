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

Пример VPS:

```bash
export HOST=127.0.0.1
export PORT=8787
export SOULFORGE_DATA=/var/www/soulforge/server/data
export SOULFORGE_SERVE_GAME=1
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

- `POST /auth/register` `{ nick, password }`
- `POST /auth/login`
- `POST /auth/logout` (Bearer)
- `POST /runs` (Bearer) — maxPlus, farmPower, earned, adena
- `GET /leaderboard/:mode` — `enchant` | `power` | `wealth`
