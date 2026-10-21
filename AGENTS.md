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
- [`supabase-schema.sql`](supabase-schema.sql) es la fuente de verdad local del schema Postgres. Contrástalo con `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`.
- [`supabase/migrations/`](supabase/migrations/) contiene cambios incrementales para instalaciones existentes; [`supabase/README.md`](supabase/README.md) describe orden, despliegue de Edge Functions, configuración de Auth y pruebas SQL. El bootstrap completo no debe reejecutarse sobre una BD existente.
- [`supabase/functions/admin-users/`](supabase/functions/admin-users/) contiene backend administrativo gestionado por Supabase; las asignaciones usan RPCs Postgres autenticadas. «Sin servidor propio» no significa ausencia de código servidor. Publicar la SPA en Pages no despliega esas funciones ni las migraciones; las claves privilegiadas nunca van al frontend.
- [`.architecture/`](.architecture/README.md) documenta la arquitectura implementada y sus ADRs.
- [`.data/`](.data/README.md) cataloga contratos, modelos y persistencia observados; no sustituye la spec ni el SQL.
- [`.design/`](.design/README.md) inventaría tokens y componentes visuales; `specs/06-ui-ux-diseno.md` conserva la intención UX.
- [`.navigator/`](.navigator/ai-context.md) y [`module-map.json`](.navigator/module-map.json) son índices auxiliares de orientación; verifica siempre decisiones en código y contratos.
- [`arquitectura.md`](arquitectura.md) es un acceso legado a la arquitectura canónica, no una segunda fuente.

Para la estructura de ejecución actual consulta el mapa de módulos y el código; el árbol de carpetas descrito en la sección `Folder Structure` de este archivo puede ser anterior a la implementación vigente.

Las marcas de documentación deben distinguir el árbol de trabajo sin commit de un baseline Git verificable; no declarar sincronizado `HEAD` cuando hay cambios locales relevantes. `.sdd/` y `.release/` permanecen fuera del mantenimiento de este orquestador.
<!-- ai-agents-kit:documentation:end -->
