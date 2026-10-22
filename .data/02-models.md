# Modelos y tipos

Los tipos de aplicación viven en `src/types/index.ts`; el esquema SQL es `supabase-schema.sql`. Los tipos TypeScript se usan como declaraciones estáticas: no se encontró validación runtime de respuesta ni JSON Schema consumido por el cliente. Los casts de queries no validan ni completan campos.

## Enumeraciones

| Tipo | Valores | Fuente |
| --- | --- | --- |
| `UserRole` | `admin`, `usuario`, `invitado` | `src/types/index.ts:1`, `supabase-schema.sql:10` |
| `TaskStatus` | `backlog`, `por_hacer`, `haciendo`, `en_revision`, `finalizadas` | `src/types/index.ts:3`, `supabase-schema.sql:12` |
| `TaskPriority` | `urgente`, `alta`, `normal`, `baja` | `src/types/index.ts:5`, `supabase-schema.sql:14` |

## `Board` y `board_members`

- `Board`: `{ id: string, name: string, created_at: string }`, corresponde a `public.boards`.
- `public.boards.name` es único sin distinguir mayúsculas, y valida nombre recortado de 1–120 caracteres.
- `board_members` es la relación many-to-many entre `boards.id` y `profiles.id`, con PK compuesta `(board_id, profile_id)`; se representa como perfiles `AssigneeProfile[]` en el cliente, no como entidad TS independiente.
- Solo admins activos pueden crear tableros y gestionar membresías. `Offline` y `General` se crean por migración; los miembros activos existentes se asignan a Offline y General empieza vacío.
- Fuente: `src/types/index.ts`, `src/features/boards/api.ts`, `supabase/migrations/202610210001_boards.sql:4-22,63-80`.

## `Profile`

Correspondencia: `public.profiles`; extiende la identidad de `auth.users`.

| Campo | Tipo TS | Nullable en el contrato | Sensible/PII | Notas |
| --- | --- | --- | --- | --- |
| `id` | `string` | No | Identificador | UUID y PK/FK a Auth |
| `full_name` | `string` | No | PII | Nombre completo |
| `email` | `string` | No | PII | Email de usuario |
| `avatar_url` | `string \| null` | Sí | Puede identificar | URL de avatar |
| `nickname` | `string \| null` | Sí | Puede identificar | Alias |
| `role` | `UserRole` | No | Autorización | Por defecto `invitado` en SQL |
| `is_active` | `boolean` | No | Estado de acceso | Default `true`; cambio administrativo, no equivale a borrado ni revocación JWT |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null y asigna `now()` por defecto | No | Metadato |

Fuente: `src/types/index.ts:7-17`, `supabase/migrations/202610190001_user_administration.sql:4-16`. El default de columna de rol es `invitado`; el trigger de alta y la función administrativa asignan `usuario` en el flujo actual.

## `Task` y `TaskWithAssignees`

Correspondencia: `public.tasks`; `TaskWithAssignees` agrega `assignees` y contadores opcionales.

| Campo | Tipo TS | Nullable en el contrato | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID generado por SQL |
| `board_id` | `string` | No | FK obligatoria a `boards.id`; la tarea pertenece a un solo tablero |
| `title` | `string` | No | Requerido |
| `description` | `string \| null` | Sí | Texto opcional |
| `status` | `TaskStatus` | No | Default SQL `backlog` |
| `priority` | `TaskPriority` | No | Default SQL `normal` |
| `special_notes` | `string \| null` | Sí | Notas especiales |
| `created_by` | `string \| null` | Sí | FK a `profiles.id`, `ON DELETE SET NULL` |
| `position` | `number` | No | `numeric` en SQL, default `0` |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null y asigna `now()` por defecto | Timestamps |
| `assignees` | `AssigneeProfile[]` | No (en TS) | Proyección explícita con identidad/estado; relaciones nulas descartadas |
| `comment_count`, `attachment_count` | `number?` | Opcional | Tipos definidos; no vienen en la query `useTasks` observada |

Fuente: `src/types/index.ts:19-45`, `src/features/board/api.ts:5-29`, `supabase/migrations/202610210001_boards.sql:19-22`.

### Proyecciones y solicitudes nuevas

- `AssigneeProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role' | 'is_active'>`. Las seis propiedades se proyectan explícitamente; no tiene `nickname` ni timestamps (`src/types/index.ts:32`).
- `ManagedUser = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'is_active'>`, usado en la lista administrativa (`src/features/users/api.ts:4`).
- `UserAction`/`AdminAction`: uniones discriminadas por `action`: `create`, `rename`, `password`, `set-active`; el contrato servidor añade `list`. Validación runtime **de solicitudes administrativas**, no de todas las respuestas ni modelos (`supabase/functions/admin-users/validation.ts:1-32`).
- Solicitud de creación de tarea: título, descripción opcional, enum de estado/prioridad y `assigneeIds: string[]`; SQL recibe UUIDs, valida destinos y obtiene propietario de la sesión (`src/features/board/api.ts:76-92`).
- `TaskImagePreview`: `{ id: string, fileName: string, signedUrl: string }`, proyección transitoria sin persistir la URL firmada (`src/features/board/attachmentsApi.ts:5-9`).

## Relaciones auxiliares

### `TaskAssignee`

| Campo | Tipo TS | Notas |
| --- | --- | --- |
| `task_id` | `string` | FK a `tasks.id` |
| `profile_id` | `string` | FK a `profiles.id` |
| `created_at` | `string` | Timestamp |

Fuente: `src/types/index.ts:40-44`. La PK compuesta impide duplicados; escrituras cliente se revocan y se gestionan por RPC (`supabase/migrations/202610200001_task_assignments.sql:5-43`).

### `Comment` y `CommentWithAuthor`

| Campo | Tipo TS | Nullable en SQL | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID |
| `task_id` | `string` | No | FK con `ON DELETE CASCADE` |
| `author_id` | `string` | Declarado `NOT NULL` | FK con `ON DELETE SET NULL`; conflicto documentado en D-01 |
| `body` | `string` | No | Contenido de usuario |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null con default | Timestamps |
| `author` (`CommentWithAuthor`) | `Profile` | No (en TS) | Query devuelve solo una proyección parcial; ver D-03 |

Fuente: `src/types/index.ts:46-57`, `src/features/board/commentsApi.ts:5-16`; D-03 sigue abierta para el autor de comentarios.

### `TaskAttachment`

| Campo | Tipo TS | Nullable en SQL | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID |
| `task_id` | `string` | No | FK con `ON DELETE CASCADE` |
| `uploaded_by` | `string` | Declarado `NOT NULL` | FK con `ON DELETE SET NULL`; conflicto documentado en D-01 |
| `file_name` | `string` | No | Nombre original |
| `file_url` | `string` | No | URL almacenada; no se documenta valor real |
| `file_size` | `number` | No | Bytes según uso del cliente |
| `mime_type` | `string` | No | MIME del navegador |
| `created_at` | `string` | TS requerido; SQL permite null con default | Timestamp |

Fuente: `src/types/index.ts:59-68`, `supabase-schema.sql:89-99`.

## Ausencias relevantes

- No se encontró JSON Schema o validación runtime de estos tipos en las rutas de datos consultadas.
- No hay tipos generados desde el schema Supabase en el repositorio; los tipos locales son mantenidos manualmente.
- `tasks_with_assignees` y `tasks_with_stats` existen como vistas SQL, pero la query de tareas leída consulta `tasks` con relación y no usa esas vistas (`supabase-schema.sql:408-435`, `src/features/board/api.ts:5-21`).
