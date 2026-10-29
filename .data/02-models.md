# Modelos y tipos

Los tipos del portal viven en `src/types/index.ts`; los casts de queries no validan ni completan campos. MCP valida DTOs de tarea/adjuntos y argumentos workflow con Zod en `supabase/functions/mcp/task.ts:4-35` y `supabase/functions/mcp/workflow.ts:6-25`; el portal valida los permisos MCP con Zod en `src/features/auth/mcpWorkflowAccess.ts:3-24`. El esquema de instalación nueva es `supabase-schema.sql`; `202610290001_mcp_workflow.sql` está aplicada y registrada en el proyecto remoto.

## Enumeraciones

| Tipo | Valores | Fuente |
| --- | --- | --- |
| `UserRole` | `admin`, `usuario`, `invitado` | `src/types/index.ts:1`, `supabase-schema.sql:10` |
| `TaskStatus` | `backlog`, `por_hacer`, `haciendo`, `en_revision`, `finalizadas` | `src/types/index.ts:3`, `supabase-schema.sql:12` |
| `TaskPriority` | `urgente`, `alta`, `normal`, `baja` | `src/types/index.ts:5`, `supabase-schema.sql:14` |

## `Board` y `board_members`

- `Board` local incluye `id`, `name`, `is_active`, `created_at`, `pending_count`,
  `my_pending_count` y `people: BoardPerson[]` (ID, nombre, avatar). Los contadores y
  personas son proyecciones de RPC, no columnas de `boards`
  (`src/types/index.ts:33-43`, `supabase/migrations/202610280001_board_assignment_access.sql:44-83`).
- `public.boards.name` es único sin distinguir mayúsculas (`boards_unique_name` sobre `lower(name)`), y valida nombre recortado de 1–120 caracteres (`supabase-schema.sql:576,580`).
- `public.boards.is_active` es `boolean not null default true`; modela el ciclo de vida activo/desactivado sin borrar contenido al desactivar. Un admin puede borrar permanentemente un tablero solo después de desactivarlo, mediante `delete_inactive_board`; esta operación elimina sus tareas y datos relacionales (`supabase-schema.sql:577,727-739`, `supabase/migrations/202610260002_delete_inactive_boards.sql:5-21`).
- `pending_count` **no es una columna**: es un valor calculado por la RPC `list_boards_with_pending_counts` y devuelto como `bigint`; el cliente lo normaliza a `number` (`src/features/boards/api.ts:5,15`).
- `board_members` es la relación many-to-many entre `boards.id` y `profiles.id`, con PK compuesta `(board_id, profile_id)`; se representa como perfiles `AssigneeProfile[]` en el cliente, no como entidad TS independiente.
- Solo admins activos pueden crear tableros, renombrarlos, activarlos/desactivarlos y gestionar membresías. `Offline` y `General` se crean por migración; los miembros activos existentes se asignan a Offline y General empieza vacío.
- Fuente: `src/types/index.ts:33-39`, `src/features/boards/api.ts:5-18`, `supabase/migrations/202610210001_boards.sql:4-22,63-80`, `supabase/migrations/202610220002_board_lifecycle.sql:5,40-66`.

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

## `McpIdentity` — respuesta de `whoami`

La herramienta MCP devuelve una proyección explícita de la cuenta activa y del
cliente OAuth. No es el JWT ni una sesión completa y no se persiste como tabla.

| Campo | Tipo | Requerido | Sensible/PII | Notas |
| --- | --- | --- | --- | --- |
| `id` | UUID string | Sí | Identificador de cuenta | Igual a `profiles.id` / `auth.uid()` validado en la sesión OAuth |
| `email` | string/email | Sí | PII alta | `profiles.email` |
| `full_name` | string | Sí | PII | `profiles.full_name` |
| `role` | `UserRole` | Sí | Dato de autorización | Rol de producto del perfil (`admin`, `usuario`, `invitado`), no `role=mcp_identity` del JWT |
| `client_id` | UUID string | Sí | Identificador de integración | Cliente OAuth registrado en `auth.oauth_clients` |

El JSON Schema completo está en [`contracts/mcp-whoami.schema.json`](contracts/mcp-whoami.schema.json). No incluye access/refresh token, `session_id`, tablas de negocio ni referencias a tableros.
Fuente: `supabase/functions/mcp/index.ts:14-19,145-150`, `supabase/migrations/202610280002_mcp_identity.sql:65-71`.

