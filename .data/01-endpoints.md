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

### Leer tableros accesibles con pendientes — RPC `list_boards_with_pending_counts`

- Propósito: obtener el catálogo de tableros visibles con el número de tareas pendientes. Sustituye a la lectura directa `boards.select`.
- Request: sin parámetros; se invoca como `supabase.rpc('list_boards_with_pending_counts')`.
- Response: una fila por tablero visible con `id`, `name`, `is_active`, `created_at` y `pending_count` (`bigint`). El cliente normaliza `pending_count` con `Number(...)` y convierte `is_active` con `Boolean(...)` (`src/features/boards/api.ts:5-18`).
- `pending_count` suma las tareas del tablero en estado `backlog`, `por_hacer` o `haciendo`; excluye `en_revision` y `finalizadas` (`supabase/migrations/202610220002_board_lifecycle.sql:71-85`).
- Autorización: la RPC es `SECURITY DEFINER` con `search_path = ''` y aplica la misma visibilidad que RLS: admin activo ve todos los tableros (activos y desactivados); el resto de cuentas activas solo los tableros activos en los que es miembro. No expone membresías ni conteos de otros tableros.
- Errores: el error de Supabase se propaga; la pantalla distingue carga, error con reintento y catálogo vacío (`src/features/boards/BoardsPage.tsx:28-30`).
- Fuente: `src/features/boards/api.ts:7-22`, `supabase/migrations/202610220002_board_lifecycle.sql:71-90`.

### Crear tablero — `boards.insert`

- Request: `{ name }`; el cliente recorta el nombre. SQL exige 1–120 caracteres, sin espacios exteriores, y unicidad sin distinguir mayúsculas (`supabase-schema.sql:576,580`).
- Auth: solo administrador activo, reforzado por RLS y la restricción SQL. Un tablero recién creado no tiene miembros y nace con `is_active = true` por defecto (`supabase-schema.sql:577`).
- Nota de RLS: `INSERT ... RETURNING` de PostgREST evalúa también la policy de lectura de `boards`; por eso esa policy no invoca ninguna función que lea `boards` (ver «Ciclo de vida de tableros» en [schema](04-schema.md)).
- Fuente: `src/features/boards/api.ts:24-34`, `supabase/migrations/202610210001_boards.sql:4-9,47-48`, `supabase/migrations/202610220002_board_lifecycle.sql:12-24`.

### Renombrar tablero — RPC `rename_board`

- Propósito: cambiar el nombre de un tablero sin salir del selector.
- Request: `{ p_board_id: uuid, p_name: text }`; el cliente recorta el nombre antes de enviarlo (`src/features/boards/api.ts:44-47`).
- Response: `void`; no se consume fila.
- Auth: solo admin activo; en caso contrario la RPC lanza `42501` (`supabase/migrations/202610220002_board_lifecycle.sql:40-54`).
- Validación: nombre recortado de 1–120 caracteres (`22023`), tablero inexistente (`P0002`). El índice único `lower(name)` reporta el duplicado como violación de unicidad (`23505`).
- La RPC no cambia `is_active` ni toca tareas, comentarios, adjuntos o membresías.
- Fuente: `src/features/boards/api.ts:36-47`, `supabase/migrations/202610220002_board_lifecycle.sql:38-54`.

### Activar/desactivar tablero — RPC `set_board_active`

- Propósito: desactivar o reactivar un tablero sin borrarlo.
- Request: `{ p_board_id: uuid, p_active: boolean }`; response `void`.
- Auth: solo admin activo (`42501`); tablero inexistente (`P0002`), argumentos nulos (`22023`).
- Semántica: desactiva o reactiva la fila `boards.is_active`. No borra tareas, comentarios, adjuntos ni membresías; la reactivación devuelve el acceso a los miembros que conservaban su membresía (`supabase/migrations/202610220002_board_lifecycle.sql:56-66`).
- Efecto colateral autorizado en RLS: mientras el tablero está desactivado, sus miembros pierden la lectura del tablero y el acceso a sus tareas (también por URL directa); el admin activo conserva el acceso.
- Fuente: `src/features/boards/api.ts:49-60`, `supabase/migrations/202610220002_board_lifecycle.sql:56-66`.

### Leer/administrar membresías — `board_members` y RPC `set_board_members`

