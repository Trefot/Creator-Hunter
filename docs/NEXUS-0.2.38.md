# Nexus Studio 0.2.38 · Actualización integral

## Qué cambia

- Audio: selección explícita de pistas de OBS para Shorts y transcripción. Varias pistas se mezclan en una sola con limitador; no se mezclan automáticamente para evitar duplicar una mezcla que ya incluya voz y juego. Sin selección, un Short no lleva audio; transcripción exige alguna pista.
- Vídeo: Original conserva la proporción; Horizontal usa lienzo 16:9 con bandas; Vertical recortado funciona también con entradas estrechas; Vertical con fondo conserva toda la imagen. Vista previa del formato antes de exportar.
- Procesamiento: cola global de hasta 20 trabajos y 60 resultados durante la sesión, un trabajo pesado a la vez, cancelación del proceso y progreso accesible al cambiar de sección. Modo ligero activado por defecto: menos hilos y trabajos nuevos en espera mientras OBS graba o emite. Los iniciados continúan. Al cerrar Nexus se cancelan los pendientes; no se reanudan automáticamente al volver a abrir.
- Aceleración: prueba real de NVENC desde Procesamiento local. Solo si funciona en esa sesión se permite elegir NVIDIA al exportar; CPU sigue siendo la opción predeterminada. Whisper continúa usando CPU.
- Subtítulos: temporales únicos, reserva exclusiva del nombre SRT y limpieza al terminar/cancelar. Registro del nombre realmente creado. Importación por ruta sin mover el vídeo y paginación de grabaciones anteriores.
- YouTube: coincidencias solo para el perfil conectado y formatos de YouTube; el enlace de un programado permite proponerlo luego como publicado. Comparación más estricta y rechazo de empates ambiguos. Consulta periódica y actualización manual; cada cambio requiere confirmación.
- Planificación: una definición común de producción terminada para tablero y colchón; las versiones completas sin publicar siguen siendo accionables. Progreso semanal coherente tras cambiar la rutina y actualización al cambiar de día.
- Servicios: guía general con requisitos, pasos y comprobación; estados separados para autorización, reproducción y configuración. Fallos de consulta no se confunden con servicios sin configurar. Historial de cambios de estado durante la sesión y avisos de Discord persistidos (50 entradas), conservando su deduplicación y sus reglas de reintento.
- Gaming: guía PC/PlayStation, perfiles por objeto/resolución/idioma guardados en las copias de Nexus, recuperación en modo de prueba, historial de coincidencias y acciones de confirmación/deshacer. El detector continúa siendo experimental.
- Contenido: después de exportar se puede registrar ese Short para transcribirlo o continuar en el proyecto original con la ruta del export adjunta una sola vez. La publicación y sus fechas se gestionan desde las versiones del proyecto y el calendario existentes.
- Interfaz: accesos de directo separados de configuración; Juegos, En directo, Perfiles y Contenido se cargan bajo demanda. Se conserva el estado de formularios al cambiar entre pestañas de En directo.

## Comprobación en el PC de Trefot

1. Grabar una prueba en OBS con las pistas que realmente usas y comprobar voz y juego en el Short. Elegir una pista ya mezclada o las pistas independientes correspondientes.
2. Revisar el SRT generado y su sincronización con una grabación corta. Whisper puede cometer errores; todavía no incrusta subtítulos dentro del vídeo.
3. Probar NVENC sin directo y comparar una exportación representativa antes de elegir GPU habitualmente. La presencia de una RTX 3060 Ti no demuestra por sí sola que FFmpeg y el controlador funcionen.
4. Comprobar una alerta real de Twitch/YouTube y sus avisos de Discord; la guía y las pruebas simuladas no acreditan la entrega real.
5. Calibrar un objeto de Wukong y probar sus coincidencias antes del marcado automático. No hay un tracker universal verificado para contar cofres abiertos y rotos de Fortnite; los botones manuales se conservan.

## Integridad y límites

La restauración de copias se bloquea mientras haya trabajos de vídeo pendientes o activos. Nunca se borra el vídeo original al cancelar, descartar o transcribir. La cancelación durante la codificación elimina solo la salida incompleta creada por ese trabajo. Al empezar a guardar el resultado final se cierra la ventana de cancelación.

No se amplían permisos del repositorio ni se añaden servicios de pago. Las pruebas de interfaz usan SQLite temporal y servicios simulados; las exportaciones de regresión usan FFmpeg y audio/vídeo sintéticos reales. La compilación Windows y la prueba del instalador son necesarias antes de publicar.
