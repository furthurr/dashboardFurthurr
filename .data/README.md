# Datos & API — Dashboard Furthurr

Documentación canónica de datos y contratos consumidos por la aplicación. Léela antes de cambiar consultas, tipos, el schema de Supabase o los límites de autorización.

## Estado de sincronización

- Tecnología detectada: cliente TypeScript `@supabase/supabase-js` con Supabase Auth, PostgREST, PostgreSQL y Storage.
- Modo: `full`.
- ¿BD interna?: No. La persistencia es PostgreSQL gestionado externamente por Supabase; el schema de referencia está en `supabase-schema.sql`.
- Commit base revisado: `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04), no representa cambios locales posteriores.
- Última actualización documental: 2026-10-16.
- Estado: **pendiente de baseline Git**. Se observaron modificaciones locales en `AGENTS.md`, `specs/06-ui-ux-diseno.md` y `src/features/board/TaskDetailModal.tsx`; la documentación refleja evidencia del árbol de trabajo y aún no está integrada en `HEAD`.

## Contexto para IA

- **Qué consume:** la SPA usa el SDK de Supabase para autenticación, consultas y mutaciones de tablas Postgres y operaciones de Storage. No hay OpenAPI ni una capa HTTP propia en el repositorio; el catálogo describe operaciones lógicas observadas en el cliente.
- **Auth:** `AuthProvider` recupera la sesión del SDK, escucha cambios y consulta el perfil. La autorización efectiva de tablas y objetos se aplica en las políticas declaradas por `supabase-schema.sql`; no inferir el formato de almacenamiento del token desde este repo.
- **Modelos clave:** `Profile`, `Task`, `TaskAssignee`, `Comment`, `TaskAttachment` y las variantes con relaciones están en `src/types/index.ts`.
- **Fuentes de datos:** Supabase Auth, PostgreSQL administrado, Storage y caché de TanStack Query. No se encontró una base de datos local.
- **Convenciones:** queries/mutaciones de TanStack Query; `staleTime` de cinco minutos y un reintento por defecto de query. Los errores del SDK se lanzan y, en general, no se convierten a un DTO común. No se observó paginación ni timeout explícitos.
- **Campos sensibles/PII:** perfiles incluyen email, nombre y avatar; tareas, comentarios y adjuntos contienen contenido aportado por usuarios e identificadores. No se documentan valores reales.
- **Límite de esta documentación:** registra el contrato observado, no certifica la configuración desplegada de Supabase ni sustituye una auditoría de seguridad.

## Índice

- [Catálogo de operaciones](01-endpoints.md)
- [Modelos y tipos](02-models.md)
- [Mapeo entre Supabase y la aplicación](03-mapping.md)
- [Schema relacional y Storage](04-schema.md)
- [Convenciones de acceso y errores](05-conventions.md)
- [Datos sensibles y PII](06-sensitive-data.md)
- [Variables y entornos](07-environments.md)
- [Deuda técnica de datos/APIs](data-tech-debt.md)

## Fuentes de verdad

- `supabase-schema.sql`: enums, tablas, relaciones, triggers, RLS, buckets, vistas y grants.
- `src/types/index.ts`: tipos TypeScript usados por la app.
- `src/lib/supabase.ts`: inicialización y nombres de variables necesarias.
- `src/features/auth/` y `src/features/board/`: operaciones realmente consumidas.
- `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`: intención de producto y matriz prevista; contrastar con el SQL al cambiar el contrato.

## Discrepancias que deben conservarse visibles

- El bucket `task-attachments` está declarado privado, mientras el cliente forma una URL pública con `getPublicUrl`; ver [deuda técnica](data-tech-debt.md).
- Las claves foráneas de autor/cargador de comentarios y adjuntos combinan `ON DELETE SET NULL` con columnas `NOT NULL`; ver [deuda técnica](data-tech-debt.md).
- Algunos tipos de relación se declaran como modelos completos pese a que las queries solo seleccionan una proyección parcial; ver [mapeo](03-mapping.md) y [deuda técnica](data-tech-debt.md).

Estas observaciones son documentales; no se cambió el código ni el schema.
