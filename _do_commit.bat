@echo off
cd /d D:\SoulForge-web
git add -A
git -c user.email=soulforge-export@local -c user.name="SoulForge Export" commit -m "Remove helper batch; keep push instructions"
git log -2 --oneline
git status -sb
del "%~f0"
