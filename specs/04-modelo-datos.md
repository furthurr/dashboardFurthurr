# 04 - Modelo De Datos

Estado: `aprobada`

Última actualización: 2026-10-27

## Archivo De Referencia

El esquema completo está en [`supabase-schema.sql`](../supabase-schema.sql). Este documento resume las decisiones.

## Supabase Auth

Supabase Auth gestionará usuarios, correos, passwords y sesiones. La tabla `profiles` extenderá la información pública del usuario.

## Tabla `profiles`

Campos propuestos:

- `id`: uuid, primary key, referencia a `auth.users.id`.
- `full_name`: text, requerido.
- `email`: text, requerido.
- `avatar_url`: text, opcional. Apunta al objeto del bucket público `avatars`; la aplicación usa el path `<profile-id>/avatar`. Lectura pública y escrituras solo por propietario o administrador activo.
- El bucket limita avatares a JPEG, PNG o WebP con tamaño máximo de 2 MiB; no guardar contenido sensible en esas imágenes.
- `nickname`: text, opcional.
- `role`: enum `admin`, `usuario`, `invitado`.
- `is_active`: boolean obligatorio, `true` por defecto; permite desactivar el acceso sin borrar cuenta ni contenido. Solo la función administrativa puede cambiarlo desde la aplicación.
- `created_at`: timestamp.
- `updated_at`: timestamp.

## Tabla `tasks`

Campos propuestos:

- `id`: uuid, primary key.
- `board_id`: uuid, referencia obligatoria a `boards.id`; una tarea pertenece a un único tablero. Las tareas existentes se asignan a Offline durante la migración.
- `title`: text, requerido.
- `description`: text, opcional.
- `status`: enum de estados.
- `priority`: enum de prioridades.
- `special_notes`: text, opcional.
- `created_by`: uuid, referencia a `profiles.id`.
- `position`: numeric o integer para ordenar cards.
- `created_at`: timestamp.
- `updated_at`: timestamp.

## Tabla `task_assignees`

Campos propuestos:

- `task_id`: uuid, referencia a `tasks.id`.
- `profile_id`: uuid, referencia a `profiles.id`.
- `created_at`: timestamp.

Llave primaria compuesta: `task_id`, `profile_id`.

## Tableros

### `boards`

- `id`: uuid, primary key.
- `name`: text, requerido, único sin distinguir mayúsculas; entre 1 y 120 caracteres tras recortar espacios.
- `is_active`: boolean, obligatorio, `true` por defecto. Un tablero desactivado solo es visible para los administradores activos; sus miembros dejan de acceder a él y a sus tareas. Desactivar no borra tareas, comentarios, adjuntos ni membresías.
- `created_at`: timestamptz.

Operaciones sobre tableros (reservadas a administradores activos):

- `rename_board(p_board_id, p_name)`: renombra el tablero; conserva las reglas de longitud (1–120 tras recortar) y unicidad sin distinguir mayúsculas.
- `set_board_active(p_board_id, p_active)`: desactiva o reactiva el tablero sin eliminar su contenido.
- `list_boards_with_pending_counts()`: devuelve `id`, `name`, `is_active`, `created_at` y `pending_count` (tareas en `backlog`, `por_hacer` y `haciendo`). El administrador activo recibe todos los tableros; el resto, solo los tableros activos de los que es miembro.
- `delete_inactive_board(p_board_id)`: operación exclusiva de administrador activo que elimina un tablero solo si está desactivado. Elimina primero las tareas y después el tablero; las relaciones de tarea se eliminan por cascada.

### `board_members`

- `board_id`: uuid, referencia a `boards.id`.
- `profile_id`: uuid, referencia a `profiles.id`.
- Llave primaria compuesta `(board_id, profile_id)`.
- La relación determina acceso; una asignación de tarea no crea una membresía.
- La migración crea `Offline` y `General`, asigna a cuentas activas existentes a `Offline`; `General` empieza vacío.

## Tabla `comments`

Campos propuestos:

- `id`: uuid, primary key.
- `task_id`: uuid, referencia a `tasks.id`.
- `author_id`: uuid, referencia a `profiles.id`.
- `body`: text, requerido.
- `created_at`: timestamp.
- `updated_at`: timestamp.

## Tabla `task_attachments`

Campos propuestos:

- `id`: uuid, primary key.
- `task_id`: uuid, referencia a `tasks.id`.
- `uploaded_by`: uuid, referencia a `profiles.id`.
- `file_name`: text.
- `file_url`: text.
- `file_size`: integer.
- `mime_type`: text.
- `created_at`: timestamp.

`file_name` puede actualizarse por el uploader, el creador de la tarea o un administrador activo con acceso al tablero. El permiso de cliente se limita a esa columna; el objeto y path de Storage no cambian al renombrarlo. El borrado elimina el objeto de Storage y luego la fila de metadata; estas operaciones no comparten una transacción distribuida.

## Enums Propuestos

`user_role`:

- `admin`
- `usuario`
- `invitado`

`task_status`:

- `backlog`
- `por_hacer`
- `haciendo`
- `en_revision`
- `finalizadas`

`task_priority`:

- `urgente`
- `alta`
- `normal`
- `baja`

## Elementos Adicionales Implementados

El archivo SQL incluye también:

- **Triggers `updated_at`**: automatic timestamp updates on profiles, tasks, comments.
- **Trigger `handle_new_user`**: auto-creates profile on auth.users signup.
- **Índices**: para optimizar queries en status, priority, created_by, task_id, author_id.
- **Views**:
  - `tasks_with_assignees`: tasks con array JSON de asignados.
  - `tasks_with_stats`: tasks con conteo de comentarios y adjuntos.
- **Storage buckets**: `avatars` (público) y `task-attachments` (privado).
- **Avatar**: `avatars` admite imágenes JPEG, PNG y WebP de hasta 2 MiB; `profiles.avatar_url` guarda la URL pública.
- **Gestión de adjuntos y tableros**: el bootstrap contiene el permiso de actualizar únicamente `task_attachments.file_name`, el borrado de tableros inactivos y las policies de avatar. Para bases existentes corresponden las migraciones `202610260001_task_attachment_management.sql`, `202610260002_delete_inactive_boards.sql` y `202610260003_profile_avatars.sql`, en ese orden. Están en el árbol local; su aplicación remota no se verificó en esta actualización.
- **RLS policies**: detalladas por tabla según roles documentados en `05-auth-roles-permisos.md`.
