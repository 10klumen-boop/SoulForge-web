@echo off
cd /d "%~dp0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8787 " ^| findstr LISTENING') do (
  echo Port 8787 is already in use ^(PID %%P^).
  echo Run stop-web.bat first, or open: http://localhost:8787
  pause
  exit /b 1
)

cd server
if not exist "node_modules\" (
  echo Installing dependencies...
  call npm.cmd install
  if errorlevel 1 pause & exit /b 1
)

echo SoulForge Lineage 2 — web server
echo Open in browser: http://localhost:8787
echo.
echo Leave this window open. To stop: close window or run stop-web.bat
echo.
call npm.cmd start
if errorlevel 1 pause
