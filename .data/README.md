# Datos & API — Dashboard Furthurr

Documentación canónica de datos y contratos consumidos por la aplicación. Léela antes de cambiar consultas, tipos, el schema de Supabase o los límites de autorización.

## Estado de sincronización

- Tecnología detectada: cliente TypeScript `@supabase/supabase-js`, Auth/PostgREST/PostgreSQL/Storage, Edge Function `admin-users` y RPCs de tareas/asignaciones.
- Modo: `full`.
- ¿BD interna?: No. La persistencia es PostgreSQL gestionado externamente por Supabase; el schema de referencia está en `supabase-schema.sql`.
- Commit base revisado: `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04), no representa cambios locales posteriores.
- Última actualización documental: 2026-10-21, sincronización de tableros y del contrato de promoción de cuentas a admin; describe el árbol de trabajo sin fijar un nuevo baseline Git.
- Commit base de implementación y primera sincronización: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`, incluye el código, la migración y la documentación funcional inicial.
- Actualización operativa posterior: la secuencia de migraciones y las pruebas SQL `boards.sql`, `task_assignments.sql` y `user_access.sql` se ejecutaron correctamente en el proyecto Supabase seleccionado el 2026-10-21. El registro documental de ese despliegue y la release `v0.4.0` siguen sin commit; baseline de esta actualización **pendiente**.

## Contexto para IA

- **Qué consume:** SDK para Auth/tablas/Storage, `functions.invoke('admin-users')` para administración (incluida la promoción a admin) y RPCs para crear/trasladar tareas, reemplazar responsables y gestionar miembros. No se encontró OpenAPI; [el catálogo](01-endpoints.md) documenta los contratos observados.
- **Auth:** `AuthProvider` verifica el perfil activo, lo refresca cada 30 s/al recuperar foco y limpia la caché ante cambio de identidad o pérdida de acceso. RLS/grants y verificaciones explícitas en Edge/RPC autorizan las operaciones; `is_active` no es revocación criptográfica de JWT (`src/features/auth/AuthContext.tsx:27-98`).
- **Modelos clave:** `Board`, `Task.board_id`, `board_members`, `AssigneeProfile`, `TaskWithAssignees.assignees` y `ManagedUser` (`src/types/index.ts`, `supabase/migrations/202610210001_boards.sql`).
- **Fuentes de datos:** Supabase Auth, PostgreSQL administrado, Storage y caché de TanStack Query. No se encontró una base de datos local.
- **Convenciones:** TanStack Query, cinco minutos/un reintento por defecto; administración y usuarios asignables usan `staleTime: 0`. Listado administrativo de 50 por página y consulta de cuentas activas en lotes de 500. No hay timeout explícito ni contrato global de error; la Edge Function sí devuelve `{ error: string }`.
- **Integridad y permisos:** cada tarea tiene un `board_id`; admins ven todos los tableros y otras cuentas activas solo los que tienen asignados. Ser responsable de una tarea no concede acceso al tablero. RLS limita tareas, asignaciones, comentarios y metadatos/objetos de Storage. Las acciones sobre tareas existentes requieren acceso a su tablero; crear tarea además requiere rol y membresía. El traslado requiere acceso al origen y destino y no duplica la tarea. Admin gestiona miembros.
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

- `supabase-schema.sql`: bootstrap de referencia; `supabase/migrations/`: cambios incrementales para instalaciones existentes. `supabase/README.md`: orden y operación; no reejecutar el bootstrap sobre una BD existente.
- `src/types/index.ts`: tipos TypeScript usados por la app.
- `src/lib/supabase.ts`: inicialización y nombres de variables necesarias.
- `src/features/auth/`, `src/features/users/`, `src/features/boards/` y `src/features/board/`: operaciones cliente; `supabase/functions/admin-users/`: validación y acciones servidor.
- `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`: intención de producto y matriz prevista; contrastar con el SQL al cambiar el contrato.

## Discrepancias que deben conservarse visibles

- `task_attachments.file_url` conserva una URL generada por `getPublicUrl`, aunque el bucket es privado; la aplicación extrae el path y obtiene URLs firmadas breves para visualización. La discrepancia semántica remanente se registra en [deuda técnica](data-tech-debt.md).
- Las claves foráneas de autor/cargador de comentarios y adjuntos combinan `ON DELETE SET NULL` con columnas `NOT NULL`; ver [deuda técnica](data-tech-debt.md).
- Los responsables ahora usan una proyección explícita `AssigneeProfile`; la relación de autor de comentarios sigue tipada como `Profile` completo. D-03 queda parcialmente resuelta; ver [mapeo](03-mapping.md) y [deuda técnica](data-tech-debt.md).

Estas observaciones registran deuda restante, no certifican el entorno desplegado.

## Evidencia y límites

Se reutiliza evidencia previa de implementación en esta sesión: 79 pruebas Vitest, 9 Deno, build/lint correctos, pruebas SQL con `ROLLBACK` y comprobación HTTP de denegación anónima de RPC. Las migraciones y la Edge Function se registraron como desplegadas antes de esta sincronización.

Para tableros se registraron 111 pruebas Vitest, lint y build correctos. Los tres probes SQL pasaron con Auth/Storage simulados contra bootstrap+migración incremental local y contra el proyecto Supabase seleccionado; sus fixtures se revierten. Chromium con backend simulado cubrió selector, miembros y traslado a 360/768/1440 px. Esto no es E2E completo ni auditoría de seguridad. El build informa que el chunk principal supera 500 kB.

La acción local `promote-admin` se verificó con 115 pruebas Vitest, 11 pruebas Deno de `admin-users`, lint y build correctos. No requiere migración SQL; el despliegue de esta versión de la Edge Function no se comprobó. El baseline Git de esta actualización queda pendiente mientras haya cambios locales sin commit.
