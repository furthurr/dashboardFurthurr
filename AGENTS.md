# AGENTS.md — Dashboard Furthurr

## Build Commands

```bash
npm run dev      # dev server en http://localhost:5173/dashboardFurthurr/
npm run build    # tsc -b && vite build → genera /dist
npm run lint     # eslint .
npm run preview  # preview del build
```

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
