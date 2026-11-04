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

### ⬜ S2 · Modelo de datos (siguiente)
Diseñar y revisar con el usuario el esquema: workspace, plataformas/perfiles, metas, métricas, ingresos, ideas, proyectos, adaptaciones, pasos de producción, guiones y publicaciones.
**Antes, el usuario responde:**
- ¿Qué métricas registra de cada red?
- ¿Qué fuentes de ingresos tiene?
- ¿Cómo imagina Script Studio (texto libre o por secciones con tiempos)?
- ¿Cuántas ideas y proyectos maneja a la vez?

**Terminado cuando:** el esquema está aprobado y documentado en ARCHITECTURE.md.

### ⬜ S3 · SQLite y migraciones
Base de datos local con la primera migración y prueba de guardado y lectura que sobrevive al cierre de la app.

### ⬜ Siguientes (el orden se ajusta tras S2)
- Estructura de la interfaz: navegación, tema y textos centralizados.
- Perfiles sociales y metas.
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
