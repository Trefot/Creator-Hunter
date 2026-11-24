# Cambio rápido de Nexus para pruebas (no publica nada).
# Sustituye solo studio.exe por el compilado en este PC; los datos y recursos instalados no se tocan.
# Guarda el programa anterior como studio.exe.anterior para poder volver atrás con -Restaurar.
param([switch]$Restaurar)
$ErrorActionPreference = 'Stop'
$destino = Join-Path $env:LOCALAPPDATA 'TrophyHunter\studio.exe'
$copia = "$destino.anterior"
$nuevo = Join-Path $PSScriptRoot '..\src-tauri\target\release\studio.exe'

Get-Process studio -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $destino } | ForEach-Object {
    $_.CloseMainWindow() | Out-Null
    if (-not $_.WaitForExit(5000)) { Stop-Process -Id $_.Id -Force }
}
Start-Sleep -Milliseconds 500

if ($Restaurar) {
    if (-not (Test-Path $copia)) { throw 'No hay copia anterior para restaurar.' }
    Copy-Item $copia $destino -Force
    "Restaurado el programa anterior."
} else {
    if (-not (Test-Path $nuevo)) { throw "No existe $nuevo. Compila primero con: npm run tauri -- build --no-bundle" }
    Copy-Item $destino $copia -Force
    Copy-Item $nuevo $destino -Force
    "Nexus actualizado con la compilación local ($((Get-Item $destino).LastWriteTime))."
}
# No se abre desde aquí: si lo lanza otra app (p. ej. un asistente), Windows le da una carpeta de datos aparte.
"Ábrelo tú desde el menú Inicio."
