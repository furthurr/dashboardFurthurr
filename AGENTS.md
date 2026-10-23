# AGENTS.md — Dashboard Furthurr

## Build Commands

```bash
npm run dev      # dev server en http://localhost:5173/dashboardFurthurr/
npm run build    # tsc -b && vite build → genera /dist
npm run lint     # eslint .
npm run preview  # preview del build
```

## Verify Before Commit

Después de `npm run build`, CI hace `npm ci` (no `npm install`). Siempre genera el build走后 antes de commitear para detectar errores de TypeScript.

## Architecture

- **SPA estática** desplegada en GitHub Pages
- **HashRouter** (react-router-dom) — rutas con `#` prefix, NO usa History API
- **base**: `/dashboardFurthurr/` en `vite.config.ts`
- **Backend**: Supabase (Auth + PostgreSQL + Storage) — NO hay servidor propio
- **Supabase env vars**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (NO usar `VITE_SUPABASE_KEY`)

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS v4 (`@tailwindcss/vite`)
- dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
- TanStack Query
- React Hook Form + Zod
- Supabase JS client

## SDD Workflow (FUENTE DE VERDAD)

`specs/` es la carpeta de especificaciones. Antes de programar cualquier funcionalidad, se actualiza o crea una spec correspondiente. El progreso se mide contra specs, no contra ideas sueltas.

Specs clave:
- `specs/04-modelo-datos.md` → esquema de Supabase
- `specs/05-auth-roles-permisos.md` → matriz de permisos
- `specs/07-kanban-drag-drop.md` → comportamiento Kanban

## GitHub Pages Routing Gotcha

SIEMPRE usar `HashRouter`. GitHub Pages no reescribe rutas al `index.html` para SPA. Usar `<Route path="/" element={<Navigate to="/board" />} />` con `HashRouter` para redirect limpio.

## Folder Structure

```
src/
  lib/supabase.ts       ← cliente Supabase (inicializado con env vars)
  types/index.ts        ← tipos TypeScript compartidos
  App.tsx               ← providers (QueryClient) + routing
  features/
    auth/               ← login, registro
    board/              ← Kanban board
    tasks/              ← detalle de tarea
    comments/           ← comentarios
  shared/ui/            ← componentes reutilizables
  providers/            ← context providers futuros
```

## Environment Setup

1. Copiar `.env.example` a `.env.local`
2. Completar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
3. `.env.local` está en `.gitignore` (nunca hacer commit)

## Supabase Schema

El schema completo está en `supabase-schema.sql` (ejecutado en SQL Editor de Supabase). NO recrear tablas manualmente — editar el SQL y re-ejecutar si hay cambios.

<!-- ai-agents-kit:documentation:start -->
## Mapa de documentación del proyecto

