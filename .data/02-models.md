# Modelos y tipos

Los tipos de aplicación viven en `src/types/index.ts`; el esquema SQL es `supabase-schema.sql`. Los tipos TypeScript se usan como declaraciones estáticas: no se encontró validación runtime de respuesta ni JSON Schema consumido por el cliente. Los casts de queries no validan ni completan campos.

## Enumeraciones

| Tipo | Valores | Fuente |
| --- | --- | --- |
| `UserRole` | `admin`, `usuario`, `invitado` | `src/types/index.ts:1`, `supabase-schema.sql:10` |
| `TaskStatus` | `backlog`, `por_hacer`, `haciendo`, `en_revision`, `finalizadas` | `src/types/index.ts:3`, `supabase-schema.sql:12` |
| `TaskPriority` | `urgente`, `alta`, `normal`, `baja` | `src/types/index.ts:5`, `supabase-schema.sql:14` |

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
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null y asigna `now()` por defecto | No | Metadato |

Fuente: `src/types/index.ts:7-16`, `supabase-schema.sql:21-30`.

## `Task` y `TaskWithAssignees`

Correspondencia: `public.tasks`; `TaskWithAssignees` agrega `assignees` y contadores opcionales.

| Campo | Tipo TS | Nullable en el contrato | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID generado por SQL |
| `title` | `string` | No | Requerido |
| `description` | `string \| null` | Sí | Texto opcional |
| `status` | `TaskStatus` | No | Default SQL `backlog` |
| `priority` | `TaskPriority` | No | Default SQL `normal` |
| `special_notes` | `string \| null` | Sí | Notas especiales |
| `created_by` | `string \| null` | Sí | FK a `profiles.id`, `ON DELETE SET NULL` |
| `position` | `number` | No | `numeric` en SQL, default `0` |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null y asigna `now()` por defecto | Timestamps |
| `assignees` | `Profile[]` | No (en TS) | Derivado de relación por la query; proyección incompleta, ver D-03 |
| `comment_count`, `attachment_count` | `number?` | Opcional | Tipos definidos; no vienen en la query `useTasks` observada |

Fuente: `src/types/index.ts:18-35`, `supabase-schema.sql:39-50`.

## Relaciones auxiliares

### `TaskAssignee`

| Campo | Tipo TS | Notas |
| --- | --- | --- |
| `task_id` | `string` | FK a `tasks.id` |
| `profile_id` | `string` | FK a `profiles.id` |
| `created_at` | `string` | Timestamp |

Fuente: `src/types/index.ts:37-41`, `supabase-schema.sql:59-64`.

### `Comment` y `CommentWithAuthor`

| Campo | Tipo TS | Nullable en SQL | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID |
| `task_id` | `string` | No | FK con `ON DELETE CASCADE` |
| `author_id` | `string` | Declarado `NOT NULL` | FK con `ON DELETE SET NULL`; conflicto documentado en D-01 |
| `body` | `string` | No | Contenido de usuario |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null con default | Timestamps |
| `author` (`CommentWithAuthor`) | `Profile` | No (en TS) | Query devuelve solo una proyección parcial; ver D-03 |

Fuente: `src/types/index.ts:43-54`, `supabase-schema.sql:73-80`.

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

Fuente: `src/types/index.ts:56-65`, `supabase-schema.sql:89-98`.

## Ausencias relevantes

- No se encontró JSON Schema o validación runtime de estos tipos en las rutas de datos consultadas.
- No hay tipos generados desde el schema Supabase en el repositorio; los tipos locales son mantenidos manualmente.
- `tasks_with_assignees` y `tasks_with_stats` existen como vistas SQL, pero la query de tareas leída consulta `tasks` con relación y no usa esas vistas (`supabase-schema.sql:408-435`, `src/features/board/api.ts:5-21`).
