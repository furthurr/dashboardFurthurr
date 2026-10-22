# ADR 0001: SPA estática con Supabase

- Estado: Aceptada (decisión observada en la implementación)
- Fecha: 2026-10-16 (registro documental; no representa necesariamente la fecha original de adopción)

## Contexto

El producto se publica como SPA estática en GitHub Pages y las instrucciones del proyecto indican que no hay servidor propio (`AGENTS.md:18-22`). La aplicación necesita autenticación y persistencia de tareas, comentarios y archivos; la configuración actual compila el frontend como SPA y usa Supabase desde el navegador (`src/lib/supabase.ts:1-10`, `.github/workflows/deploy.yml:30-42`).

## Decisión

Mantener una SPA React/Vite estática en GitHub Pages y usar Supabase como servicio gestionado para Auth, PostgreSQL y Storage. El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; las políticas RLS en Supabase son la frontera de autorización de datos.

### Extensión observada — 2026-10-20

La SPA permanece estática, pero el repositorio ahora incluye código backend desplegable en Supabase: `admin-users` para operaciones administrativas y funciones Postgres para creación/asignación transaccional de tareas. «Sin servidor propio» no debe interpretarse como «sin código servidor». La autorización combina RLS/grants con comprobaciones explícitas en estas funciones; nunca se coloca la clave privilegiada en el navegador (`supabase/functions/admin-users/index.ts:20-28`, `supabase/migrations/202610200001_task_assignments.sql:7-76`). Esa implementación ya está versionada (baseline `v0.6.0` / `21a44df`); la nota no fija una fecha de adopción histórica.

## Alternativas consideradas

- Servidor propio o SSR: no adoptado; requeriría infraestructura de servidor que no forma parte del despliegue estático configurado.

## Consecuencias

- Positivas: despliegue estático compatible con GitHub Pages y backend gestionado sin mantener un servidor propio.
- Negativas / trade-offs: las operaciones cliente dependen de Supabase y la corrección de permisos requiere políticas RLS; las variables de entorno deben estar disponibles durante el build.
- Las migraciones, la función Edge y la configuración de Auth requieren despliegue separado de GitHub Pages; ver [`supabase/README.md`](../../supabase/README.md). No se requiere un servidor independiente ni se adopta SSR.

## Evidencia

- `src/lib/supabase.ts:1-10`
- `supabase-schema.sql:10-168`
- `.github/workflows/deploy.yml:17-53`
- `vite.config.ts:6-13`
