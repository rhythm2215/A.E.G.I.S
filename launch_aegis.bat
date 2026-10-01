@echo off
setlocal enabledelayedexpansion
title A.E.G.I.S. Command Center Launcher
color 0b
cls

echo =====================================================================
echo    A.E.G.I.S. (Advanced Edge-based Geo-Intelligence ^& Surveillance)
echo                  TACTICAL COMMAND CENTER LAUNCHER
echo =====================================================================
echo.

set "PROJECT_ROOT=%~dp0"
cd /d "%PROJECT_ROOT%"

echo [1/5] Terminating previous AEGIS processes and freeing ports...
taskkill /FI "WINDOWTITLE eq AEGIS Backend Server" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq AEGIS Frontend Server" /T /F >nul 2>&1
taskkill /FI "IMAGENAME eq uvicorn.exe" /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr LISTENING') do taskkill /PID %%a /T /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr LISTENING') do taskkill /PID %%a /T /F >nul 2>&1
ping 127.0.0.1 -n 2 >nul

echo [2/5] Locating Node.js ^& NPM runtime...
set "PATH=%PATH%;C:\Program Files\nodejs;%AppData%\npm"
where node.exe >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%node_modules" (
    echo [SETUP] Installing frontend dependencies with npm install...
    call npm install
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] npm install encountered an error.
        pause
        exit /b 1
    )
)

echo [3/5] Locating Python environment ^& dependencies...
set "PYTHON_EXE="

if exist "%PROJECT_ROOT%backend\venv\Scripts\python.exe" (
    "%PROJECT_ROOT%backend\venv\Scripts\python.exe" -c "exit()" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXE=%PROJECT_ROOT%backend\venv\Scripts\python.exe"
        echo  -^> Using backend virtualenv: backend\venv
    )
)
if "!PYTHON_EXE!"=="" if exist "%PROJECT_ROOT%.venv\Scripts\python.exe" (
    "%PROJECT_ROOT%.venv\Scripts\python.exe" -c "exit()" >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXE=%PROJECT_ROOT%.venv\Scripts\python.exe"
        echo  -^> Using project virtualenv: .venv
    )
)
if "!PYTHON_EXE!"=="" if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python312\python.exe"
    echo  -^> Using Python 3.12: %LocalAppData%\Programs\Python\Python312\python.exe
)
if "!PYTHON_EXE!"=="" (
    where python.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXE=python.exe"
        echo  -^> Using system PATH python
    ) else (
        where py.exe >nul 2>&1
        if !ERRORLEVEL! EQU 0 (
            set "PYTHON_EXE=py.exe"
            echo  -^> Using Windows py launcher
        )
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] No Python runtime found.
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

REM Verify critical backend packages (FastAPI and Uvicorn)
"%PYTHON_EXE%" -c "import fastapi, uvicorn" >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [SETUP] Installing required Python packages...
    "%PYTHON_EXE%" -m pip install fastapi "uvicorn[standard]" pydantic pydantic-settings python-dotenv numpy opencv-python requests pillow websockets python-multipart
)

echo [4/5] Starting A.E.G.I.S. Core Services...
echo  -^> Starting FastAPI Vision ^& Telemetry Broker (Port 8000)...
start "AEGIS Backend Server" cmd /k "%PROJECT_ROOT%backend\run_backend.bat"

echo  -^> Starting Vite React Surveillance GUI (Port 5173)...
start "AEGIS Frontend Server" cmd /k "%PROJECT_ROOT%run_frontend.bat"

echo.
echo [5/5] Initializing Tactical Display...
echo Waiting 4 seconds for local server initialization...
ping 127.0.0.1 -n 5 >nul

REM Locate Chrome for standalone tactical app mode
set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"
) else (
    where chrome.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "CHROME_EXE=chrome.exe"
)

if not "%CHROME_EXE%"=="" (
    echo  -^> Opening Tactical App Window in Google Chrome...
    start "" "%CHROME_EXE%" --app=http://localhost:5173 --window-size=1500,950
) else (
    echo  -^> Opening Tactical Dashboard in default browser...
    start http://localhost:5173
)

echo.
echo =====================================================================
echo     A.E.G.I.S. COMMAND PLATFORM BOOTED SUCCESSFULLY!
echo =====================================================================
echo   * GUI Interface:    http://localhost:5173
echo   * Backend API:      http://127.0.0.1:8000
echo   * API Docs:         http://127.0.0.1:8000/docs
echo   * Live Video Feed:  http://127.0.0.1:8000/api/video/feed
echo =====================================================================
echo.
echo (Servers are running in their dedicated background console windows.)
ping 127.0.0.1 -n 4 >nul
