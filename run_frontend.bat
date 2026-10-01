@echo off
title AEGIS Frontend Server
cls
echo =====================================================================
echo    A.E.G.I.S. React Surveillance GUI Server
echo =====================================================================
echo.
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs;%AppData%\npm"

echo Starting Vite Dev Server on http://localhost:5173 ...
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Frontend failed to start.
    pause
)
