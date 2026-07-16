@echo off
cd /d D:\SoulForge-web
git status -sb
git add -A
git -c user.email=soulforge-export@local -c user.name="SoulForge Export" commit -m "Initial release: web game + server (no dev panel)"
git log -1 --oneline
git status -sb
