# Catálogo de operaciones de datos

No se encontró OpenAPI. El contrato observado combina SDK de Supabase, una Edge Function propia y RPCs Postgres. Se documentan nombres, parámetros y respuestas reales sin URLs de proyecto. RLS/grants o comprobaciones servidor explícitas controlan cada operación.

## Autenticación

### Iniciar sesión — `supabase.auth.signInWithPassword`

- Propósito: autenticar con email y contraseña.
- Auth: credenciales del usuario enviadas al SDK; la app recibe el resultado de Auth.
- Request observado: `{ email, password }`; no se documentan valores.
- Response: el componente solo consume `error`; la sesión se publica por `AuthContext`.
- Errores: error devuelto por Supabase Auth y mostrado como mensaje en la pantalla.
- Fuente: `src/features/auth/LoginPage.tsx:12-27`.

### Alta — operación administrativa, no `signUp`

`RegisterPage` fue retirado. `/register` redirige a `/users`; las altas se realizan mediante `admin-users` y `auth.admin.createUser`, sin cambiar la sesión del administrador y con `email_confirm: true`. El registro público queda deshabilitado por `supabase/config.toml:1-3`. Ver el contrato administrativo más abajo (`src/App.tsx:27-28`, `supabase/functions/admin-users/index.ts:43-56`).

### Recuperación y cambios de sesión — `getSession` / `onAuthStateChange`

- Propósito: hidratar y mantener el estado de sesión del cliente.
- Request: no hay parámetros de negocio observados.
- Response consumida: `Session | null`; si hay usuario, se consulta `profiles`.
- Errores: `getSession` no tiene manejo explícito de error en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:27-93`. Se consulta también el perfil al recuperar foco/cada 30 s; se descartan respuestas de identidades anteriores.

### Cerrar sesión — `supabase.auth.signOut`

- Propósito: cerrar la sesión de Supabase.
- Request: no hay parámetros.
- Response: `AuthContext.signOut()` espera la promesa, pero no devuelve ni transforma el resultado.
- Errores: no hay manejo local explícito en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:95-98`; después limpia TanStack Query.

## PostgreSQL vía Supabase

### Leer perfil — `profiles.select`

- Propósito: recuperar el perfil del usuario autenticado.
- Request observado: `select('*').eq('id', userId).single()`.
- Response: fila tipada/casteada como `Profile` o error; un error deja `profile` en `null`.
- Fuente: `src/features/auth/AuthContext.tsx:27-45`; un perfil no activo o un fallo limpia también la caché.

### Leer tareas — `tasks.select` con relación de asignados

