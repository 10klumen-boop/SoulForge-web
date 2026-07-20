.# SoulForge cloud API

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
| `SOULFORGE_DB` | `…/soulforge.db` | Явный путь к БД (SQLite) |
| `SOULFORGE_DB_DRIVER` | `sqlite` | `sqlite` или `postgres` (postgres — после миграции) |
| `DATABASE_URL` | *(пусто)* | PostgreSQL connection string |
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

## Smoke bots (API)

С ПК, против VPS:

```bat
tools\smoke-vps.bat
```

или из `server/`:

```bat
npm.cmd run smoke:vps
npm.cmd run smoke:local
```

Проверяет: `/health`, рейтинги, register/login бота, tiny `/runs`, 401 без токена.
Ник бота случайный (`Bot…..`), в рейтинг почти не влияет. Фиксированный ник:

```bat
node scripts\smoke-api.mjs --base http://109.196.103.50 --nick SmokeBot --pass SmokeBot1
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

Скрипт: [`scripts/backup-sqlite.sh`](scripts/backup-sqlite.sh).

```bash
# на VPS один раз
mkdir -p /var/backups/soulforge
cp /var/www/soulforge/server/scripts/backup-sqlite.sh /usr/local/bin/soulforge-backup-db
chmod +x /usr/local/bin/soulforge-backup-db
echo '15 3 * * * root /usr/local/bin/soulforge-backup-db' > /etc/cron.d/soulforge-db
```

Или вручную: `cp /var/www/soulforge/server/data/soulforge.db /var/backups/soulforge-$(date +%F).db`

## Что лежит в БД (и что нет)

### В SQLite / будущем Postgres

| Таблица | Что хранит |
|---------|------------|
| `users` | аккаунты (ник, bcrypt) |
| `sessions` | токены входа |
| `scores` | рейтинг **по персонажу** (`user_id` + `character_id`): имя героя, max+, farm_power, earned, adena, mobs |
| `player_saves` | **полный прогресс** (`payload` JSON) + колонки-сводка для админки |
| `player_characters` | персонажи по слотам (денормализация из сейва) |
| `character_events` | журнал ключевых действий персонажа (заточка, лут, сессия фарма, квесты…) |
| `character_backups` | снапшоты `progress` персонажа при каждом `PUT /save` (хранение последних ~40) |
| `balance_alerts` | автоматические флаги подозрительного баланса (B+ с золотого, +10 с golden, adena/мин…) |
| `write_leases` | кто сейчас имеет право `PUT /save` (writerId вкладки) |

Источник правды для игрока онлайн: **`PUT /save`** → `player_saves` (+ обновление `scores` и `player_characters`).

**Write lease:** одновременно писать может только одна **вкладка** (`writerId` = device + tab). Второе устройство/вкладка получает `423` и может **перехватить** (сначала BroadcastChannel просит соседнюю вкладку сделать flush). Heartbeat ~30 с (+ flush), TTL ~90 с.

### Только на клиенте (не в БД)

| Где | Что |
|-----|-----|
| `localStorage` | токен входа, **кэш** сейва под ником, очередь `pending` для `/runs` |
| `sessionStorage` | счётчик `seq` текущей сессии (анти-откат) |
| `.sfsave` | ручной экспорт/импорт (portable save) |
| `state.devTune` | dev-оверрайды баланса — **не** уходят в облако |

### Частично / не полностью

| API | В БД попадает | Не сохраняется |
|-----|---------------|----------------|
| `POST /runs` | `scores` по `characterId` (максимумы) | тип события, `records`, `attestation`, история забегов |
| `POST /events` | строки в `character_events` | каждый тап/килл обычного моба |
| `PUT /save` | сейв + scores + **бэкап progress** каждого слота | — |
| `GET /leaderboard` | строки персонажей (`name`/`charName` + `nick`) | — |
| Admin restore | подмена progress из `character_backups` + bump seq | — |

Итого: **игровой прогресс** — `player_saves`. **Рейтинг** — на персонажа в `scores`. **Аудит** — `character_events` (ключевые действия, не каждый тап). **Откат героя** — `character_backups` (админка → «Бэкапы»). **Баланс** — вкладка «Баланс» + `balance-queries.sql` + CSV export.

## Аналитика баланса

- **Админка** → вкладки **Баланс** (фарм/заточка/квесты/лут за 7–90 д) и **Алерты** (critical/warn/info).
- **CSV:** `GET /admin/analytics/export?kind=farm|enchant|quests|economy|loot` (заголовок `X-Soulforge-Admin`).
- **SQL:** [`server/scripts/balance-queries.sql`](scripts/balance-queries.sql) — те же метрики для Navicat.
- **Алерты** создаются автоматически при `POST /events`: золотой дроп B+ в главе I, `+6/+10` с golden, adena/мин &gt; порога в `banana_mine`.

Правила алертов: [`server/db/balance-analytics.js`](db/balance-analytics.js).

## Подготовка к PostgreSQL

Схема целевой БД: [`db/schema.postgres.sql`](db/schema.postgres.sql).  
Пример env: [`.env.example`](.env.example).

План миграции (когда понадобится):

1. `apt install postgresql` на VPS, `CREATE DATABASE soulforge`.
2. Применить `schema.postgres.sql`.
3. Скрипт `migrate-sqlite-to-postgres.mjs` (ещё не реализован) — копия из `soulforge.db`.
4. В коде: слой `server/db/` + `pg` pool, `SOULFORGE_DB_DRIVER=postgres`.
5. Smoke → переключить pm2 → оставить SQLite как бэкап на неделю.

Пока в проде **SQLite** — этого достаточно до роста нагрузки.

Код БД вынесен в [`db/`](db/): `index.js` (фабрика), `sqlite.js` (текущий драйвер), `save-utils.js` (сводка сейва).  
`index.js` API вызывает `createStore()` — для Postgres позже добавится `db/postgres.js` с тем же интерфейсом.

## API

- `GET /admin/enabled` — включена ли админка (без ключа)
- `GET /admin/overview` · `GET /admin/users` · `PUT /admin/users/:id/score` · `DELETE /admin/users/:id` — заголовок `X-Soulforge-Admin`
- `POST /auth/register` `{ nick, password }`
- `POST /auth/login`
- `POST /auth/logout` (Bearer)
- `POST /runs` (Bearer) — characterId, charName, maxPlus, farmPower, earned, adena, mobs
- `POST /events` (Bearer) — batch ключевых действий персонажа
- `GET /events`, `GET /backups` (Bearer) — свой журнал / список снапшотов
- `GET /leaderboard/:mode` — `enchant` | `power` | `wealth` | `mobs` (имя героя + ник аккаунта)
- Admin: `GET …/backups`, `POST …/backups/:id/restore` — откат персонажа
- Admin UI `/db-admin` — вкладки Аккаунты / **Баланс** / **Алерты** / События / Бэкапы / Рейтинг
- Admin: `GET /admin/analytics/balance` · `GET /admin/analytics/export` · `GET /admin/alerts`