## `TaskInput`, `RawTask` y `TaskResult` — `get_task`

Fuente ejecutable: `supabase/functions/mcp/task.ts:4-35`. Son DTOs propios del MCP,
no casts a `TaskWithAssignees`. El catálogo detalla [argumentos y errores](01-endpoints.md).

| Campo de salida | Forma observada |
| --- | --- |
| `task` | `id`, `title`, `description`, `status`, `priority`, `special_notes`, `created_at`, `updated_at`; descripción/notas/fechas admiten `null`. No incluye `created_by`, `board_id` ni `position` |
| `board` | `{ id, name }` |
| `assignees` | `{ id, full_name }[]`; schema admite personas con propiedades nulas; SQL usa perfiles existentes. No incluye email/rol/avatar |
| `comments` | Página de `{ id, body, author: { id, full_name }, created_at, updated_at }`; author conserva objeto con campos nulos si falta perfil |
| `attachments` | Página de `{ id, file_name, mime_type, file_size, created_at, download_url, expires_at, download_error }`; URL/expiración/error son nullable |
| Página | `{ total, offset, next_offset, items }`; contadores/offsets enteros no negativos, `next_offset` nullable y `items` siempre array |

`read_task_attachment` recibe IDs de tarea/adjunto, `offset` (0 por defecto) y
`max_chars` (12000 por defecto, máximo 12000); tamaño máximo descargado 5 MiB.
Devuelve metadata firmada más texto UTF-8 con `untrusted_content`, posición,
`total_chars` y `next_offset`, o un bloque MCP `image` para PNG/JPEG/GIF/WebP.
Otros formatos solo devuelven metadata/enlace y aviso de formato no extraído. Fuente:
`supabase/functions/mcp/workflow.ts:19-26,67-103`.

`RawTask` es la respuesta SQL interna y lleva `file_url` por adjunto. `TaskResult`
lo elimina y agrega los campos de descarga; el contrato no devuelve credenciales
ni IDs de sesión. Un fallo de firma preserva la metadata y devuelve URL/expiración
nulas con `download_error`. Los enlaces no son persistencia y caducan a los 60 s.
Los esquemas se anuncian al cliente MCP; no hay un segundo JSON Schema generado
en esta entrega documental.

`WorkflowAccess`, usado solo por el portal: `{ client_id: UUID, permissions:
WorkflowPermission[] }`, donde permiso es `read_tasks`, `read_attachments`, `start_task`,
`comment_task` o `review_task`. El listado puede representar grants antiguos de
lectura por sesión sin conceder permisos de trabajo. Fuente:
`src/features/auth/mcpWorkflowAccess.ts:3-24`,
`supabase/migrations/202610290001_mcp_workflow.sql:68-86`.

## Contratos de adjunto y operaciones MCP

| DTO | Forma / validación |
| --- | --- |
| `AttachmentInput` | `{ task_id, attachment_id, offset=0, max_chars=12000 }`; GUIDs, offset entero `0..5 MiB`, caracteres `1..12000` |
| Texto de adjunto | `{ kind: "text", untrusted_content, offset, total_chars, next_offset, ...metadata }`; solo UTF-8 válido; no garantiza una captura inmutable entre fragmentos |
| Imagen de adjunto | Metadata en bloque de texto y `{ type: "image", data: base64, mimeType }`; PNG/JPEG/GIF/WebP verificadas por firma |
| Formato no extraído | `{ kind: "unsupported", warning, download_url, expires_at, ...metadata }`; enlace no significa que el asistente haya estudiado el archivo |
| Entrada de mutación | `task_id`, `request_id` GUID, `expected_updated_at`; flags literales `user_approved: true` o `user_validated: true` para las acciones que lo requieren |
| Resultado de mutación | `{ request_id, replayed, task_id?, status?, updated_at?, comment_id? }`; `status` solo `haciendo` o `en_revision` |
| Comentario de trabajo | `summary`, `changes`, `clarifications`, `validation`, `observations`, cada uno texto no vacío hasta 12000 caracteres |

