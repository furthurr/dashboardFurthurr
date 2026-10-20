# Datos & API — Dashboard Furthurr

Documentación canónica de datos y contratos consumidos por la aplicación. Léela antes de cambiar consultas, tipos, el schema de Supabase o los límites de autorización.

## Estado de sincronización

- Tecnología detectada: cliente TypeScript `@supabase/supabase-js`, Auth/PostgREST/PostgreSQL/Storage, Edge Function `admin-users` y RPCs de tareas/asignaciones.
- Modo: `full`.
- ¿BD interna?: No. La persistencia es PostgreSQL gestionado externamente por Supabase; el schema de referencia está en `supabase-schema.sql`.
- Commit base revisado: `81335b92bc1962a47c9c3bb963271c3667bc7b63` (2026-05-04), no representa cambios locales posteriores.
- Última actualización documental: 2026-10-20, sincronización focalizada de cuentas y responsables de tareas.
- HEAD observado: `1d3069d904bc9e1dc6a7363d3967ad4c2709dace`, **no** commit de sincronización. Estado: **pendiente de baseline Git**; se describe el árbol local con cambios de producto y archivos `supabase/` sin commit, conservando la referencia histórica anterior.
- Aparecieron cambios concurrentes de perfil/menú durante la revisión. Su contrato de autoedición y verificaciones quedan fuera de este alcance, centrado en administración y asignaciones; no se declara sincronizado todo el producto.

## Contexto para IA

- **Qué consume:** SDK para Auth/tablas/Storage, `functions.invoke('admin-users')` para administración y `rpc` para crear tarea con responsables o reemplazarlos. No se encontró OpenAPI; [el catálogo](01-endpoints.md) documenta los contratos observados.
- **Auth:** `AuthProvider` verifica el perfil activo, lo refresca cada 30 s/al recuperar foco y limpia la caché ante cambio de identidad o pérdida de acceso. RLS/grants y verificaciones explícitas en Edge/RPC autorizan las operaciones; `is_active` no es revocación criptográfica de JWT (`src/features/auth/AuthContext.tsx:27-98`).
- **Modelos clave:** `Profile.is_active`, `AssigneeProfile`, `TaskWithAssignees.assignees`, `ManagedUser` y acciones discriminadas de administración. El nombre editado se guarda en `profiles.full_name`, no sincroniza metadata de Auth (`src/types/index.ts:7-38`, `src/features/users/api.ts:4-9`).
- **Fuentes de datos:** Supabase Auth, PostgreSQL administrado, Storage y caché de TanStack Query. No se encontró una base de datos local.
- **Convenciones:** TanStack Query, cinco minutos/un reintento por defecto; administración y usuarios asignables usan `staleTime: 0`. Listado administrativo de 50 por página y consulta de cuentas activas en lotes de 500. No hay timeout explícito ni contrato global de error; la Edge Function sí devuelve `{ error: string }`.
- **Integridad y permisos:** creación atómica de tarea + responsables para admin/usuario activos; sustitución completa de responsables para cualquier cuenta activa, incluidos invitados. No hay escritura cliente directa a `task_assignees` ni ampliación de permisos sobre otros campos (`supabase/migrations/202610200001_task_assignments.sql:5-76`).
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
- `src/features/auth/`, `src/features/users/` y `src/features/board/`: operaciones cliente; `supabase/functions/admin-users/`: validación y acciones servidor.
- `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`: intención de producto y matriz prevista; contrastar con el SQL al cambiar el contrato.

## Discrepancias que deben conservarse visibles

- El bucket `task-attachments` está declarado privado, mientras el cliente forma una URL pública con `getPublicUrl`; ver [deuda técnica](data-tech-debt.md).
- Las claves foráneas de autor/cargador de comentarios y adjuntos combinan `ON DELETE SET NULL` con columnas `NOT NULL`; ver [deuda técnica](data-tech-debt.md).
- Los responsables ahora usan una proyección explícita `AssigneeProfile`; la relación de autor de comentarios sigue tipada como `Profile` completo. D-03 queda parcialmente resuelta; ver [mapeo](03-mapping.md) y [deuda técnica](data-tech-debt.md).

Estas observaciones son documentales; no se cambió el código ni el schema.

## Evidencia y límites

Se reutiliza evidencia previa de implementación en esta sesión: 79 pruebas Vitest, 9 Deno, build/lint correctos, pruebas SQL con `ROLLBACK` y comprobación HTTP de denegación anónima de RPC. Las migraciones y la Edge Function se registraron como desplegadas antes de esta sincronización. No se volvió a ejecutar SQL, migraciones ni configuración remota durante la operación documental; no es una auditoría de seguridad ni certificación continua del entorno.
