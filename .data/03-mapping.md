# Mapeo Supabase ↔ aplicación

## Tareas y asignados

La query lee tareas filtradas por `board_id` y expande `task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))`. Añade `assignees` con cada perfil relacionado, descarta relaciones nulas y castea como `TaskWithAssignees`. `board_id` viaja en el objeto de tarea (`src/features/board/api.ts:5-29`).

```text
tasks row
  └── board_id → boards.id
  └── task_assignees[]
        └── profiles { id, full_name, email, avatar_url, role, is_active }
              ↓ map
        assignees[]
```

La proyección coincide ahora con `AssigneeProfile`, no promete un `Profile` completo. Esta parte de D-03 está resuelta; el cast sigue sin validar respuestas en runtime (`src/types/index.ts:32-38`). `set_task_assignees` devuelve las mismas seis propiedades y sustituye el arreglo cacheado; no mezcla otros campos de la tarea (`src/features/board/api.ts:87-102`).

El formulario envía IDs, no perfiles completos. El cliente y SQL deduplican; SQL acepta conservar responsables inactivos ya presentes, pero rechaza añadir nuevos inactivos. El hook aún acepta `createdBy` por compatibilidad local, pero no lo envía al RPC: `auth.uid()` define el creador (`src/features/board/api.ts:49-84`, `supabase/migrations/202610200001_task_assignments.sql:13-68`).

## Administración y perfil

La Edge Function normaliza nombre/email y en el alta fuerza `role: 'usuario'` e `is_active: true`, ignorando campos adicionales del cliente. El perfil inicial toma el nombre de metadata de Auth por trigger. La acción `rename` posterior actualiza únicamente `profiles.full_name`, no `auth.users.user_metadata`; consumidores deben usar el perfil como nombre de la aplicación. La acción `promote-admin` fija únicamente `profiles.role = 'admin'`; se autoriza mediante la comprobación previa de administrador activo y deja `is_active` sin cambios (`supabase/functions/admin-users/validation.ts:22-34`, `supabase/functions/admin-users/index.ts:24-28,43-72`). `ManagedUser` y `AssigneeProfile` son proyecciones distintas del mismo perfil.

## Comentarios y autor

La query de comentarios selecciona las columnas de `comments` y relaciona `author:profiles(id, full_name, avatar_url, role)`, ordena ascendentemente por `created_at` y castea la respuesta a `CommentWithAuthor[]` (`src/features/board/commentsApi.ts:5-17`). La proyección de `author` tampoco contiene todos los campos declarados por `Profile`.

## Adjuntos

El objeto nuevo se carga en `<taskId>/<UUID>.<extensión>`; la metadata guarda la URL generada por `getPublicUrl`, de la que el cliente extrae el path sin usarla como enlace. Las vistas de detalle y miniaturas solicitan URLs firmadas por 60 segundos; queries se refrescan cada 45 segundos. La eliminación quita el objeto por path, verifica el resultado y luego elimina metadata. Paths anteriores planos se resuelven contra metadata existente por la policy SQL. Persiste la discrepancia de `getPublicUrl` frente al bucket privado (D-02); la convención de path/borrado queda alineada para nuevas cargas y admite los objetos planos previos (D-04 resuelta en el árbol observado). Fuentes: `src/features/board/attachmentsApi.ts`, `supabase/migrations/202610210001_boards.sql:133-172`.

## Tableros y pertenencia

`Board` es la proyección directa de `boards`. `Task.board_id` enlaza cada tarea a exactamente un tablero. `board_members` se consulta como relación de perfiles; el filtro visible del catálogo de tableros se aplica en RLS, no en el cliente. El traslado ejecuta RPC y conserva el mismo `task_id`, de modo que comentarios, asignaciones y adjuntos permanecen relacionados (`src/features/boards/api.ts`, `supabase/migrations/202610210001_boards.sql:4-22,114-125`).

## Tipos y validación

- Las interfaces/uniones de `src/types/index.ts:1-68` describen tipos estáticos; `parseAction` sí valida los payloads administrativos de entrada, no las respuestas del SDK.
- Las respuestas se convierten a esos tipos mediante casts en algunas consultas (`src/features/board/api.ts:16-21`, `src/features/board/commentsApi.ts:15-17`); no se observa una validación runtime del payload.
- No hay una capa de mapeo DTO-dominio general: las queries de cada feature adaptan directamente el resultado donde hace falta.
