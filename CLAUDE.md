# CLAUDE.md — Reglas del proyecto

Proyecto de TrefotG. Nombre de trabajo: **TrophyHunter** (la marca definitiva está pendiente).
Lee esto al inicio de cada sesión. Para el contexto, consulta:

- [PRODUCT.md](PRODUCT.md): qué construimos y qué no.
- [ARCHITECTURE.md](ARCHITECTURE.md): cómo está construido y por qué (registro de decisiones).
- [ROADMAP.md](ROADMAP.md): fases y tareas de la etapa actual.
- [CHANGELOG.md](CHANGELOG.md): qué cambió y cuándo.

## Forma de trabajo

1. Al empezar, revisa el estado: `git status`, la tarea activa en ROADMAP.md y la última entrada de CHANGELOG.md.
2. **Una tarea principal por sesión.** Debe terminar probada por el usuario en la app real.
3. Una función no está terminada solo porque su interfaz se vea bien. Tiene que guardar, recargar y sobrevivir al cierre de la app.
4. Al terminar: marca la tarea en ROADMAP.md, añade la entrada en CHANGELOG.md y haz un commit.
5. El usuario aprende mirando: explica en español qué haces y por qué, sin jerga innecesaria.

## Reglas

- **No ampliar el alcance de Alpha 0.1** (ver PRODUCT.md). Las ideas nuevas van a la sección "Ideas aparcadas" de ROADMAP.md y no se implementan.
- No instalar dependencias por comodidad. Cada dependencia nueva se justifica en ARCHITECTURE.md.
- No inventar capacidades de APIs externas. Si algo no está verificado, se marca como "por investigar".
- No sobrescribir documentación sin leerla antes. No duplicar información entre documentos: cada tema vive en un solo archivo.
- Ningún dato se guarda dos veces. El dashboard y el calendario **leen** de proyectos y adaptaciones; no tienen copias propias.
- Nombre interno neutro: el código usa `studio`. "TrophyHunter" aparece solo en textos visibles (título, interfaz).
- Interfaz en español, con los textos centralizados para poder traducirla más adelante.

## Comandos

```bash
npm install          # dependencias del frontend
npm run tauri dev    # abrir la app en modo desarrollo
npm run build        # comprobar tipos y compilar el frontend
```

Requisitos en Windows: Node.js LTS, Rust (rustup, toolchain MSVC estable), Visual Studio Build Tools con "Desarrollo para el escritorio con C++" y WebView2 (incluido en Windows 11).

## Estructura

- `src/`: interfaz (React + TypeScript).
  - `src/db/`: la **única** capa que lee y escribe en la base de datos.
  - `src/features/<sección>/`: cada sección con sus páginas y formularios (por ejemplo, `profiles/`).
  - `src/components/`: piezas compartidas (menú lateral, "Próximamente").
  - `src/sections.ts`: secciones del menú y cuáles están construidas. La navegación es estado de React, sin librería de rutas.
  - `src/i18n/es.ts`: todos los textos visibles.
- `src-tauri/`: aplicación de escritorio (Rust, Tauri 2).
  - `src-tauri/migrations/`: migraciones SQL numeradas. **Nunca se edita una ya aplicada**; los cambios van en una nueva, registrada en `src-tauri/src/lib.rs`.
- Datos del usuario: `%APPDATA%\com.trefotg.studio\studio.db`. Nunca se borra ni se sobrescribe sin una copia de seguridad. **Antes de cualquier migración nueva, sigue D-007 en ARCHITECTURE.md** (copia con la API de backup y prueba sobre una copia).
- `Abrir TrophyHunter.bat`: abre la app con doble clic.
