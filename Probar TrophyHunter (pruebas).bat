@echo off
rem Version de PRUEBAS (D-019): usa la base de datos de pruebas (studio-dev.db) y el puerto 7879.
rem Tu app diaria es la instalada (menu Inicio > TrophyHunter), con tus datos reales.
cd /d "%~dp0"
call npm run tauri dev
if errorlevel 1 pause
