@echo off
REM Deploy SoulForge to VPS via SSH (requires OpenSSH client).
REM Set once:
REM   set SOULFORGE_SSH=user@your.vps.ip
REM   set SOULFORGE_DIR=/var/www/soulforge
REM Then:
REM   deploy.bat

if "%SOULFORGE_SSH%"=="" (
  echo Set SOULFORGE_SSH=user@host
  exit /b 1
)

set REMOTE_DIR=%SOULFORGE_DIR%
if "%REMOTE_DIR%"=="" set REMOTE_DIR=/var/www/soulforge

echo Deploy to %SOULFORGE_SSH%:%REMOTE_DIR%
ssh %SOULFORGE_SSH% "cd %REMOTE_DIR% && git pull --ff-only && cd server && npm ci --omit=dev && (pm2 describe soulforge >nul 2>&1 && HOST=127.0.0.1 PORT=8787 pm2 restart soulforge --update-env || (HOST=127.0.0.1 PORT=8787 pm2 start ecosystem.config.cjs && pm2 save)) && pm2 status soulforge"
if errorlevel 1 exit /b 1
echo OK