- [`README.md`](README.md) es la entrada humana: configuración, ejecución, rutas y enlaces.
- [`specs/`](specs/README.md) es la fuente de verdad de requisitos e intención de producto; actualiza la spec correspondiente antes de implementar una funcionalidad.
- `.sdd/` y `.release/` pertenecen a workflows externos a este orquestador; `specs/` conserva la fuente de requisitos del producto y `supabase/README.md` la guía operativa de publicación.
- [`supabase-schema.sql`](supabase-schema.sql) es la fuente de verdad local del schema Postgres para instalaciones nuevas. Contrástalo con `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`.
- [`supabase/migrations/`](supabase/migrations/) contiene cambios incrementales para instalaciones existentes; [`supabase/README.md`](supabase/README.md) describe orden, despliegue de Edge Functions, configuración de Auth y pruebas SQL. En una BD existente aplica únicamente las migraciones pendientes en orden; no reejecutes el bootstrap completo.
- [`supabase/functions/admin-users/`](supabase/functions/admin-users/) contiene backend administrativo gestionado por Supabase; las asignaciones usan RPCs Postgres autenticadas. «Sin servidor propio» no significa ausencia de código servidor. Publicar la SPA en Pages no despliega esas funciones ni las migraciones; las claves privilegiadas nunca van al frontend.
- [`.architecture/`](.architecture/README.md) documenta la arquitectura implementada y sus ADRs.
- [`.data/`](.data/README.md) cataloga contratos, modelos y persistencia observados; no sustituye la spec ni el SQL.
- [`.design/`](.design/README.md) inventaría tokens y componentes visuales; `specs/06-ui-ux-diseno.md` conserva la intención UX.
- [`.navigator/`](.navigator/ai-context.md) y [`module-map.json`](.navigator/module-map.json) son índices auxiliares de orientación; verifica siempre decisiones en código y contratos.
- `src/features/boards/` gestiona selector, creación, miembros, renombrado, activar/desactivar y el resumen de tareas pendientes; `src/features/board/` presenta el Kanban del tablero elegido. Las migraciones `supabase/migrations/202610220001_board_access_returning.sql` y `supabase/migrations/202610220002_board_lifecycle.sql` se aplicaron el 2026-10-22 en el proyecto Supabase remoto, en ese orden, y las tres suites SQL remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) pasaron revirtiendo sus fixtures con `ROLLBACK`: el contrato remoto ya es compatible con esa UI. La SPA compatible **ya se publicó en GitHub Pages con `v0.6.0` el 2026-10-22** (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`) y está servida en <https://furthurr.github.io/dashboardFurthurr/>. En una instalación existente que no las tenga, aplícalas en orden antes de publicar la SPA compatible.
- `src/features/board/BoardPage.tsx` conserva «+ Nueva Tarea» y añade un botón flotante «Crear tarea» para cuentas no invitadas. El alta permite pegar imágenes en la selección y las sube al crear la tarea; en la pestaña «Adjuntos» del detalle se inicia la subida al pegar. Ambos flujos mantienen el máximo de 5 MB; el comportamiento visual está en `.design/components.md`. La ampliación de `specs/06-ui-ux-diseno.md` quedó pendiente por el límite efectivo del host.
- `src/features/board/TaskCard.tsx` muestra junto a los avatares un botón de comentarios accesible que abre el detalle en esa pestaña; el badge numérico aparece solo con comentarios. `fetchTasks` obtiene el conteo de la vista existente `tasks_with_stats`; crear o eliminar comentarios invalida la caché. No se requiere una migración; detalles en [datos](.data/README.md) y [componentes visuales](.design/components.md).
- El visor de imágenes de `src/features/board/TaskCard.tsx` muestra el título de la tarea, el nombre del archivo como subtítulo y la descripción; si hay varias imágenes, permite navegar solo las adjuntas a esa tarea. Usa `Dialog` y botones accesibles; las flechas se deshabilitan en los extremos. No añade datos ni migraciones. El comportamiento implementado está en [componentes visuales](.design/components.md); la ampliación correspondiente de `specs/06-ui-ux-diseno.md` queda pendiente por el límite efectivo de escritura del host.
- El acceso a tableros se basa en membresías, no en asignaciones de tareas. Admin activo ve todos; un tablero desactivado solo lo ve ese admin y sus miembros pierden el acceso, también por URL directa. La visibilidad la determinan la RPC `list_boards_with_pending_counts` y RLS. La SPA desplegada no aplica migraciones automáticamente.
- El despliegue remoto queda **alineado** (verificado el 2026-10-22): la Edge Function `admin-users` se redesplegó con `supabase functions deploy admin-users` y quedó en **versión 4, ACTIVE**, con el código descargado del remoto **idéntico byte a byte** al del repo —el anterior, versión 3, **no contenía** la acción `promote-admin`, por lo que el botón «Hacer administrador» de «Usuarios» habría fallado en producción—. `supabase config diff` informa **0 cambios que aplicar** (`update: 0`): `auth.enable_signup` ya está deshabilitado en remoto y `functions list` confirma `verify_jwt: false` para `admin-users`. **Ya no queda pendiente** el redeploy de `admin-users` ni la aplicación de la configuración de Auth. La **verificación funcional** en producción se completó el 2026-10-22 con una sesión real de administrador: la persona responsable del proyecto confirmó que **promover una cuenta a administrador desde «Usuarios» funciona correctamente** (botón «Hacer administrador»). Siguen vigentes los límites: **no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad**, y esa comprobación fue **manual**, no automatizada.
- [`arquitectura.md`](arquitectura.md) es un acceso legado a la arquitectura canónica, no una segunda fuente.

Para la estructura de ejecución actual consulta el mapa de módulos y el código; el árbol de carpetas descrito en la sección `Folder Structure` de este archivo puede ser anterior a la implementación vigente.

Las marcas de documentación deben distinguir el árbol de trabajo sin commit de un baseline Git verificable; no declarar sincronizado `HEAD` cuando hay cambios locales relevantes. `HEAD`, `main` y `origin/main` están en `9444ced` (`chore(release): preparar versión v0.8.1`); la última publicación verificada de la SPA es `v0.8.1` (workflow «Deploy to GitHub Pages», run `40004615822`). El árbol de trabajo contiene cambios locales de UI sin commit (el botón de comentarios abre directamente esa pestaña y se oculta el badge numérico con cero; el visor de imágenes muestra título, subtítulo, descripción y navegación por tarea) y documentación local sin commit en `.design/` y este bloque. La ampliación de `specs/06-ui-ux-diseno.md` sigue pendiente por el límite efectivo de escritura del host; no hay migraciones sin trackear. `.sdd/` y `.release/` permanecen fuera del mantenimiento de este orquestador.
<!-- ai-agents-kit:documentation:end -->
