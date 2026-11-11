# PRODUCT.md — Visión y alcance

Nombre definitivo: **Nexus Studio**. Identidad visual aprobada en [IDENTIDAD.md](IDENTIDAD.md).

## Visión

Un "sistema operativo" para **creadores de contenido, comunidades y jugadores**: módulos conectados que comparten identidad, datos, permisos y automatizaciones, en lugar de aplicaciones sueltas.

Es una herramienta **exclusivamente personal** para gestionar TrefotG. Decisión del usuario confirmada el 2026-11-11: no se distribuirá a terceros ni se convertirá en SaaS. Las referencias históricas a SaaS en documentos anteriores no definen el alcance actual.

> No construimos una aplicación para tener más herramientas, sino para necesitar menos y tener más control.

## Principios

- Modular, mantenible y con la seguridad pensada desde el diseño.
- Fácil de usar sin conocimientos técnicos.
- Integraciones oficiales siempre que sea posible. Nunca métodos que pongan en riesgo las cuentas del usuario.
- No construir nada antes de necesitarlo. La estabilidad va antes que la velocidad.
- Priorizar datos seguros, preparación de directos, aprovechamiento de grabaciones y una rutina breve de planificación y revisión. No añadir infraestructura de varios usuarios ni permisos de organización.
- **Automatización máxima útil:** Stream Deck como control rápido, OBS como fuente de eventos y un asistente de IA que prepara ideas y borradores con contexto. El objetivo es reducir tareas repetitivas y tiempo de gestión para dedicarlo a crear contenido. Implementación por etapas en AUTOMATIZACION.md.
- **Autonomía híbrida:** lo rutinario se automatiza. Publicar, gastar dinero o tomar decisiones sensibles requiere aprobación.
- La IA es transparente: no se hace pasar por una persona, no inventa respuestas y no genera actividad falsa.

## Módulos

| Módulo | Propósito | Fase |
|---|---|---|
| **Creator Studio** | Gestionar el contenido de la idea al análisis | I |
| Core | Identidad, permisos, eventos, automatizaciones, integraciones y aprobaciones | II (crece por necesidad) |
| Community Hub | Bot de Discord 24/7: bienvenida, moderación, actividades y base de conocimiento | II |
| Community Identity Sync | Vincular cuentas y sincronizar roles según suscripciones y membresías | II |
| Live Studio | OBS, chat, alertas, programación de directos y Live Companion | III |
| Automation Builder | CUANDO → CONDICIONES → ACCIONES entre módulos | III |
| Music Requests | Peticiones musicales por chat (respetando derechos y políticas) | III |
| Video Studio | Clips, subtítulos y formatos a partir de grabaciones propias | IV |
| Growth Intelligence | Análisis y recomendaciones con datos reales | IV |
| Gaming Intelligence | Trofeos, logros, objetivos y juego activo | V |

Los módulos futuros se diseñan en detalle **cuando llegue su fase**, no antes.

## Creator Studio: Alpha 0.1 (alcance cerrado)

### Incluye
- Dashboard multired: YouTube, TikTok, Instagram, Facebook y Twitch.
- Perfiles sociales y metas por plataforma (las de un canal no monetizado funcionan como metas hacia la monetización).
- Registro manual de métricas e ingresos. Moneda por defecto: USD; cada ingreso guarda su moneda.
- Banco de ideas.
- Proyectos y **adaptaciones por plataforma**: un proyecto puede generar un vídeo largo, Shorts, un TikTok, un Reel, etc.
- Estados de producción: Idea → Aprobación → Guion → Grabación → Edición → Programación → Publicación → Análisis. **Los pasos son opcionales por adaptación** (un Short puede saltarse el guion).
- Calendario semanal que muestra qué se publica, cuándo y dónde, a partir de las adaptaciones aprobadas.
- Script Studio.
- Seguimiento de publicaciones.
- Persistencia local, exportación e importación (copia de seguridad).

### No incluye
APIs de redes sociales, bots, publicación automática, OBS, Spotify, IA avanzada, procesamiento de vídeo ni infraestructura en la nube.

### Alpha 0.1 está terminada cuando puedo… ✅ (cerrada el 2026-11-04, v0.1.0)
- [x] Registrar mis cinco redes con sus metas e ingresos.
- [x] Guardar y organizar ideas, y convertir una idea aprobada en proyecto.
- [x] Crear adaptaciones, escribir guiones y avanzar cada adaptación por su flujo.
- [x] Ver en el calendario semanal lo que toca publicar.
- [x] Registrar los resultados de lo publicado.
- [x] Cerrar la app y encontrar todo igual al volver.
- [x] Exportar una copia de seguridad e importarla.

## Realidades verificadas de plataformas (para fases futuras)

- Discord ya ofrece integraciones nativas con Twitch y YouTube para asignar roles, además de Linked Roles. Nuestro valor está en los roles compuestos, el historial y la antigüedad propia.
- Twitch: la API de suscripciones solo da el *tier*. La distinción de Prime llega en la notificación de chat del momento (`channel.chat.notification`).
- YouTube: el listado de miembros tiene acceso restringido. Lo fiable son los eventos del chat en directo.
- TikTok: se considera **no viable** para sincronizar roles hasta que exista una API concreta.
- PlayStation: no hay una API pública oficial de trofeos. Xbox y Steam tienen opciones oficiales.
- Una app de escritorio no se puede proteger completamente contra copia. La protección real de un SaaS vive en el servidor.
