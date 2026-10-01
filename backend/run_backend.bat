@echo off
setlocal enabledelayedexpansion
title AEGIS Backend Server
cls
echo =====================================================================
echo    A.E.G.I.S. Fast-API Vision ^& Telemetry Broker
echo =====================================================================
echo.
cd /d "%~dp0"

set "PYTHON_EXE="
if exist "%~dp0venv\Scripts\python.exe" (
    "%~dp0venv\Scripts\python.exe" -c "exit()" >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "PYTHON_EXE=%~dp0venv\Scripts\python.exe"
)
if "!PYTHON_EXE!"=="" if exist "%~dp0..\.venv\Scripts\python.exe" (
    "%~dp0..\.venv\Scripts\python.exe" -c "exit()" >nul 2>&1
    if !ERRORLEVEL! EQU 0 set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"
)
if "!PYTHON_EXE!"=="" if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set "PYTHON_EXE=%LocalAppData%\Programs\Python\Python312\python.exe"
)
if "!PYTHON_EXE!"=="" (
    where python.exe >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        set "PYTHON_EXE=python.exe"
    ) else (
        set "PYTHON_EXE=py.exe"
    )
)

echo Starting Uvicorn on http://127.0.0.1:8000 using %PYTHON_EXE% ...
"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend crashed or failed to start.
    pause
)