Los flags son declaraciones del cliente MCP: el servidor valida el valor, pero no
puede verificar el contenido de la conversación ni que un modelo haya inspeccionado
todo el contexto. Los textos del adjunto y comentario son contenido no confiable.
Fuente: `supabase/functions/mcp/workflow.ts:6-25`,
`supabase/migrations/202610290001_mcp_workflow.sql:209-294`.

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
| `comment_count` | `number?` | Opcional en la interfaz | `fetchTasks` lo obtiene por tarea desde `tasks_with_stats`, convierte el resultado a número y usa `0` si no hay coincidencia (`src/features/board/api.ts:15-35`) |
| `attachment_count` | `number?` | Opcional | Tipo definido, pero no solicitado por `fetchTasks` |

Fuente: `src/types/index.ts:19-47`, `src/features/board/api.ts:5-35`, `supabase/migrations/202610210001_boards.sql:19-22`, `supabase-schema.sql:425-433`.

### Proyecciones y solicitudes nuevas

- `AssigneeProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role' | 'is_active'>`. Las seis propiedades se proyectan explícitamente; no tiene `nickname` ni timestamps (`src/types/index.ts:41`).
- `ManagedUser = Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url' | 'role' | 'is_active'>`, usado en la lista administrativa. El cliente lee `avatar_url` desde `profiles` si una Edge Function antigua lo omite (`src/features/users/api.ts:4,28-48`).
- `UserAction`/`AdminAction`: uniones discriminadas por `action`: `create`, `rename`, `password`, `set-active` y `promote-admin`; el contrato servidor añade `list`. `promote-admin` solo recibe `userId`; el servidor fija el rol `admin` y no admite un valor de rol del cliente. Validación runtime **de solicitudes administrativas**, no de todas las respuestas ni modelos (`src/features/users/api.ts:5-10`, `supabase/functions/admin-users/validation.ts:1-34`).
- La carga de avatar no forma parte de `UserAction`: `uploadProfileAvatar(profileId, file)` acepta `File` de tipo JPG/PNG/WebP hasta 2 MiB y devuelve la URL pública (`src/features/users/avatarApi.ts:3-35`).
- Solicitud de creación de tarea: título, descripción opcional, enum de estado/prioridad y `assigneeIds: string[]`; SQL recibe UUIDs, valida destinos y obtiene propietario de la sesión (`src/features/board/api.ts:65-104`).
- `TaskImagePreview`: `{ id: string, fileName: string, signedUrl: string }`, proyección transitoria sin persistir la URL firmada (`src/features/board/attachmentsApi.ts:5-9`).

## Relaciones auxiliares

### `TaskAssignee`

| Campo | Tipo TS | Notas |
| --- | --- | --- |
| `task_id` | `string` | FK a `tasks.id` |
| `profile_id` | `string` | FK a `profiles.id` |
| `created_at` | `string` | Timestamp |

Fuente: `src/types/index.ts:49-53`. La PK compuesta impide duplicados; escrituras cliente se revocan y se gestionan por RPC (`supabase/migrations/202610200001_task_assignments.sql:5-43`).

### `Comment` y `CommentWithAuthor`

| Campo | Tipo TS | Nullable en SQL | Notas |
| --- | --- | --- | --- |
| `id` | `string` | No | UUID |
| `task_id` | `string` | No | FK con `ON DELETE CASCADE` |
| `author_id` | `string` | Declarado `NOT NULL` | FK con `ON DELETE SET NULL`; conflicto documentado en D-01 |
| `body` | `string` | No | Contenido de usuario |
| `created_at`, `updated_at` | `string` | TS requeridos; SQL permite null con default | Timestamps |
| `author` (`CommentWithAuthor`) | `Profile` | No (en TS) | Query devuelve solo una proyección parcial; ver D-03 |

Fuente: `src/types/index.ts:55-66`, `src/features/board/commentsApi.ts:5-16`; D-03 sigue abierta para el autor de comentarios.

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

Fuente: `src/types/index.ts:68-78`, `supabase-schema.sql:89-99`.

## Ausencias relevantes

- No se encontró JSON Schema o validación runtime de estos tipos en las rutas de datos consultadas.
- No hay tipos generados desde el schema Supabase en el repositorio; los tipos locales son mantenidos manualmente.
- `tasks_with_assignees` existe, pero `fetchTasks` no la usa: obtiene responsables mediante la relación de `tasks`. `tasks_with_stats` sí se consulta, limitada a `id` y `comment_count`; `attachment_count` no se solicita en la query actual (`supabase-schema.sql:408-435`, `src/features/board/api.ts:5-35`).
