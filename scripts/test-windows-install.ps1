# En un runner desechable: actualizar una instalación real 0.2.16 sin iniciar la app.
$ErrorActionPreference = 'Stop'
$installDir = Join-Path $env:RUNNER_TEMP 'NexusCompatibility'
$previous = Join-Path $env:RUNNER_TEMP 'nexus-previous.exe'
Invoke-WebRequest 'https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.16/TrophyHunter-setup.exe' -OutFile $previous
function Install-AndWait($file) {
  $p = Start-Process -FilePath $file -ArgumentList '/S', "/D=$installDir" -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "Instalador falló: $($p.ExitCode)" }
  if (!(Test-Path "$installDir\studio.exe")) { throw 'No se conservó studio.exe' }
}
Install-AndWait $previous
$before = Get-FileHash "$installDir\studio.exe"
Install-AndWait (Resolve-Path '.release/TrophyHunter-setup.exe')
$after = Get-FileHash "$installDir\studio.exe"
if ($before.Hash -eq $after.Hash) { throw 'El ejecutable no se actualizó' }
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('DesktopDirectory'), [Environment]::GetFolderPath('Programs'))) {
  $path = Join-Path $folder 'Nexus Studio.lnk'
  if (!(Test-Path $path)) { throw "Falta acceso: $path" }
  $link = $shell.CreateShortcut($path)
  if ($link.TargetPath -ne "$installDir\studio.exe") { throw "Destino incorrecto: $($link.TargetPath)" }
  if ($link.IconLocation -notlike "$installDir\nexus-studio.ico*") { throw "Icono incorrecto: $($link.IconLocation)" }
  if (Test-Path (Join-Path $folder 'TrophyHunter.lnk')) { throw 'Quedó el acceso antiguo' }
}
if (!(Test-Path "$installDir\nexus-studio.ico")) { throw 'Falta icono instalado' }
$entry = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TrophyHunter'
if ($entry.DisplayName -ne 'Nexus Studio') { throw 'Nombre visible incorrecto' }
if ($entry.DisplayVersion -ne (Get-Content '.release/latest.json' | ConvertFrom-Json).version) { throw 'Versión instalada incorrecta' }
Write-Host 'Actualización desde 0.2.16: ejecutable, accesos, iconos y nombre verificados.'
