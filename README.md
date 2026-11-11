# Nexus Studio

Estudio personal de creación de contenido de TrefotG. Versión publicada: **[v0.2.11](https://github.com/Trefot/Creator-Hunter/releases/tag/v0.2.11)**. Actualiza desde «Buscar actualizaciones» o descarga el instalador de la release.

Aplicación de escritorio para Windows, construida con React, TypeScript, Tauri 2 y SQLite. Incluye Creator Studio, conexión con YouTube, biblioteca de juegos con trofeos de PSN y contadores para OBS y Stream Deck. Twitch sigue pendiente.

## Preparar la actualización

Para generar el instalador en tu PC, ejecuta `Preparar actualización Nexus Studio.bat` desde la carpeta extraída de esta versión. Requisitos, publicación por GitHub y estado real en [ACTUALIZACION.md](ACTUALIZACION.md).

## Preparar el desarrollo en Windows

Requisitos: Node.js LTS compatible con Vite 8 (20.19+ o 22.12+), Rust estable con toolchain MSVC, Visual Studio Build Tools con «Desarrollo para el escritorio con C++» y WebView2.

```bash
git clone https://github.com/Trefot/Creator-Hunter.git
cd Creator-Hunter
npm ci
npm run build
npm run tauri dev
```

`npm run build` comprueba TypeScript y compila la interfaz. `npm run tauri dev` abre la aplicación de escritorio de **PRUEBAS**. También se puede abrir con `Probar TrophyHunter (pruebas).bat` después de instalar las dependencias.

`npm run dev` solo inicia Vite: una pestaña de navegador no dispone de los comandos nativos ni de SQLite de Tauri y no sustituye la prueba de la app.

Las integraciones se configuran desde la aplicación. No hace falta conectar YouTube o PSN para empezar a revisar el código y compilar la interfaz.

## Usar la app

- **Instalada:** ejecuta el instalador de `src-tauri/target/release/bundle/` (msi o nsis). Usa `%APPDATA%\com.trefotg.studio\studio.db`; desarrollo usa `studio-dev.db`.
- **En desarrollo:** sigue los pasos de preparación anteriores.
- **Copias de seguridad:** sección "Copias de seguridad" de la app (se guardan en Documentos\TrophyHunter\Copias).

## Documentación

Empieza por [CLAUDE.md](CLAUDE.md) (reglas y comandos) y [PRODUCT.md](PRODUCT.md) (visión y alcance).
[ROADMAP.md](ROADMAP.md) contiene las tareas pendientes y [CHANGELOG.md](CHANGELOG.md), el historial de versiones.

La [revisión inicial](REVISION-INICIAL.md) recoge las comprobaciones del 2026-11-11, sus límites y las primeras correcciones propuestas.

[VALIDACION.md](VALIDACION.md) documenta las pruebas y las comprobaciones de Windows y la revisión pendiente en el PC del usuario. [RECOMENDACIONES.md](RECOMENDACIONES.md) propone mejoras para el uso personal, los directos y el contenido.

El [plan de automatización](AUTOMATIZACION.md) organiza las siguientes entregas con Stream Deck, OBS y el asistente de IA.

## Comprobar cambios

```bash
npm test
npm run build
cargo test --locked --manifest-path tests/data-safety/Cargo.toml
```

Las pruebas de datos usan el código real de SQLite con bases temporales, sin arrancar Tauri. Para comprobar también el núcleo de escritorio en Windows: `cargo test --locked --manifest-path src-tauri/Cargo.toml`.

La versión de pruebas necesita configurar sus propias conexiones de YouTube y PSN. Sus copias se guardan en `Documentos\TrophyHunter\Copias\Pruebas`. No reutiliza ni copia automáticamente las credenciales de producción.

## Identidad

Nombre definitivo: **Nexus Studio**. Emblema elegido: el compañero violeta sosteniendo el farol (concepto B); lema «Tu espacio para crear». Recursos y regeneración de iconos en [IDENTIDAD.md](IDENTIDAD.md). El nombre anterior TrophyHunter se conserva en rutas y claves compatibles; la 0.2.11 incluye el icono explícito de ventana y accesos Nexus Studio, conservando el nombre técnico para actualizar la instalación existente.

## Fortnite en PC

Con Fortnite abierto, entra en Juegos y pulsa «Añadir Fortnite para PC» una vez. El modo automático reconocerá su proceso cada 15 segundos, sin necesitar PSN. «Elegir juego» permite seleccionar manualmente un juego de cualquier plataforma y volver a la detección automática al terminar. El estado muestra su procedencia; no implica que Nexus esté conectado al estado de grabación de OBS.
