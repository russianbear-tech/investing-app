@echo off
REM ---------------------------------------------------------------
REM  Double-click this to run the app.
REM  Leave the window open while you're using it - closing it
REM  stops the app.
REM ---------------------------------------------------------------
cd /d "%~dp0"

if not exist "node_modules" (
  echo.
  echo  First run - installing what the app needs. This takes a
  echo  minute or two, and only happens once.
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