- Las lecturas de miembros se paginan en rangos de 500. El admin puede leer la tabla completa de membresías y sustituirlas mediante `{ p_board_id, p_profile_ids }`.
- Cada miembro autenticado puede además leer **su propia fila** de membresía mediante la policy «Members read own memberships» (`profile_id = auth.uid()`), que no expone las membresías ajenas (`supabase/migrations/202610220002_board_lifecycle.sql:7-10`).
- Se admiten perfiles existentes y activos; los miembros inactivos ya asignados se pueden conservar o retirar, pero no agregar de nuevo. La lista completa se reemplaza atómicamente.
- Fuente: `src/features/boards/api.ts:62-91`, `supabase/migrations/202610210001_boards.sql:63-80`, `supabase/migrations/202610220002_board_lifecycle.sql:9-10`.

### Leer perfil — `profiles.select`

- Propósito: recuperar el perfil del usuario autenticado.
- Request observado: `select('*').eq('id', userId).single()`.
- Response: fila tipada/casteada como `Profile` o error; un error deja `profile` en `null`.
- Fuente: `src/features/auth/AuthContext.tsx:27-45`; un perfil no activo o un fallo limpia también la caché.

### Leer tareas — `tasks.select` con relación de asignados

- Propósito: traer las tareas del tablero seleccionado, ordenadas por `position`, sus perfiles asignados y el total de comentarios por tarea.
- Request observado: en paralelo, `.from('tasks').select(...)` filtra por `board_id`, ordena por `position` y expande `task_assignees(...)`; `.from('tasks_with_stats').select('id, comment_count')` filtra el mismo tablero. Las relaciones de asignados nulas se descartan.
- Response: filas transformadas a `TaskWithAssignees`; el cliente asocia `comment_count` por ID y lo convierte a `number` (`0` si no encuentra una fila de estadística). La vista también calcula `attachment_count`, pero esta lectura no lo solicita. Consultar [mapeo](03-mapping.md#tareas-y-asignados).
- Errores: el error de cualquiera de las dos consultas Supabase se lanza; TanStack Query lo expone a la pantalla.
- Fuente: `src/features/board/api.ts:5-35`, definición de la vista `supabase-schema.sql:425-433`.

### Crear tarea — RPC `create_task_with_assignees`

- Auth: `admin` o `usuario` activos; propietario derivado de `auth.uid()`, no del `createdBy` local del hook.
- Request: `{ p_board_id, p_title, p_description, p_status, p_priority, p_assignee_ids }`; descripción ausente → `null`; IDs deduplicados. SQL permite lista omitida por defecto `[]`.
- Response: objeto JSON de la tarea (`Task`), no incluye los perfiles de responsables; la query de tareas se invalida.
- Transacción: valida título/rol/estado, calcula posición con bloqueo por estado, inserta tarea y ejecuta `set_task_assignees`. Un error revierte ambas escrituras. Los adjuntos se suben **después**, fuera de esta transacción.
- Fuente: `src/features/board/api.ts:65-104`, `supabase/migrations/202610200001_task_assignments.sql:47-76`.

La firma incremental actual incluye `p_board_id` y exige acceso al tablero además del rol activo `admin`/`usuario`; posición se calcula dentro del tablero y estado (`supabase/migrations/202610210001_boards.sql:94-112`).

### Trasladar una tarea — RPC `move_task_to_board`

- Request: `{ p_task_id, p_board_id }`; operación transaccional, no inserta una segunda tarea.
- Auth: cuenta activa con acceso al tablero actual y al de destino. Conserva estado, prioridad, descripción y relaciones; calcula posición al final de la columna correspondiente del destino. RLS impide la mutación directa de `board_id`.
- Destino inactivo: `can_access_board` exige tablero activo para los miembros, de modo que un tablero desactivado no es un destino válido. La interfaz refuerza el filtro y solo ofrece tableros activos distintos del actual (`src/features/board/BoardPage.tsx:411`).
- Fuente: `src/features/boards/api.ts:93-110`, `supabase/migrations/202610210001_boards.sql:114-131`, `supabase/migrations/202610220002_board_lifecycle.sql:27-36`.

### Reemplazar responsables — RPC `set_task_assignees`

- Auth: cualquier cuenta activa, **incluido `invitado`**, sobre cualquier tarea de un tablero al que tenga acceso.
- Request: `{ p_task_id: UUID, p_assignee_ids: UUID[] }`; `[]` desasigna a todos. No admite lista nula ni IDs nulos; elimina duplicados.
- Response: `AssigneeProfile[]` en JSON, ordenados por nombre/ID. Actualiza la caché de tareas e invalida la query.
- Validación: destinos existentes y activos; permite conservar un destino inactivo si ya estaba asignado. Bloquea tarea y perfiles objetivo durante la transacción. Prevalece el último conjunto guardado, sin detección de conflicto de borradores.
- Permisos: no modifica título, descripción, propietario, estado ni prioridad. Escritura directa cliente en `task_assignees` revocada. La edición de esos campos de la tarea se rige por su propia policy y sus permisos por columna, no por esta RPC.
- Errores SQL: `42501` cuenta no autorizada; `22023` lista/destino inválido; `P0002` tarea inexistente. El SDK los propaga; la UI conserva el borrador y presenta un mensaje seguro.
- Fuente: `src/features/board/api.ts:106-123`, `supabase/migrations/202610200001_task_assignments.sql:5-45`.

### Usuarios asignables — `profiles.select`

- Auth: cuenta activa con acceso por RLS; no requiere ser administrador ni invocar `admin-users`.
- Selección: `id, full_name, email, avatar_url, role, is_active`, filtrada por `is_active = true`, ordenada por `full_name`/`id`.
- Paginación: rangos de 500 hasta recibir una página menor; devuelve `AssigneeProfile[]`. Query `['assignable-users']`, habilitada al abrir creación/detalle, `staleTime: 0`.
- Fuente: `src/features/board/assigneesApi.ts:5-20`.

### Actualizar tarea — `tasks.update`

- Propósito: cambiar título, descripción, estado y prioridad.
- Auth: cualquier cuenta autenticada activa, **incluido `invitado`**, sobre cualquier tarea de un tablero accesible; no se limita a la tarea creada por el actor.
- Request observado: `taskId` y esos campos; filtro por `id`.
- Columnas escribibles: solo `title`, `description`, `status`, `priority` y `position`. `created_by` no es escribible desde el cliente.
- Response: no se consume fila; la query `tasks` se invalida al completar.
- Errores: si la migración `202610200002_shared_task_editing.sql` no está aplicada en el proyecto, la base de datos rechaza la escritura con un error de RLS; la UI conserva el borrador y muestra un mensaje seguro.
- Fuente: `src/features/board/api.ts:125-153`, `supabase/migrations/202610200002_shared_task_editing.sql:1-19`.

### Cambiar estado/posición — `tasks.update`

- Propósito: actualizar estado y posición de una tarea al moverla entre columnas.
- Auth: cualquier cuenta autenticada activa, sobre cualquier tarea de un tablero accesible.
- Request observado: `taskId`, `status`, `position`; filtro por `id`.
- Response: sin fila de respuesta consumida; invalidación de `tasks`.
- Fuente: `src/features/board/api.ts:47-63`.

### Reordenar posiciones — varias operaciones `tasks.update`

- Propósito: persistir la nueva posición de una lista de tareas.
- Auth: cualquier cuenta autenticada activa.
- Request observado: arreglo `{ taskId, position }`; ejecuta una actualización por elemento usando `Promise.all`.
- Response: no hay transacción explícita; se invalidan las tareas al completar.
- Fuente: `src/features/board/api.ts:173-193`.

### Eliminar tarea — `tasks.delete`

- Propósito: borrar una tarea por `id`.
- Auth: el creador de la tarea o un `admin`. La edición compartida no amplía este permiso.
- Response: no se consume fila; error se lanza.
- Fuente: `src/features/board/api.ts:155-170`, `supabase/migrations/202610200002_shared_task_editing.sql:16-18`.

### Leer / crear / eliminar comentarios — `comments`

- Lectura: filtra por `task_id`, ordena por `created_at` ascendente y proyecta `author` desde `profiles` (`src/features/board/commentsApi.ts:5-24`).
- Creación: inserta `task_id`, `author_id` y `body`, devuelve la fila insertada (`src/features/board/commentsApi.ts:27-57`).
- Eliminación: borra por `id` (`src/features/board/commentsApi.ts:59-74`).
- Caché: tras crear se invalidan `['comments', taskId]` y `['tasks']`; tras eliminar, `['comments']` y `['tasks']`, para actualizar el detalle y los conteos de las tarjetas (`src/features/board/commentsApi.ts:53-75`).
- Errores: errores de consulta/mutación se lanzan; no existe DTO común de error.

### Leer adjuntos — `task_attachments.select`

- Propósito: consultar metadatos por `task_id`, ordenados por fecha ascendente.
- Response: metadata como `TaskAttachment`; por archivo se deriva el path de `file_url` y se emite URL firmada de 60 segundos. La lectura queda limitada por acceso al tablero de la tarea.
- Fuente: `src/features/board/attachmentsApi.ts:11-27`.

## Storage vía Supabase

### Subir adjunto — bucket `task-attachments`

- Secuencia observada: path `<taskId>/<UUID>.<extensión segura>`; `storage.upload`; genera `getPublicUrl` para persistir la referencia de metadata. El bucket es privado; la interfaz obtiene URL firmada al consultar el archivo.
- Metadata insertada: `task_id`, `uploaded_by`, nombre original, URL, tamaño y MIME.
- Request de Storage: opciones `cacheControl: '3600'` y `upsert: false`.
- Fuente: `src/features/board/attachmentsApi.ts:98-147`.
- El trigger SQL exige que una nueva referencia de metadata apunte a un path dentro del directorio UUID de su tarea. El borrado comprueba errores de Storage antes de eliminar metadata.

### Eliminar adjunto — Storage y `task_attachments.delete`

- Secuencia observada: extrae el último segmento de `fileUrl`, intenta quitar ese objeto del bucket y después borra metadata por `id`.
- Response: se consulta el error al borrar metadata; el resultado de borrar el objeto no se valida explícitamente.
- Fuente: `src/features/board/attachmentsApi.ts:150-172`.

### Miniaturas — URLs firmadas de `task-attachments`

Consulta metadata por IDs de tareas, filtra MIME `image/`, firma rutas por 60 segundos y agrupa `{ id, fileName, signedUrl }` por tarea. La query se refresca cada 45 segundos; los enlaces de detalle también usan firmas breves. La referencia persistida sigue construida con `getPublicUrl` aunque el bucket sea privado; ver D-02. Fuente: `src/features/board/attachmentsApi.ts:30-103`.

## Edge Function — `admin-users`

Cliente: `supabase.functions.invoke('admin-users', { body })`, POST con bearer de sesión. La función verifica `auth.getUser` y exige perfil `admin` activo **antes de todas las acciones**; la clave privilegiada solo existe en servidor (`src/features/users/api.ts:11-28`, `supabase/functions/admin-users/index.ts:13-32`).

| `body.action` | Campos de entrada | Respuesta correcta | Efecto |
| --- | --- | --- | --- |
| `list` | `page` entero 1–100000, por defecto 1 | `{ users: ManagedUser[], total, pageSize: 50 }` | Perfiles ordenados por fecha descendente/ID |
| `create` | `fullName`, `email`, `password` | `{ success: true }` | Auth con correo confirmado, perfil `usuario` activo; intenta compensación si falla perfil |
| `rename` | `userId`, `fullName` | `{ success: true }` | Solo `profiles.full_name`; no sincroniza metadata Auth |
| `password` | `userId`, `password` | `{ success: true }` | Establece contraseña con API administrativa; no promete invalidar sesiones existentes |
| `set-active` | `userId`, `active: boolean` | `{ success: true }` | Solo `profiles.is_active`; prohíbe desactivación propia y conserva datos |
| `promote-admin` | `userId` UUID | `{ success: true }` | Asigna `profiles.role = 'admin'`; no modifica `is_active` ni ofrece degradar roles |

Validación servidor: nombre recortado 1–120 caracteres; email validado, recortado y en minúsculas para alta; contraseña 8–128 caracteres más política de Auth; `userId` UUID. Solo un administrador activo puede ejecutar acciones; `promote-admin` acepta cualquier cuenta no administradora, activa o inactiva, y fija el rol en servidor, sin aceptar `role` ni `is_active` como valores del cliente. Propiedades extra se ignoran. Respuesta de error `{ error: string }`: 400 payload/operación o cuenta objetivo no actualizable, 401 sesión, 403 rol/estado, 405 método, 500 fallo interno/compensación/listado. `Cache-Control: no-store`; OPTIONS soportado. El cliente intenta leer el error JSON de `FunctionsHttpError.context` y usa fallback seguro en fallos de red/gateway (`supabase/functions/admin-users/validation.ts:8-34`, `supabase/functions/admin-users/index.ts:24-32,68-80`, `src/features/users/api.ts:11-24`).

## Límites del catálogo

- Las rutas HTTP internas de Supabase, límites de tamaño configurados en el servicio, respuestas exactas de Auth y estado de despliegue del proyecto Supabase no son verificables desde este repositorio.
- Administración usa páginas de 50 y usuarios asignables lotes de 500. Tareas/comentarios/adjuntos continúan sin paginación explícita. El catálogo no certifica rate limits ni configuración remota actual; conserva la evidencia previa de despliegue descrita en el README de este dominio.
- Las tres RPCs de ciclo de vida (`list_boards_with_pending_counts`, `rename_board`, `set_board_active`) y la columna `boards.is_active` **están aplicadas en el proyecto Supabase remoto** desde el 2026-10-22 (`202610220001` y `202610220002`, en ese orden), y las tres suites SQL remotas pasan con fixtures revertidos con `ROLLBACK`. En una instalación donde falte la migración, el listado por RPC falla y el selector queda en error con reintento. La SPA compatible **ya está publicada en GitHub Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`).
