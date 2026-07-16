@echo off
setlocal
set PORT=8787
set FOUND=0

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  set FOUND=1
  echo Stopping process %%P on port %PORT%...
  taskkill /PID %%P /F >nul 2>&1
)

if "%FOUND%"=="0" (
  echo No server on port %PORT%.
) else (
  echo Web server stopped.
)
timeout /t 2 >nul