- Propósito: traer tareas ordenadas por `position` y una proyección de perfiles asignados.
- Request observado: `.from('tasks').select(...)`, con `*` y `task_assignees(profile_id, profiles(id, full_name, email, avatar_url, role, is_active))`; orden por `position`, relaciones nulas descartadas.
- Response: filas transformadas a `TaskWithAssignees`; consultar [mapeo](03-mapping.md#tareas-y-asignados).
- Errores: el error Supabase se lanza; TanStack Query lo expone a la pantalla.
- Fuente: `src/features/board/api.ts:5-29`.

### Crear tarea — RPC `create_task_with_assignees`

- Auth: `admin` o `usuario` activos; propietario derivado de `auth.uid()`, no del `createdBy` local del hook.
- Request: `{ p_title, p_description, p_status, p_priority, p_assignee_ids }`; descripción ausente → `null`; IDs deduplicados. SQL permite lista omitida por defecto `[]`.
- Response: objeto JSON de la tarea (`Task`), no incluye los perfiles de responsables; la query de tareas se invalida.
- Transacción: valida título/rol/estado, calcula posición con bloqueo por estado, inserta tarea y ejecuta `set_task_assignees`. Un error revierte ambas escrituras. Los adjuntos se suben **después**, fuera de esta transacción.
- Fuente: `src/features/board/api.ts:49-85`, `supabase/migrations/202610200001_task_assignments.sql:47-76`.

### Reemplazar responsables — RPC `set_task_assignees`

- Auth: cualquier cuenta activa, **incluido `invitado`**, sobre cualquier tarea existente.
- Request: `{ p_task_id: UUID, p_assignee_ids: UUID[] }`; `[]` desasigna a todos. No admite lista nula ni IDs nulos; elimina duplicados.
- Response: `AssigneeProfile[]` en JSON, ordenados por nombre/ID. Actualiza la caché de tareas e invalida la query.
- Validación: destinos existentes y activos; permite conservar un destino inactivo si ya estaba asignado. Bloquea tarea y perfiles objetivo durante la transacción. Prevalece el último conjunto guardado, sin detección de conflicto de borradores.
- Permisos: no modifica título, descripción, propietario, estado ni prioridad. Escritura directa cliente en `task_assignees` revocada. La edición de esos campos de la tarea se rige por su propia policy y sus permisos por columna, no por esta RPC.
- Errores SQL: `42501` cuenta no autorizada; `22023` lista/destino inválido; `P0002` tarea inexistente. El SDK los propaga; la UI conserva el borrador y presenta un mensaje seguro.
- Fuente: `src/features/board/api.ts:87-104`, `supabase/migrations/202610200001_task_assignments.sql:5-45`.

### Usuarios asignables — `profiles.select`

- Auth: cuenta activa con acceso por RLS; no requiere ser administrador ni invocar `admin-users`.
- Selección: `id, full_name, email, avatar_url, role, is_active`, filtrada por `is_active = true`, ordenada por `full_name`/`id`.
- Paginación: rangos de 500 hasta recibir una página menor; devuelve `AssigneeProfile[]`. Query `['assignable-users']`, habilitada al abrir creación/detalle, `staleTime: 0`.
- Fuente: `src/features/board/assigneesApi.ts:5-20`.

### Actualizar tarea — `tasks.update`

- Propósito: cambiar título, descripción, estado y prioridad.
- Auth: cualquier cuenta autenticada activa, **incluido `invitado`**, sobre cualquier tarea; no se limita a la tarea creada por el actor.
- Request observado: `taskId` y esos campos; filtro por `id`.
- Columnas escribibles: solo `title`, `description`, `status`, `priority` y `position`. `created_by` no es escribible desde el cliente.
- Response: no se consume fila; la query `tasks` se invalida al completar.
- Errores: si la migración `202610200002_shared_task_editing.sql` no está aplicada en el proyecto, la base de datos rechaza la escritura con un error de RLS; la UI conserva el borrador y muestra un mensaje seguro.
- Fuente: `src/features/board/api.ts:106-134`, `supabase/migrations/202610200002_shared_task_editing.sql:1-22`.

### Cambiar estado/posición — `tasks.update`

- Propósito: actualizar estado y posición de una tarea al moverla entre columnas.
- Auth: cualquier cuenta autenticada activa, sobre cualquier tarea.
- Request observado: `taskId`, `status`, `position`; filtro por `id`.
- Response: sin fila de respuesta consumida; invalidación de `tasks`.
- Fuente: `src/features/board/api.ts:31-47`.

### Reordenar posiciones — varias operaciones `tasks.update`

- Propósito: persistir la nueva posición de una lista de tareas.
- Auth: cualquier cuenta autenticada activa.
- Request observado: arreglo `{ taskId, position }`; ejecuta una actualización por elemento usando `Promise.all`.
- Response: no hay transacción explícita; se invalidan las tareas al completar.
- Fuente: `src/features/board/api.ts:154-174`.

### Eliminar tarea — `tasks.delete`

- Propósito: borrar una tarea por `id`.
- Auth: el creador de la tarea o un `admin`. La edición compartida no amplía este permiso.
- Response: no se consume fila; error se lanza.
- Fuente: `src/features/board/api.ts:136-152`, `supabase/migrations/202610200002_shared_task_editing.sql:16-18`.

### Leer / crear / eliminar comentarios — `comments`

- Lectura: filtra por `task_id`, ordena por `created_at` ascendente y proyecta `author` desde `profiles` (`src/features/board/commentsApi.ts:5-24`).
- Creación: inserta `task_id`, `author_id` y `body`, devuelve la fila insertada (`src/features/board/commentsApi.ts:27-57`).
- Eliminación: borra por `id` (`src/features/board/commentsApi.ts:59-74`).
- Errores: errores de consulta/mutación se lanzan; no existe DTO común de error.

### Leer adjuntos — `task_attachments.select`

- Propósito: consultar metadatos por `task_id`, ordenados por fecha ascendente.
- Response: filas como `TaskAttachment`.
- Fuente: `src/features/board/attachmentsApi.ts:11-27`.

## Storage vía Supabase

### Subir adjunto — bucket `task-attachments`

- Secuencia observada: nombre generado con `crypto.randomUUID()` más extensión; `storage.upload`; obtiene `getPublicUrl`; inserta metadata en `task_attachments`.
- Metadata insertada: `task_id`, `uploaded_by`, nombre original, URL, tamaño y MIME.
- Request de Storage: opciones `cacheControl: '3600'` y `upsert: false`.
- Fuente: `src/features/board/attachmentsApi.ts:98-147`.
- Nota: el bucket se crea con `public = false` (`supabase-schema.sql:353-356`); ver discrepancia D-02.

### Eliminar adjunto — Storage y `task_attachments.delete`

- Secuencia observada: extrae el último segmento de `fileUrl`, intenta quitar ese objeto del bucket y después borra metadata por `id`.
- Response: se consulta el error al borrar metadata; el resultado de borrar el objeto no se valida explícitamente.
- Fuente: `src/features/board/attachmentsApi.ts:150-172`.

### Miniaturas — URLs firmadas de `task-attachments`

Consulta metadatos de adjuntos por IDs de tareas, filtra MIME `image/`, extrae el path de `file_url` y usa `createSignedUrls(..., 3600)`. Devuelve un mapa por tarea con `{ id, fileName, signedUrl }`; URLs solo en caché de UI. Query `['task-image-previews', idsNormalizados]`, refresco y `staleTime` de 50 minutos. No resuelve el uso de `getPublicUrl` para el enlace de metadata general (D-02). Fuente: `src/features/board/attachmentsApi.ts:30-96`.

## Edge Function — `admin-users`

Cliente: `supabase.functions.invoke('admin-users', { body })`, POST con bearer de sesión. La función verifica `auth.getUser` y exige perfil `admin` activo **antes de todas las acciones**; la clave privilegiada solo existe en servidor (`src/features/users/api.ts:11-28`, `supabase/functions/admin-users/index.ts:13-32`).

| `body.action` | Campos de entrada | Respuesta correcta | Efecto |
| --- | --- | --- | --- |
| `list` | `page` entero 1–100000, por defecto 1 | `{ users: ManagedUser[], total, pageSize: 50 }` | Perfiles ordenados por fecha descendente/ID |
| `create` | `fullName`, `email`, `password` | `{ success: true }` | Auth con correo confirmado, perfil `usuario` activo; intenta compensación si falla perfil |
| `rename` | `userId`, `fullName` | `{ success: true }` | Solo `profiles.full_name`; no sincroniza metadata Auth |
| `password` | `userId`, `password` | `{ success: true }` | Establece contraseña con API administrativa; no promete invalidar sesiones existentes |
| `set-active` | `userId`, `active: boolean` | `{ success: true }` | Solo `profiles.is_active`; prohíbe desactivación propia y conserva datos |

Validación servidor: nombre recortado 1–120 caracteres; email validado, recortado y en minúsculas para alta; contraseña 8–128 caracteres más política de Auth; `userId` UUID. Propiedades extra como `role` no se aplican. Respuesta de error `{ error: string }`: 400 payload/operación, 401 sesión, 403 rol/estado, 405 método, 500 fallo interno/compensación/listado. `Cache-Control: no-store`; OPTIONS soportado. El cliente intenta leer el error JSON de `FunctionsHttpError.context` y usa fallback seguro en fallos de red/gateway (`supabase/functions/admin-users/validation.ts:8-32`, `supabase/functions/admin-users/index.ts:34-75`, `src/features/users/api.ts:11-24`).

## Límites del catálogo

- Las rutas HTTP internas de Supabase, límites de tamaño configurados en el servicio, respuestas exactas de Auth y estado de despliegue del proyecto Supabase no son verificables desde este repositorio.
- Administración usa páginas de 50 y usuarios asignables lotes de 500. Tareas/comentarios/adjuntos continúan sin paginación explícita. El catálogo no certifica rate limits ni configuración remota actual; conserva la evidencia previa de despliegue descrita en el README de este dominio.
