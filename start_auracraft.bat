@echo off
title AuraCraft Studio Launcher
color 0d

echo ========================================================================
echo   AURACRAFT STUDIO: REAL-TIME 3D PERSONA ^& VOICE STUDIO
echo ========================================================================
echo.

set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

echo [1/2] Starting AuraCraft Backend Service on port 8010...
start "AuraCraft Backend Service" cmd /k "cd /d %ROOT_DIR%apps\web-platform\backend && python -m uvicorn app.main:app --port 8010 --reload"

echo [2/2] Starting AuraCraft Web Studio on port 5173...
start "AuraCraft Web Studio" cmd /k "cd /d %ROOT_DIR%apps\web-platform\frontend && npm run dev"

echo.
echo Studio launcher sequence initiated.
echo Web Studio UI: http://localhost:5173
echo Backend Docs:  http://localhost:8010/docs
echo.
pause
