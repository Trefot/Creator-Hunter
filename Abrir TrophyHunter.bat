@echo off
rem Abre TrophyHunter en modo desarrollo. La primera vez tras cambios en Rust tarda unos minutos.
cd /d "%~dp0"
call npm run tauri dev
if errorlevel 1 pause
