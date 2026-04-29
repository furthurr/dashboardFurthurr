# 11 - Progreso

## 2026-04-28 (sesión inicial)

- Se creó documentación inicial del proyecto.
- Se creó `arquitectura.md`.
- Se creó carpeta `specs/`.
- Se definió SDD como método de trabajo.
- Se documentó stack recomendado compatible con GitHub Pages.
- Se registraron decisiones iniciales.
- Se inicializó repositorio Git.
- Se creó primer commit con documentación.

## 2026-04-28 (sesión actual)

- Se investigó compatibilidad de tecnologías con GitHub Pages.
- Se eligió `design-md/airtable` como referencia visual principal.
- Se creó `supabase-schema.sql` con esquema completo listo para ejecutar en SQL Editor.
- Se actualizaron specs 04 y 05 a estado `aprobada`.
- Se documentaron decisiones de roles y permisos resueltas.
- Se registraron políticas RLS en el schema.
- Se documentó trigger auto-crear perfil en signup.
- Se ejecutó schema SQL en Supabase (base de datos lista).
- Se creó scaffold del proyecto con Vite + React + TypeScript.
- Se instalaron dependencias: Supabase client, dnd-kit, TanStack Query, React Router, React Hook Form, Zod, Tailwind CSS.
- Se configuró Tailwind CSS con `@tailwindcss/vite`.
- Se configuró HashRouter para compatibilidad con GitHub Pages.
- Se configuró Supabase client con variables de entorno.
- Se crearon tipos TypeScript para el proyecto.
- Se creó estructura de carpetas: `features/`, `shared/`, `providers/`, `lib/`.
- Se configuró `vite.config.ts` con `base: '/dashboardFurthurr/'` para GitHub Pages.

## Repo Creado

- URL: https://github.com/furthurr/dashboardFurthurr
- Primer commit: `7791d6e`

## Próximo Paso

1. Actualizar `.env.local` con las credenciales reales de Supabase.
2. Implementar autenticación (login, registro, logout) con Supabase Auth.
3. Implementar el tablero Kanban con columnas, cards y drag & drop.
