# Push to GitHub

Local release repo is ready at `D:\SoulForge-web` (branch `main`, initial commit done).

## 1. Login (once)

```bat
gh auth login
```

## 2. Create repo and push

```bat
cd /d D:\SoulForge-web
gh repo create SoulForge-web --public --source=. --remote=origin --push
```

Or private:

```bat
gh repo create SoulForge-web --private --source=. --remote=origin --push
```

## Manual alternative

1. Create empty repo on GitHub (no README).
2. Then:

```bat
cd /d D:\SoulForge-web
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

## Re-export from workshop

```bat
cd /d D:\L2Raptus
py tools\export_release_web.py
```

Скрипт пересобирает дерево, но **сохраняет** `.git`. Дальше в `D:\SoulForge-web`:

```bat
git add -A
git commit -m "Release sync"
git push
```
