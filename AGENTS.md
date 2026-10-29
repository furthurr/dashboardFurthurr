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

- [`README.md`](README.md) es la entrada humana para configuración, ejecución y rutas; el enlace al selector `mcp/README.md` quedó pendiente por límite efectivo de escritura del host.
- [`mcp/README.md`](mcp/README.md) permite seleccionar e instalar `dashboardFurthurr` por cliente; los presets project-scoped están en `opencode.json`, `.kiro/`, `.vscode/mcp.json`, `.mcp.json`, `.agents/` y `.pi/`. Claude Desktop requiere añadir el conector remoto en su UI.
- [`specs/`](specs/README.md) conserva la intención/requisitos del producto. Las specs MCP de requisitos, datos, permisos y UI no pudieron sincronizarse en esta operación por el límite efectivo de escritura del host.
- `.sdd/` y `.release/` pertenecen a workflows externos; `supabase/README.md` es la guía operativa de migraciones, pruebas SQL y despliegue.
- [`supabase-schema.sql`](supabase-schema.sql) es el bootstrap Postgres local para instalaciones nuevas. Contrástalo con specs y código.
- [`supabase/migrations/`](supabase/migrations/) contiene cambios incrementales; en una BD existente aplica solo migraciones pendientes, en orden, y no reejecutes el bootstrap.
- [`supabase/functions/admin-users/`](supabase/functions/admin-users/) verifica operaciones administrativas; [`supabase/functions/mcp/`](supabase/functions/mcp/) es el resource server remoto identity-only. Pages no despliega funciones ni migraciones; nunca llevar claves privilegiadas al frontend.
- [`.architecture/`](.architecture/README.md) documenta arquitectura y ADRs; [`.data/`](.data/README.md), contratos/modelos/PII; [`.design/`](.design/README.md), fundamentos y componentes, incluidos consentimiento y revocación OAuth.
- [`.navigator/`](.navigator/ai-context.md) y [`module-map.json`](.navigator/module-map.json) son índices auxiliares; confirma decisiones en fuentes de código y contratos.
- `src/features/boards/` gestiona selección, membresías y ciclo de vida; `src/features/board/` presenta el Kanban. La nueva herramienta MCP sólo revela `whoami`; no amplía esos permisos.
- Las reglas observadas de adjuntos, avatares, MCP y acceso a tableros se describen en `.data/` y `.design/`; contrasta la evidencia remota fechada en `.data/04-schema.md`. `supabase/README.md` conserva información operativa pendiente de sincronizar.
- `src/features/board/TaskCard.tsx` muestra junto a los avatares un botón de comentarios accesible que abre el detalle en esa pestaña; el badge numérico aparece solo con comentarios. `fetchTasks` obtiene el conteo de la vista existente `tasks_with_stats`; crear o eliminar comentarios invalida la caché. No se requiere una migración; detalles en [datos](.data/README.md) y [componentes visuales](.design/components.md).
- El visor de imágenes de `src/features/board/TaskCard.tsx` muestra el título de la tarea, el nombre del archivo como subtítulo y la descripción; si hay varias imágenes, permite navegar solo las adjuntas a esa tarea. Usa `Dialog` y botones accesibles; las flechas se deshabilitan en los extremos. No añade datos ni migraciones. El comportamiento implementado está en [componentes visuales](.design/components.md); la ampliación correspondiente de `specs/06-ui-ux-diseno.md` queda pendiente por el límite efectivo de escritura del host.
- En «Adjuntos», uploader, creador de tarea o admin activo con acceso al tablero puede cambiar `task_attachments.file_name` o eliminar objeto y metadata tras confirmación. El renombrado no cambia el path de Storage (`supabase/migrations/202610260001_task_attachment_management.sql`).
- Los avatares de perfil se muestran con `ProfileAvatar` en cuenta, administración, tarjetas, comentarios y responsables. La carga acepta JPG/PNG/WebP hasta 2 MiB; el bucket es público y la migración local limita escritura al propietario/admin activo (`supabase/migrations/202610260003_profile_avatars.sql`).
- El acceso a tableros se basa en membresía y RLS; la SPA desplegada no aplica migraciones automáticamente.
- MCP de fase 1 usa Supabase OAuth 2.1 + PKCE/DCR y rol SQL aislado `mcp_identity`; sólo expone `whoami`. Las configuraciones no incluyen tokens y el consentimiento es por cliente/usuario. OAuth Server está en beta.
- Estado remoto (2026-10-28): `mcp` v2 y `admin-users` v6 ACTIVE; `202610280002` aplicada; Pages run `40796012117` publicó `267cc91`. El ledger diverge de los objetos observados; contrastar `.data/04-schema.md` y pedir reconciliación operativa antes de aplicar SQL. `supabase/README.md` sigue pendiente de sincronización.
- [`arquitectura.md`](arquitectura.md) es un acceso legado a la arquitectura canónica, no una segunda fuente.

Para la estructura de ejecución actual consulta el mapa de módulos y el código; el árbol de carpetas descrito en la sección `Folder Structure` de este archivo puede ser anterior a la implementación vigente.

`HEAD` consultado: `267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e`; el árbol local conserva cambios sin commit ajenos en `src/features/boards/`, `.sdd/specs/mcp-integracion-ia/` y `pnpm-lock.yaml`. Esta guía resume el MCP desplegado, no atribuye esos cambios locales a `HEAD` ni sincroniza `.sdd/`/`.release/`.
<!-- ai-agents-kit:documentation:end -->
