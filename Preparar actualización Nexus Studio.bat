@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 goto requisitos
where cargo >nul 2>&1
if errorlevel 1 goto requisitos
call npm ci
if errorlevel 1 goto fallo
call npm run release:check
if errorlevel 1 goto fallo
call npm test
if errorlevel 1 goto fallo
cargo test --locked --manifest-path tests/data-safety/Cargo.toml
if errorlevel 1 goto fallo
cargo test --locked --manifest-path src-tauri/Cargo.toml
if errorlevel 1 goto fallo
call npm run tauri -- build --bundles nsis
if errorlevel 1 goto fallo
call npm run release:prepare
if errorlevel 1 goto fallo
echo.
echo Instalador preparado en .release. La app no se ha cerrado ni instalado automaticamente.
start "" "%CD%\.release"
pause
exit /b 0
:requisitos
echo Se necesita Node.js LTS, Rust MSVC y Visual Studio Build Tools con C++.
echo Consulta README.md. No se ha modificado la app instalada.
pause
exit /b 1
:fallo
echo.
echo La preparacion ha fallado. No se ha publicado ni instalado ninguna actualizacion.
echo Revisa el error anterior antes de continuar.
pause
exit /b 1
