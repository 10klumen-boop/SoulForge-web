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

Then in `D:\SoulForge-web`: add, commit, push. Re-export wipes the folder — keep `.git` by exporting to a temp path and copying files, or re-init after export with `--init-git` only on first run.

Note: `export_release_web.py` currently **deletes** the output directory. To update an existing git repo without losing history, export to a temp folder and sync files (or enhance the script later).
