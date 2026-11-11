# Actualizaciones de Nexus Studio

## 0.2.11 en preparación

Detección de Fortnite en PC, selección manual del juego e iconos/accesos de Windows. Se conserva el nombre técnico de instalación; el nombre visible de escritorio, Inicio y Programas será Nexus Studio. El workflow prueba una actualización silenciosa desde 0.2.10 en un runner Windows antes de publicar. No equivale a una prueba de grabación en el PC del usuario.

## 0.2.10 publicada

Estado: publicada el 2026-11-11. [Descargar instalador Windows](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.10/Nexus-Studio_0.2.10_x64-setup.exe) · [Release y novedades](https://github.com/Trefot/Creator-Hunter/releases/tag/v0.2.10).

En la app instalada: «Buscar actualizaciones» → «Actualizar ahora». El canal `releases` anuncia 0.2.10. La descarga manual y el instalador del canal son idénticos: 3.156.785 bytes, SHA-256 `0bbd99c5f37c7684db5b5e4685358ba841b4ef2f43dd0712ef23080020c4e615`.

La ejecución [43046894264](https://github.com/Trefot/Creator-Hunter/actions/runs/43046894264) terminó correctamente: pruebas, compilación nativa, instalador NSIS y publicación. Origen: `d6694f2da1008a292b96d49b24e977a5cd8a774a`. Sigue pendiente comprobar la instalación y el uso en el PC del usuario.

## Compilar en tu Windows sin depender de la subida a GitHub

1. Extrae el ZIP de esta versión en una carpeta de trabajo. No sustituye la carpeta de la app instalada.
2. Ejecuta `Preparar actualización Nexus Studio.bat`. Usa Node.js, Rust MSVC y Visual Studio Build Tools con C++ (los requisitos del proyecto original).
3. El archivo instala las dependencias del proyecto, comprueba versiones y pruebas, compila el instalador NSIS y abre `.release` cuando termina correctamente.
4. El instalador que genera es `Nexus-Studio_0.2.10_x64-setup.exe`. Ese archivo sí instala la actualización; el ZIP de código no es un instalador. La preparación no lo ejecuta ni cierra la aplicación diaria.

La fuente exportada lleva `.release-source.json` con el commit de origen. En un checkout Git se exige que los cambios estén guardados; en el ZIP exportado se usa ese metadato para registrar el origen declarado de la copia. No es una firma digital ni demuestra que una copia editada conserve el código original.

Si falta algún requisito o falla una prueba, el archivo se detiene mostrando el error y no publica nada. No se ha ejecutado este archivo de Windows en el entorno Linux de preparación.

## Compilar y publicar desde GitHub

Requiere una conexión con permisos reales de escritura sobre el contenido y los workflows de `Trefot/Creator-Hunter`. La cuenta puede tener acceso de administrador y aun así la integración devolver 403. No se deben pegar tokens en el chat.

El acceso quedó habilitado al instalar ChatGPT Codex Connector en GitHub. Para futuras versiones:

1. Subir el código preparado a una rama `release/**` (por ejemplo `release/nexus-studio-0.2.10`). Eso activa `.github/workflows/publicar-windows.yml`. También puede ejecutarse manualmente desde Actions cuando el workflow esté disponible en la rama principal.
2. El trabajo Windows comprueba versiones, ejecuta los tests de frontend, datos y núcleo nativo, y compila el instalador NSIS. Si algo falla, no se ejecuta la publicación.
3. Guarda los archivos compilados como artefacto de Actions. El trabajo de publicación verifica sus hashes, rechaza retrocesos o reemplazos incompatibles de versión, crea la release `v0.2.10` y actualiza la rama `releases` sin forzar ni borrar su historial.
4. Solo entonces la app instalada podrá encontrar 0.2.10 mediante «Buscar actualizaciones» o al abrirse. El usuario también podrá descargar el instalador desde la release.

La compilación en CI es una comprobación técnica; no sustituye la revisión de audio, OBS, Stream Deck y uso real en tu PC.

## Compatibilidad con TrophyHunter

Se mantienen `com.trefotg.studio`, la base `studio.db`, las credenciales, la carpeta de instalación y `productName = TrophyHunter`. Se evita que un cambio cosmético del instalador cree otra aplicación o cambie el destino que reabre el actualizador.

La interfaz y título muestran Nexus Studio. El instalador generado por Tauri conserva su nombre original y se copia con dos nombres:

- `Nexus-Studio_0.2.10_x64-setup.exe`: descarga visible al usuario.
- `TrophyHunter-setup.exe`: archivo que anuncia `latest.json`, compatible con los clientes instalados.

En la rama `releases`, el manifiesto y el ejecutable van en un mismo commit. Los campos adicionales `source_commit`, `sha256` y `size` registran origen y permiten comprobar integridad, pero el actualizador antiguo no verifica firma ni checksum. No se presentan como un sistema de actualización firmado.

## Comandos

```bash
npm run release:check
npm test
cargo test --locked --manifest-path tests/data-safety/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- build --bundles nsis
npm run release:prepare
```

Los dos últimos pasos de compilación nativa/instalador requieren Windows con los requisitos indicados. `scripts/publicar-version.sh` ofrece el flujo local de publicación desde Git Bash en Windows y conserva el canal de actualización existente.
