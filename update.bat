@echo off
REM ---------------------------------------------------------------
REM  Double-click this to get the latest version of the app.
REM  It does two things: downloads the newest code, then installs
REM  any new packages that code needs.
REM ---------------------------------------------------------------
cd /d "%~dp0"

echo.
echo  Getting the latest version...
echo.
git pull
if errorlevel 1 goto failed

echo.
echo  Installing any new packages (this can take a minute)...
echo.
call npm install
if errorlevel 1 goto failed

echo.
echo  ============================================
echo   Up to date. Double-click start.bat to run.
echo  ============================================
echo.
pause
exit /b 0

:failed
echo.
echo  ---------------------------------------------------------
echo   Something went wrong. Take a screenshot of this window
echo   and send it over - the message above says what happened.
echo  ---------------------------------------------------------
echo.
pause
exit /b 1
