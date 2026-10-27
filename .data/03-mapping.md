# Mapeo Supabase ↔ aplicación

## Tareas y asignados

`fetchTasks` lee tareas filtradas por `board_id`, ordenadas por `position`, y expande `task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))`. En paralelo consulta `tasks_with_stats` para el mismo tablero, solo por `id` y `comment_count`; asocia los conteos por id, convierte el valor a `number` y usa `0` si falta. Añade `assignees` con cada perfil relacionado, descarta relaciones nulas y castea como `TaskWithAssignees`. `board_id` viaja en el objeto de tarea (`src/features/board/api.ts:5-35`, `supabase-schema.sql:425-433`).

```text
tasks row
  └── board_id → boards.id
  └── task_assignees[]
        └── profiles { id, full_name, email, avatar_url, role, is_active }
              ↓ map
        assignees[]
tasks_with_stats { id, comment_count }
              ↓ Number + merge by id
        comment_count
```

La proyección coincide ahora con `AssigneeProfile`, no promete un `Profile` completo. Esta parte de D-03 está resuelta; el cast sigue sin validar respuestas en runtime (`src/types/index.ts:41-47`). `set_task_assignees` devuelve las mismas seis propiedades y sustituye el arreglo cacheado; no mezcla otros campos de la tarea (`src/features/board/api.ts:106-123`).

El formulario envía IDs, no perfiles completos. El cliente y SQL deduplican; SQL acepta conservar responsables inactivos ya presentes, pero rechaza añadir nuevos inactivos. El hook aún acepta `createdBy` por compatibilidad local, pero no lo envía al RPC: `auth.uid()` define el creador (`src/features/board/api.ts:65-104`, `supabase/migrations/202610200001_task_assignments.sql:13-68`).

## Administración y perfil

La Edge Function normaliza nombre/email y en el alta fuerza `role: 'usuario'` e `is_active: true`, ignorando campos adicionales del cliente. El perfil inicial toma el nombre de metadata de Auth por trigger. La acción `rename` posterior actualiza únicamente `profiles.full_name`, no `auth.users.user_metadata`; consumidores deben usar el perfil como nombre de la aplicación. La acción `promote-admin` fija únicamente `profiles.role = 'admin'`; se autoriza mediante la comprobación previa de administrador activo y deja `is_active` sin cambios (`supabase/functions/admin-users/validation.ts:22-34`, `supabase/functions/admin-users/index.ts:24-28,43-72`). `ManagedUser` proyecta `avatar_url`; `AssigneeProfile` es otra proyección del mismo perfil.

La carga de avatar usa `uploadProfileAvatar(profileId, file)` y no `admin-users`: carga/reemplaza `avatars/<profile-id>/avatar`, obtiene su URL pública y actualiza `profiles.avatar_url`. La UI propia pasa el ID de sesión; administración pasa el ID de la cuenta objetivo. Storage y RLS limitan escrituras al propietario o admin activo. El bucket es público y se limita a JPG/PNG/WebP de hasta 2 MiB (`src/features/users/avatarApi.ts:3-35`, `supabase/migrations/202610260003_profile_avatars.sql:5-50`).

## Comentarios y autor

La query de comentarios selecciona las columnas de `comments` y relaciona `author:profiles(id, full_name, avatar_url, role)`, ordena ascendentemente por `created_at` y castea la respuesta a `CommentWithAuthor[]` (`src/features/board/commentsApi.ts:5-17`). La proyección de `author` tampoco contiene todos los campos declarados por `Profile`.

## Adjuntos

El objeto nuevo se carga en `<taskId>/<UUID>.<extensión>`; la metadata guarda la URL generada por `getPublicUrl`, de la que el cliente extrae el path sin usarla como enlace. Las vistas de detalle y miniaturas solicitan URLs firmadas por 60 segundos; queries se refrescan cada 45 segundos. Renombrar cambia solo `task_attachments.file_name`; eliminar quita el objeto por path, verifica el resultado y luego elimina metadata. Paths anteriores planos se resuelven contra metadata existente por la policy SQL. Persiste la discrepancia de `getPublicUrl` frente al bucket privado (D-02); la convención de path/borrado queda alineada para nuevas cargas y admite objetos planos previos (D-04 resuelta en el árbol observado). Storage y metadata no son una transacción común. Fuentes: `src/features/board/attachmentsApi.ts:40-71`, `supabase/migrations/202610210001_boards.sql:133-172`, `supabase/migrations/202610260001_task_attachment_management.sql:4-22`.

## Tableros y pertenencia

`Board` es la proyección directa de `boards` **más** dos valores que no son columnas: la RPC `list_boards_with_pending_counts` devuelve `is_active` y `pending_count`, y el cliente los convierte a `boolean` y `number` (`src/features/boards/api.ts:5,11-17`). El listado ya no se filtra en el cliente: la RPC replica la visibilidad de RLS, por lo que admin activo recibe todos los tableros (activos y desactivados) y el resto solo los tableros activos de los que es miembro (`supabase/migrations/202610220002_board_lifecycle.sql:71-85`).

`Task.board_id` enlaza cada tarea a exactamente un tablero. `board_members` se consulta como relación de perfiles; el filtro visible del catálogo de tableros se aplica en RLS, no en el cliente. El traslado ejecuta RPC y conserva el mismo `task_id`, de modo que comentarios, asignaciones y adjuntos permanecen relacionados; el destino se limita a tableros activos (`src/features/board/BoardPage.tsx:411`).

El estado de vida (`is_active`) se propaga como dato, no como permiso de cliente: quien renombra o desactiva es siempre un admin activo según el rol del perfil, pero la autorización efectiva la comprueba la RPC en servidor (`42501` si no lo es) y la policy de lectura de `boards` (`supabase/migrations/202610220002_board_lifecycle.sql:15-24,44,60`).

El borrado permanente solo acepta tableros inactivos y requiere admin activo. El cliente limpia los objetos de adjuntos en Storage antes de invocar la RPC; esta bloquea la fila, repite la validación, elimina las tareas y luego el tablero. Las filas relacionales caen por cascada; Storage no participa de la transacción SQL. Una falla entre fases puede dejar objetos eliminados con datos relacionales conservados (`src/features/boards/api.ts:69-145`, `supabase/migrations/202610260002_delete_inactive_boards.sql:5-25`).

Fuente: `src/features/boards/api.ts`, `src/features/board/BoardPage.tsx:411`, `supabase/migrations/202610210001_boards.sql:4-22,114-125`, `supabase/migrations/202610220002_board_lifecycle.sql:15-24,71-85`.

## Tipos y validación

- Las interfaces/uniones de `src/types/index.ts:1-78` describen tipos estáticos; `parseAction` sí valida los payloads administrativos de entrada, no las respuestas del SDK.
- Las respuestas se convierten a esos tipos mediante casts en algunas consultas (`src/features/board/api.ts:29-35`, `src/features/board/commentsApi.ts:15-17`); no se observa una validación runtime del payload. `comment_count` se convierte explícitamente a `number` antes del merge.
- No hay una capa de mapeo DTO-dominio general: las queries de cada feature adaptan directamente el resultado donde hace falta.
