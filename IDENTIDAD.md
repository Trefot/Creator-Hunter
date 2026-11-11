# Nexus Studio · Identidad aprobada

El usuario eligió el nombre **Nexus Studio**, la interfaz híbrida y el **concepto B: el compañero sosteniendo el farol**. El lema es «Tu espacio para crear». La criatura todavía no tiene un nombre propio.

## Recursos

- `src/assets/nexus-emblem.png`: original de 1254×1254 con transparencia RGBA real. Preparado mediante generación de imagen a partir del concepto elegido.
- `src/assets/nexus-mark.png`: versión 256×256 que carga el logo de la interfaz.
- `src/assets/nexus-favicon.png`: versión 32×32 del favicon.
- `src/assets/nexus-stream-deck-72.png` y `nexus-stream-deck-144.png`: imágenes para personalizar teclas. No contienen automatizaciones ni configuran el dispositivo.
- `src-tauri/icons/`: iconos de escritorio regenerados desde el mismo original para la próxima compilación nativa.

Paleta: grafito como base, violeta como color principal y dorado en luz y detalles. El emblema no necesita un rectángulo de fondo y debe conservar su proporción cuadrada. En tamaños pequeños se usa la versión rasterizada correspondiente; no se añaden rótulos dentro del icono.

## Regenerar

```bash
npm run tauri -- icon src/assets/nexus-emblem.png --output /tmp/nexus-studio-icons
npm run tauri -- icon src/assets/nexus-emblem.png --output /tmp/nexus-stream-deck --png 72 --png 144
```

La primera orden genera también recursos móviles: este proyecto solo incorpora los archivos de escritorio del nivel superior que ya existen en `src-tauri/icons/`. El original del emblema es la fuente vigente, en lugar del antiguo `src-tauri/app-icon.svg`.

## Compatibilidad

Nexus Studio es la marca visible. Los nombres históricos de carpeta, servicio de credenciales y formato de archivo permanecen para no perder conexiones ni datos. El nombre del paquete instalador se conserva temporalmente hasta probar en Windows la actualización desde TrophyHunter. Esta entrega no instala nada sobre la app diaria ni implica que el asistente de IA esté implementado.
