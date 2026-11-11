# Actualizaciones de Nexus Studio

## 0.2.15 preparada, publicación pendiente

Portada oficial de Fortnite, colección de platinados y objetivos de Wukong/Fortnite para OBS y Stream Deck. Detección visual experimental por referencia, sin IA generativa; requiere calibración real por objeto en el OBS del usuario. Uso en [DIRECTOS-JUEGOS.md](DIRECTOS-JUEGOS.md).

El código está preparado desde `14b3fb509252bffd3d507fa48936d7fdb03c8e45`. La ejecución [43095079417](https://github.com/Trefot/Creator-Hunter/actions/runs/43095079417) pasó pruebas, build NSIS y actualización desde 0.2.14, pero falló transfiriendo el artefacto antes de publicar. [Reintento 43097625025](https://github.com/Trefot/Creator-Hunter/actions/runs/43097625025) con el flujo original, pendiente. El propietario autorizó publicar directamente desde el trabajo de Windows, manteniendo pruebas, verificación SHA-256, prueba de actualización y protección contra versiones anteriores. Cambio aplicado en `d876c2d`; [ejecución directa 43099483059](https://github.com/Trefot/Creator-Hunter/actions/runs/43099483059), en cola. GitHub Status confirmó una incidencia importante de Actions el 2026-11-11: https://stspg.io/jdjlq5zjyl48. El canal mantiene 0.2.14; no se debe anunciar 0.2.15 como instalable hasta verificar la publicación y sus archivos.

## 0.2.14 publicada

[Descargar instalador 0.2.14](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.14/Nexus-Studio_0.2.14_x64-setup.exe) o «Buscar actualizaciones» → «Actualizar ahora».

Nueva biblioteca y fichas de juegos sin trofeos: plan diario, portada/notas y contenido por juego. Las capturas se convierten en ideas sin duplicarse y sus proyectos conservan el contexto. Se mantienen las funciones de trofeos de PlayStation. Uso en [JUEGOS.md](JUEGOS.md).

La ejecución 43080516190 pasó pruebas, compilación NSIS y actualización desde 0.2.13. Descarga y canal verificados: 3.363.815 bytes, SHA-256 `e5cce87928afca54f6317ff61bc46e591c6ae8c9782dd814d3908fa5d1c694a6`, origen `2f93606581aeb6ccd5e732691f504ab89b13de08`. Migración 018 protegida por copia previa; 25 tablas en las copias y compatibilidad con esquema 17. Revisión en el PC del usuario pendiente.

## 0.2.13 publicada

[Descargar instalador 0.2.13](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.13/Nexus-Studio_0.2.13_x64-setup.exe) o «Buscar actualizaciones» → «Actualizar ahora».

Guardar clip del Replay Buffer desde Live Studio o Stream Deck. Requiere activar e iniciar el búfer en OBS; conserva la conexión existente. Consulta [OBS.md](OBS.md). Historial con ruta confirmada y marca opcional. La copia JSON incluye referencias y metadatos, no los vídeos.

La ejecución 43074073595 pasó pruebas, build NSIS y actualización desde 0.2.12. Descarga y canal verificados: 3.359.643 bytes, SHA-256 `f3ddaf12b9e29103c231b4da37ee51d8f83570deb5b3cd54d1ac7e83808e384b`, origen `99dd7ed169dd2a4c4dd7e25130ed1fa8aba44a99`. Migración 017 protegida por copia previa; 25 tablas en las copias, compatibilidad con esquema 16. El guardado físico en el OBS del usuario sigue pendiente de prueba.

## 0.2.12 publicada

[Descargar instalador 0.2.12](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.12/Nexus-Studio_0.2.12_x64-setup.exe) o «Buscar actualizaciones» → «Actualizar ahora» en Nexus. Instala al terminar tu grabación si utilizas sus overlays.

OBS local y marcas desde Stream Deck, sin iniciar ni detener salidas. Requiere activar WebSocket en OBS y configurar puerto/contraseña una vez en Live Studio; instrucciones en [OBS.md](OBS.md).

La ejecución 43068021591 pasó las pruebas, build NSIS y actualización silenciosa desde 0.2.11. Release y canal verificados: 3.349.295 bytes, SHA-256 `0f18621a516fa0d7ccaa2bb2e5ef7089c34e57bea8c8a9721455fd249140c480`, origen `89b524a94c5cd56032b19bbe75be0144b375fc6e`. Migración 016 protegida por copia previa y nuevas tablas incluidas en las copias; se admiten copias del esquema anterior. No se ha probado todavía con el OBS real del usuario.

## 0.2.11 publicada

[Descargar instalador 0.2.11](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.11/Nexus-Studio_0.2.11_x64-setup.exe). En Nexus: «Buscar actualizaciones» → «Actualizar ahora». Si estás usando los overlays, instala al terminar la grabación, porque Nexus se cierra y vuelve a abrirse.

Detección de Fortnite en PC, selección manual del juego e iconos/accesos de Windows. Se conserva el nombre técnico de instalación; el nombre visible de escritorio, Inicio y Programas será Nexus Studio. El workflow 43061149568 pasó una actualización silenciosa desde 0.2.10 en un runner Windows antes de publicar. Descarga y canal `releases` verificados: instaladores idénticos, SHA-256 `8cd4fbe894ad0af09aa8bef94d8a5f736ea34369e8e5d72cf45515d4305893e7`, origen `6c57f1ca119f5b361ee0e933eb65cd8ecf5d38b9`. No equivale a una prueba de grabación en el PC del usuario.

## 0.2.10 publicada

Estado: publicada el 2026-11-11. [Descargar instalador Windows](https://github.com/Trefot/Creator-Hunter/releases/download/v0.2.10/Nexus-Studio_0.2.10_x64-setup.exe) · [Release y novedades](https://github.com/Trefot/Creator-Hunter/releases/tag/v0.2.10).

En la app instalada: «Buscar actualizaciones» → «Actualizar ahora». El canal `releases` anunció 0.2.10; ahora anuncia 0.2.14. La descarga manual y el instalador del canal son idénticos: 3.156.785 bytes, SHA-256 `0bbd99c5f37c7684db5b5e4685358ba841b4ef2f43dd0712ef23080020c4e615`.

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
