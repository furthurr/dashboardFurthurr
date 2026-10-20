# Mapeo Supabase ↔ aplicación

## Tareas y asignados

La query lee `tasks` y expande `task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))`. Añade `assignees` con cada perfil relacionado, descarta relaciones nulas y castea como `TaskWithAssignees`. El spread también conserva los campos originales del resultado; no es un DTO serializado separado (`src/features/board/api.ts:5-21`).

```text
tasks row
  └── task_assignees[]
        └── profiles { id, full_name, email, avatar_url, role, is_active }
              ↓ map
        assignees[]
```

La proyección coincide ahora con `AssigneeProfile`, no promete un `Profile` completo. Esta parte de D-03 está resuelta; el cast sigue sin validar respuestas en runtime (`src/types/index.ts:32-38`). `set_task_assignees` devuelve las mismas seis propiedades y sustituye el arreglo cacheado; no mezcla otros campos de la tarea (`src/features/board/api.ts:87-102`).

El formulario envía IDs, no perfiles completos. El cliente y SQL deduplican; SQL acepta conservar responsables inactivos ya presentes, pero rechaza añadir nuevos inactivos. El hook aún acepta `createdBy` por compatibilidad local, pero no lo envía al RPC: `auth.uid()` define el creador (`src/features/board/api.ts:49-84`, `supabase/migrations/202610200001_task_assignments.sql:13-68`).

## Administración y perfil

La Edge Function normaliza nombre/email y no aplica campos extra de rol/estado del alta. El perfil inicial toma el nombre de metadata de Auth por trigger. La acción `rename` posterior actualiza únicamente `profiles.full_name`, no `auth.users.user_metadata`; consumidores deben usar el perfil como nombre de la aplicación (`supabase/functions/admin-users/validation.ts:21-30`, `supabase/functions/admin-users/index.ts:43-66`). `ManagedUser` y `AssigneeProfile` son proyecciones distintas del mismo perfil.

## Comentarios y autor

La query de comentarios selecciona las columnas de `comments` y relaciona `author:profiles(id, full_name, avatar_url, role)`, ordena ascendentemente por `created_at` y castea la respuesta a `CommentWithAuthor[]` (`src/features/board/commentsApi.ts:5-17`). La proyección de `author` tampoco contiene todos los campos declarados por `Profile`.

## Adjuntos

La fila conserva metadata y `file_url` obtenido mediante `getPublicUrl` después del upload; borrar intenta quitar el último segmento del URL y después elimina metadata (`src/features/board/attachmentsApi.ts:98-169`). Las miniaturas filtran MIME de imágenes y extraen el path tras `/task-attachments/` para emitir URLs firmadas de una hora, agrupadas por tarea. Esa transformación no sustituye el URL almacenado ni resuelve D-02/D-04 para el resto del flujo (`src/features/board/attachmentsApi.ts:30-95`). Ver [schema](04-schema.md#storage).

## Tipos y validación

- Las interfaces/uniones de `src/types/index.ts:1-68` describen tipos estáticos; `parseAction` sí valida los payloads administrativos de entrada, no las respuestas del SDK.
- Las respuestas se convierten a esos tipos mediante casts en algunas consultas (`src/features/board/api.ts:16-21`, `src/features/board/commentsApi.ts:15-17`); no se observa una validación runtime del payload.
- No hay una capa de mapeo DTO-dominio general: las queries de cada feature adaptan directamente el resultado donde hace falta.
