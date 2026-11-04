# ROADMAP.md — Ruta y tareas

Ritmo: 2–3 noches por semana, una tarea cerrada y probada por sesión.

## Fases

| Fase | Contenido | Estado |
|---|---|---|
| I | Preparación + **Creator Studio Alpha 0.1** | 🟢 En curso |
| II | Core e integraciones · Community Hub · Community Identity Sync | ⚪ |
| III | Live Studio · Automation Builder · Music Requests | ⚪ |
| IV | Video Studio · Growth Intelligence | ⚪ |
| V | Gaming Intelligence | ⚪ |

## Fase I: tareas

### ✅ S1 · Cimientos
- [x] Instalar Node.js, Rust y Visual Studio Build Tools.
- [x] Crear la app vacía de Tauri + React + TypeScript con el nombre interno `studio`.
- [x] Comprobar que la app abre en Windows.
- [x] Escribir los documentos base.
- [x] Iniciar Git y hacer el primer commit.
- [ ] Repositorio privado en GitHub (lo crea el usuario y lo conectamos).

### ✅ S2 · Modelo de datos
- [x] Respuestas del usuario: todas las métricas (seguidores, vistas por publicación, horas, directos); todos los tipos de ingreso; Script Studio por secciones; volumen bajo.
- [x] Esquema de 11 tablas aprobado y documentado en ARCHITECTURE.md (D-005).

### ✅ S3 · SQLite y migraciones
- [x] Plugin oficial de SQLite y migración 001 con las 11 tablas.
- [x] Capa de datos (`src/db/`) y textos centralizados (`src/i18n/es.ts`).
- [x] Prueba del usuario: 5 perfiles creados, app cerrada y reabierta, los perfiles siguen ahí. Duplicados rechazados e integridad de relaciones activa.
- [x] Acceso directo `Abrir TrophyHunter.bat`.

### ⬜ S4 · Estructura de la interfaz (siguiente)
Sustituir la pantalla temporal de prueba por la estructura real: navegación lateral (Dashboard, Perfiles, Ideas, Proyectos, Calendario, Ingresos), tema visual y la pantalla de Perfiles conectada a la base de datos.
**Terminado cuando:** se puede navegar entre secciones y gestionar los perfiles (crear, editar, marcar como monetizado y eliminar) desde su pantalla definitiva.

### ⬜ Siguientes (el orden se ajusta tras S2)
- Metas por perfil.
- Métricas e ingresos manuales.
- Banco de ideas → aprobación → proyecto.
- Proyectos y adaptaciones con su flujo (pasos opcionales).
- Script Studio.
- Calendario semanal.
- Seguimiento de publicaciones y resultados.
- Dashboard multired.
- Exportación e importación.
- Cierre de Alpha 0.1: revisión completa con los criterios de PRODUCT.md.

## Ideas aparcadas
Las ideas nuevas se anotan aquí y no interrumpen la fase actual.
- Revisar el código de Firebot (open source) como referencia para Live Studio.
- Elegir la marca definitiva (verificando marca registrada y dominio).
