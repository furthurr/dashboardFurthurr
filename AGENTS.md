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

- [`README.md`](README.md) es la entrada humana para configuración, ejecución y rutas.
- [`specs/`](specs/README.md) conserva la intención/requisitos del producto; las specs de requisitos, datos, permisos, UI/UX y progreso se actualizaron para adjuntos, tableros y avatares.
- `.sdd/` y `.release/` pertenecen a workflows externos; `supabase/README.md` es la guía operativa de migraciones, pruebas SQL y despliegue.
- [`supabase-schema.sql`](supabase-schema.sql) es el bootstrap Postgres local para instalaciones nuevas. Contrástalo con specs y código.
- [`supabase/migrations/`](supabase/migrations/) contiene cambios incrementales; en una BD existente aplica solo migraciones pendientes, en orden, y no reejecutes el bootstrap.
- [`supabase/functions/admin-users/`](supabase/functions/admin-users/) contiene backend administrativo gestionado por Supabase; las RPCs Postgres autenticadas complementan esa capa. Pages no despliega funciones ni migraciones; nunca llevar claves privilegiadas al frontend.
- [`.architecture/`](.architecture/README.md) documenta arquitectura y ADRs; [`.data/`](.data/README.md), contratos/modelos/persistencia; [`.design/`](.design/README.md), fundamentos/componentes visuales.
- [`.navigator/`](.navigator/ai-context.md) y [`module-map.json`](.navigator/module-map.json) son índices auxiliares; confirma decisiones en fuentes de código y contratos.
- `src/features/boards/` gestiona selección, miembros, ciclo de vida y eliminación de tableros; `src/features/board/` presenta el Kanban, tareas, comentarios y adjuntos. La evidencia de aplicación remota de `202610220001`/`202610220002` y publicación `v0.6.0` es histórica (2026-10-22), no verifica cambios posteriores.
- El árbol local documentado incluye renombrar/eliminar adjuntos, eliminar tableros solo desactivados y avatares de perfil. Detalles visuales/contratos observados en [datos](.data/README.md) y [diseño](.design/components.md); no se afirma publicación.
- `src/features/board/TaskCard.tsx` muestra junto a los avatares un botón de comentarios accesible que abre el detalle en esa pestaña; el badge numérico aparece solo con comentarios. `fetchTasks` obtiene el conteo de la vista existente `tasks_with_stats`; crear o eliminar comentarios invalida la caché. No se requiere una migración; detalles en [datos](.data/README.md) y [componentes visuales](.design/components.md).
- El visor de imágenes de `src/features/board/TaskCard.tsx` muestra el título de la tarea, el nombre del archivo como subtítulo y la descripción; si hay varias imágenes, permite navegar solo las adjuntas a esa tarea. Usa `Dialog` y botones accesibles; las flechas se deshabilitan en los extremos. No añade datos ni migraciones. El comportamiento implementado está en [componentes visuales](.design/components.md); la ampliación correspondiente de `specs/06-ui-ux-diseno.md` queda pendiente por el límite efectivo de escritura del host.
- En «Adjuntos», uploader, creador de tarea o admin activo con acceso al tablero puede cambiar `task_attachments.file_name` o eliminar objeto y metadata tras confirmación. El renombrado no cambia el path de Storage (`supabase/migrations/202610260001_task_attachment_management.sql`).
- Los avatares de perfil se muestran con `ProfileAvatar` en cuenta, administración, tarjetas, comentarios y responsables. La carga acepta JPG/PNG/WebP hasta 2 MiB; el bucket es público y la migración local limita escritura al propietario/admin activo (`supabase/migrations/202610260003_profile_avatars.sql`).
- El acceso a tableros se basa en membresías, no en asignaciones de tareas. Admin activo ve todos; un tablero desactivado solo lo ve ese admin y sus miembros pierden el acceso, también por URL directa. La visibilidad la determinan la RPC `list_boards_with_pending_counts` y RLS. La SPA desplegada no aplica migraciones automáticamente.
- Registro histórico (2026-10-22): `admin-users` se verificó en versión 4 ACTIVE y `promote-admin` se confirmó manualmente en producción. No se consultó el remoto durante esta actualización; ese resultado no acredita el despliegue de cambios locales actuales.
- [`arquitectura.md`](arquitectura.md) es un acceso legado a la arquitectura canónica, no una segunda fuente.

Para la estructura de ejecución actual consulta el mapa de módulos y el código; el árbol de carpetas descrito en la sección `Folder Structure` de este archivo puede ser anterior a la implementación vigente.

El árbol local documentado contiene cambios sin commit de UI/API, schema y las migraciones `202610260001_task_attachment_management.sql`, `202610260002_delete_inactive_boards.sql` y `202610260003_profile_avatars.sql`. No se confirmó su aplicación remota ni se ejecutaron las suites SQL. `HEAD` es `bbacf5c62a8ab0bf144e602ae3666c4026882f0e`; no se consultaron `main`/`origin/main`. La documentación del proyecto registra `v0.8.1` (run `40004615822`) como última publicación conocida; no se verificó si incluye los cambios actuales. La actualización documental global se completó el 2026-10-27; quedan fuera `.sdd/` y `.release/` por pertenecer a workflows externos.
<!-- ai-agents-kit:documentation:end -->
