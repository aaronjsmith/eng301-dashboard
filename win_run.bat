@echo off
rem ENG301 Student Outcomes Dashboard - Windows launcher.
rem Double-click this file. Starts the Vite dev server and opens the
rem dashboard in your browser. Close this window to stop the server.

setlocal
title ENG301 Dashboard
cd /d "%~dp0"

set "PORT=5173"
set "URL=http://localhost:%PORT%"

echo == ENG301 Dashboard launcher ==

rem Node available?
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js/npm not found.
  echo Install Node.js ^(LTS^) from https://nodejs.org and run this again.
  pause
  exit /b 1
)

rem Already running? Just open the browser.
curl -sf %URL% >nul 2>nul
if not errorlevel 1 (
  echo Dashboard is already running at %URL% - opening browser.
  start "" %URL%
  exit /b 0
)

rem First run: install dependencies.
if not exist node_modules (
  echo First run - installing dependencies ^(one-time, ~1 min^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed - see output above.
    pause
    exit /b 1
  )
)

rem Background helper: open the browser once the server responds.
start "" /min cmd /c "for /l %%i in (1,1,60) do (curl -sf %URL% >nul 2>nul && start \"\" %URL% && exit || timeout /t 1 /nobreak >nul)"

echo Starting dev server at %URL%  (close this window to stop)
call npm run dev -- --port %PORT% --strictPort
pause
