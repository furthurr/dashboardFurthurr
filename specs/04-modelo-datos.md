# 04 - Modelo De Datos

Estado: `aprobada`

Última actualización: 2026-04-28

## Archivo De Referencia

El esquema completo está en [`supabase-schema.sql`](../supabase-schema.sql). Este documento resume las decisiones.

## Supabase Auth

Supabase Auth gestionará usuarios, correos, passwords y sesiones. La tabla `profiles` extenderá la información pública del usuario.

## Tabla `profiles`

Campos propuestos:

- `id`: uuid, primary key, referencia a `auth.users.id`.
- `full_name`: text, requerido.
- `email`: text, requerido.
- `avatar_url`: text, opcional.
- `nickname`: text, opcional.
- `role`: enum `admin`, `usuario`, `invitado`.
- `created_at`: timestamp.
- `updated_at`: timestamp.

## Tabla `tasks`

Campos propuestos:

- `id`: uuid, primary key.
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
- **RLS policies**: detalladas por tabla según roles documentados en `05-auth-roles-permisos.md`.
