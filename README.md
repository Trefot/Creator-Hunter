# Nexus Studio

Estudio personal de creación de contenido de TrefotG. Versión publicada: **[v0.2.19](https://github.com/Trefot/Creator-Hunter/releases/tag/v0.2.19)**. Actualiza desde «Buscar actualizaciones» o descarga el instalador de la release.

Aplicación de escritorio para Windows, construida con React, TypeScript, Tauri 2 y SQLite. Incluye Creator Studio, conexión con YouTube, biblioteca de juegos con trofeos de PSN y contadores para OBS y Stream Deck. Los overlays se pueden emitir en Twitch desde OBS; no hay sincronización de métricas de Twitch.


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

## OBS y Stream Deck

Live Studio permite conectar OBS WebSocket v5 y marcar momentos con los tiempos de grabación/directo y el juego actual. Tiene un historial con copia de lista y URL para el botón de Stream Deck. Configuración inicial y límites en [OBS.md](OBS.md). Desde 0.2.13 también guarda clips del Replay Buffer por pulsación explícita, con archivo confirmado e historial. No inicia ni detiene salidas por su cuenta.

## Juegos y creación

Biblioteca con búsqueda y plataformas. Fortnite y juegos sin trofeos tienen plan diario, notas y portada editable. Cada juego reúne clips, momentos, ideas y proyectos; una captura se convierte en idea sin duplicarse y conserva su juego al aprobarse como proyecto. PlayStation mantiene sus trofeos, ruta y guía. Detalles y pruebas en [JUEGOS.md](JUEGOS.md). Colección de platinados, objetivos para OBS/Stream Deck y detección visual experimental calibrable en [DIRECTOS-JUEGOS.md](DIRECTOS-JUEGOS.md).

## Alertas por plataforma

Live Studio incluye tres fuentes locales separadas para OBS: Twitch, YouTube y TikTok. Hay 16 plantillas por evento, con artes preparados desde la muestra de Trefot y nuevas poses de celebración, regalo, aporte, portal y corazones. Se mantiene un enlace y una cola por plataforma. Se pueden editar etiqueta, nombre, mensaje, tipografía y colores del texto, con una vista previa aislada. Preferencias, colas y controles de Stream Deck independientes; pruebas identificadas y anuncios manuales. La recepción automática de eventos de las redes sigue pendiente de implementar. Configuración y límites en [ALERTAS.md](ALERTAS.md).

Elige **Tipo de alerta** en cada plataforma. Puedes editar, guardar, activar/desactivar y probar cada evento por separado; los borradores se conservan al cambiar de tipo. Para recuperar sus valores predeterminados, pulsa **Cargar diseño de la muestra → Guardar**. Al pasar desde 0.2.17, refresca una vez cada fuente de navegador en OBS. La referencia visual está conservada en [design](design/README.md).
