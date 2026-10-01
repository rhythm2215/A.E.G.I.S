@echo off
echo ========================================================
echo   Deploying A.E.G.I.S. Frontend to Railway (Direct CLI)
echo ========================================================
cd /d "%~dp0"
echo Uploading frontend directory to Railway...
railway up
pause
