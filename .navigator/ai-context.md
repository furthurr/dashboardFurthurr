# Dashboard Furthurr

## Propósito

- **Qué es:** SPA Kanban para gestionar tareas, estados, prioridades, comentarios y adjuntos con autenticación Supabase.
- **Alcance:** cliente web estático servido por GitHub Pages y su integración directa con Supabase. No hay servidor propio en este repo.

## Stack

- Lenguajes y frameworks: TypeScript, React 19, Vite 8, Tailwind CSS v4.
- Datos: Supabase Auth, PostgreSQL y Storage; TanStack Query para caché; dnd-kit para ordenar tareas.
- Build: `npm ci`; `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.
- Entrypoints: `src/main.tsx` → `src/App.tsx`.

## Mapa rápido

- `src/features/auth/` → inicio/registro, contexto de sesión y protección de rutas.
- `src/features/board/` → tablero Kanban, tareas, comentarios y adjuntos.
- `src/lib/supabase.ts` → cliente Supabase y validación de variables requeridas.
- `src/types/index.ts` → tipos compartidos de perfiles y tareas.
- `src/index.css` → estilos globales y variables visuales.
- `supabase-schema.sql` → tablas, policies, buckets, vistas y grants de referencia.
- Detalle y dependencias: [`module-map.json`](module-map.json).

## Convenciones

- Usa `HashRouter`; GitHub Pages no reescribe rutas internas y Vite publica bajo `/dashboardFurthurr/`.
- `specs/` conserva requisitos/intención de producto; actualiza la spec antes de implementar funcionalidad.
- Contrasta cambios de persistencia con `supabase-schema.sql` y la matriz de `specs/05-auth-roles-permisos.md`.
- Verifica comportamiento en el código y contratos: los índices de Navigator son orientación, no fuente de verdad.

## Docs y contexto externo

- `README.md` — onboarding, configuración local, scripts y rutas.
- `AGENTS.md` — instrucciones del proyecto y mapa documental; su sección `Folder Structure` histórica puede diferir del código actual.
- `.architecture/README.md` — arquitectura implementada y ADRs.
- `.data/README.md` — operaciones de Supabase, modelos y schema observado.
- `.design/README.md` — fundamentos visuales y componentes.
- `specs/README.md` — especificaciones SDD y estado de producto.
- `.sdd/` — workflow externo observado en el worktree; no leído ni sincronizado en esta operación.
- `arquitectura.md` — enlace legado a `.architecture/README.md`.
- `.quality/` y `.security/` — no inicializadas en esta sincronización; no implican auditoría de esos dominios.

## Riesgos y restricciones

- La SPA llama a Supabase desde el navegador: no usar `service_role`; los permisos efectivos están en RLS/Storage, no solo en la UI.
- No indexar ni copiar `.env`, `.env.*`, credenciales o datos personales. Variables permitidas por nombre: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; no registrar sus valores.
- El working tree contiene cambios locales de producto/documentación; no se asigna `source_commit` hasta que exista un baseline Git verificable.

## Meta

- Actualizado: 2026-10-16
- Source commit: omitido; working tree con cambios locales no incluidos en `HEAD`.
- Navigator root: `.`
- Generado por: project-navigator bootstrap
