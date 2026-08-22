@echo off
REM ---------------------------------------------------------------
REM  Double-click this to run the app.
REM
REM  It checks for a new version first, so opening the app is all
REM  you ever need to do. If you're offline, or the check fails for
REM  any other reason, it just starts the version you already have.
REM
REM  Leave this window open while you're using the app - closing it
REM  stops the app.
REM ---------------------------------------------------------------
cd /d "%~dp0"

set NEEDINSTALL=0
if not exist "node_modules" set NEEDINSTALL=1

where git >nul 2>&1
if errorlevel 1 goto skipupdate
if not exist ".git" goto skipupdate

echo.
echo  Checking for updates...
echo.
for /f "delims=" %%i in ('git rev-parse HEAD:package-lock.json 2^>nul') do set LOCKBEFORE=%%i

REM --ff-only so this can only ever fast-forward. It refuses rather than
REM attempting a merge, which keeps a failed update from leaving a broken folder.
git pull --ff-only
if errorlevel 1 (
  echo.
  echo  Couldn't check for updates - starting the version you have.
  goto skipupdate
)

for /f "delims=" %%i in ('git rev-parse HEAD:package-lock.json 2^>nul') do set LOCKAFTER=%%i
REM Only reinstall when the dependency list actually moved.
if not "%LOCKBEFORE%"=="%LOCKAFTER%" set NEEDINSTALL=1

:skipupdate
if "%NEEDINSTALL%"=="1" (
  echo.
  echo  Installing what the app needs. This takes a minute.
  echo.
  call npm install
  if errorlevel 1 goto failed
)

echo.
echo  Starting up. When you see "Ready", open this in your browser:
echo.
echo      http://localhost:3000
echo.
echo  Press Ctrl+C or close this window to stop the app.
echo.
call npm run dev

:failed
echo.
pause
