# Mapeo Supabase ↔ aplicación

## Tareas y asignados

La query lee `tasks` y expande `task_assignees(profile_id, profiles(full_name, avatar_url, role))`. Después reemplaza la relación `task_assignees` por un arreglo `assignees` construido con el objeto `profiles` de cada relación y castea el resultado como `TaskWithAssignees` (`src/features/board/api.ts:5-21`).

```text
tasks row
  └── task_assignees[]
        └── profiles { full_name, avatar_url, role }
              ↓ map
        assignees[]
```

La proyección no selecciona todos los campos de `Profile` (`id`, `email`, `nickname`, timestamps, entre otros); el cast no los materializa. Ver D-03 en [deuda técnica](data-tech-debt.md).

## Comentarios y autor

La query de comentarios selecciona las columnas de `comments` y relaciona `author:profiles(id, full_name, avatar_url, role)`, ordena ascendentemente por `created_at` y castea la respuesta a `CommentWithAuthor[]` (`src/features/board/commentsApi.ts:5-17`). La proyección de `author` tampoco contiene todos los campos declarados por `Profile`.

## Adjuntos

La fila de `task_attachments` mantiene metadatos y `file_url`. Al subir, el cliente primero carga un objeto a Storage, obtiene una URL con `getPublicUrl` y después inserta esos metadatos (`src/features/board/attachmentsApi.ts:24-67`). La eliminación extrae el último segmento de la URL para intentar borrar el objeto y luego elimina la fila de metadata (`src/features/board/attachmentsApi.ts:75-90`). El contrato del bucket se describe en [schema](04-schema.md#storage).

## Tipos y validación

- Las interfaces/uniones de `src/types/index.ts` describen los tipos estáticos esperados (`src/types/index.ts:1-65`).
- Las respuestas se convierten a esos tipos mediante casts en algunas consultas (`src/features/board/api.ts:16-21`, `src/features/board/commentsApi.ts:15-17`); no se observa una validación runtime del payload.
- No hay una capa de mapeo DTO-dominio general: las queries de cada feature adaptan directamente el resultado donde hace falta.
