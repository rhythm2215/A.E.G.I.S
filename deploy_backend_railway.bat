@echo off
echo ========================================================
echo   Deploying A.E.G.I.S. Backend to Railway (Direct CLI)
echo ========================================================
cd /d "%~dp0backend"
echo Uploading backend directory to Railway...
railway up
pause
