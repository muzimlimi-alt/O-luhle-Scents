@echo off
cd /d "%~dp0"
echo Stopping process on port 3000...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do (
  taskkill /PID %%i /F >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Starting server...
node src/index.js
