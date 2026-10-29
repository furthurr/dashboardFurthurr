# Convenciones de acceso a datos

## Autenticación y autorización

### Clientes MCP remotos

- El endpoint MCP usa Streamable HTTP y Supabase Auth OAuth 2.1 Authorization Code
  + PKCE/DCR. Cada herramienta recibe Bearer por header; no se aceptan tokens de
  sesión del portal, query-string ni token passthrough (`supabase/functions/mcp/index.ts:106-145`).
- El 401 incluye `WWW-Authenticate` con la URL de Protected Resource Metadata y
  scopes mínimos `email profile`. Son scopes OIDC de identidad, no permisos de
  Postgres. La autorización de datos se impone mediante `role=mcp_identity`, la
  audiencia exacta del recurso y `mcp_whoami()` (`supabase/functions/mcp/index.ts:50-53,129-150`,
  `supabase/migrations/202610280002_mcp_identity.sql:23-74`).
- `mcp_identity` no hereda `authenticated`/`service_role` ni recibe grants directos
  de tablas/vistas/Storage. El código local concede solo `mcp_whoami()`, consulta de
  tarea/adjunto y el RPC allowlist de workflow; no puede gestionar permisos. Cuentas
  inactivas, sesiones revocadas y claims/client/audiencia no coincidentes se rechazan.
  `admin-users` también rechaza claims OAuth después de verificar la firma del token.
- OAuth Server/DCR de Supabase está en beta; el cliente DCR declara su propio nombre
  y callback, lo que no prueba que sea confiable. La UI muestra esos valores y exige
  consentimiento; no se activa `autoApprove` en los presets. El usuario puede
  revocar grants desde el portal.
- `whoami` devuelve PII de identidad. `get_task` añade texto privado, nombres/IDs y
  enlaces temporales. En el código local todas las herramientas de tarea requieren
  asignación —también admin—, acceso previo al tablero y estado `backlog`, `por_hacer`
  o `haciendo`; membresía explícita sigue siendo necesaria para no admin. El contenido
  de tarea/comentarios/adjuntos es dato no confiable, no instrucciones.
- En el código local una aceptación OAuth conjunta autoriza lectura, adjuntos, inicio,
  comentario y revisión. Perfil → Conexiones solo muestra/retira permisos; no habilita
  permisos. Consentimientos de grants antiguos no se amplían silenciosamente: pueden
  conservar identidad y acceso legado de lectura, pero escritura requiere aceptación
  ampliada. Retirar permisos no revoca `whoami`; revocar grant invalida sesiones.
  `202610290001` no se ha confirmado aplicada remotamente.
- `read_task_attachment` descarga desde Storage solo en Edge después de autorización;
  máximo 5 MiB, timeout 15 s, sin redirects/hosts externos. Texto UTF-8/código por
  fragmentos e imágenes PNG/JPEG/GIF/WebP como contenido MCP visual. PDF y otros
  formatos no se extraen; un enlace temporal no equivale a archivo estudiado. Enlaces
  emitidos/contenido recibido no se revocan retroactivamente.
- El SQL local permite backlog/por_hacer → haciendo y haciendo → en_revision; no hay
  acción MCP para finalizadas, asignación o reapertura. Los flags de aprobación son
  declaraciones del cliente, no prueba verificable de conversación. El comentario
  MCP registra resultado, aclaraciones, validaciones declaradas y observaciones.
- Fuentes: `supabase/functions/mcp/index.ts:145-203`, `supabase/functions/mcp/workflow.ts:4-122`,
  `202610280003_mcp_task_read.sql:63-116`, `202610290001_mcp_workflow.sql:15-294`.
- En Supabase, aplicar únicamente migraciones pendientes verificadas. El proyecto
  remoto consultado tenía un ledger incompleto respecto a objetos observados; la
  reconciliación se documenta en `supabase/README.md` antes de cualquier `db push`.

- La app inicializa un único cliente de Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase.ts:1-10`).
- `AuthProvider` hidrata sesión, escucha cambios y consulta perfil. Descarta respuestas de otra identidad y refresca cada 30 s/al recuperar foco; el login usa `signInWithPassword`. Ya no hay `signUp` cliente (`src/features/auth/AuthContext.tsx:27-98`, `src/features/auth/LoginPage.tsx:12-27`).
- Las altas usan Edge Function con `auth.admin.createUser`, correo confirmado y rol `usuario` forzado; el registro público se deshabilita por configuración. `verify_jwt = false` del gateway se compensa con `auth.getUser` y comprobación de admin activo dentro de la función (`supabase/functions/admin-users/index.ts:17-50`, `supabase/config.toml`).
- `promote-admin` es una acción específica de `admin-users`: exige admin activo, fija el rol del perfil objetivo a `admin` y no cambia su estado `is_active`; admite cuentas `usuario` o `invitado`, activas o inactivas. La autorización se verifica en servidor, no por la visibilidad del botón (`supabase/functions/admin-users/index.ts:24-28,68-72`, `src/features/users/UsersPage.tsx:47-48,113`).
- RLS/grants protegen operaciones directas; Edge/RPC verifican además permisos antes de usar privilegios servidor. Ocultar controles no sustituye esas reglas. Un invitado activo puede gestionar asignaciones, editar y mover cualquier tarea dentro de un tablero accesible, pero no crear tareas. La edición compartida se aplica por permisos de columna, mientras `created_by` permanece fuera del alcance de escritura del cliente (`supabase/migrations/202610200001_task_assignments.sql:7-76`, `supabase/migrations/202610200002_shared_task_editing.sql:1-19`, `supabase/migrations/202610210001_boards.sql:51-59`).
- El catálogo del portal local permite admin activo o tablero activo con membresía
  **o asignación** (`supabase/migrations/202610280001_board_assignment_access.sql:4-42,73-83`).
  Asignar no crea una membresía, pero sí puede conceder acceso en el portal.
  Las RPCs de tareas validan acceso en servidor; la consulta MCP conserva su regla
  más estricta de membresía. Administrar tableros y miembros sigue reservado a admin.
- El apagado de un tablero no es una revocación de identidad: solo retira el acceso de sus miembros. El admin activo conserva el acceso, las membresías no se borran y los JWT no se invalidan (`supabase/migrations/202610220002_board_lifecycle.sql:5,27-36`).
- El borrado permanente es otra operación: solo acepta tableros ya desactivados y elimina primero los objetos de Storage desde cliente; la RPC repite la comprobación de admin/estado y borra las filas relacionales en PostgreSQL. Las dos fases no son atómicas (`src/features/boards/api.ts:101-131`, `supabase/migrations/202610260002_delete_inactive_boards.sql:5-21`).
- Avatares: una cuenta puede cambiar el propio y la UI admin permite cambiar otros; el servidor Storage permite escribir solo al propietario o admin activo. La lectura es pública; el bucket local limita MIME a JPEG/PNG/WebP y tamaño a 2 MiB (`src/features/users/avatarApi.ts:3-35`, `supabase/migrations/202610260003_profile_avatars.sql:5-50`).
- Las cuentas activas ya existentes se asignan inicialmente a `Offline`; `General` queda vacío. Cuentas nuevas no reciben membresías automáticamente. Un traslado requiere acceso a origen y destino, y el acceso a comments/attachments sigue al tablero actual de la tarea.

## Caché y consistencia

- `QueryClient` usa `staleTime = 5 minutos` y `retry = 1` por defecto (`src/App.tsx:10-17`).
- Claves: `['boards']`, `['board-members', boardId]`, `['tasks', boardId]`, `['comments', taskId]`, `['attachments', taskId]`, `['task-image-previews', idsNormalizados]`, `['assignable-users']` y `['admin-users', page]` (`src/features/boards/api.ts`, `src/features/board/api.ts:38-45`).
- Las mutaciones invalidan las consultas relacionadas tras éxito. La actualización de posiciones emite múltiples updates en paralelo; no se observa transacción (`src/features/board/api.ts:173-193`).
- El tablero aplica estado optimista al mover tareas y limpia la proyección tras éxito o error (`src/features/board/BoardPage.tsx:128-147`).
- Guardar responsables sustituye `assignees` en la caché y luego invalida tareas. Crear tarea y responsables es una transacción SQL; los adjuntos siguen siendo operaciones posteriores con recuperación de fallo parcial. Cambiar de identidad/perder acceso limpia la caché (`src/features/board/api.ts:76-123`, `src/features/auth/AuthContext.tsx:35-65`).
- Crear un comentario invalida `['comments', taskId]` y `['tasks']`; eliminarlo invalida `['comments']` y `['tasks']`, de modo que el detalle y `comment_count` de las tarjetas se refrescan desde Supabase (`src/features/board/commentsApi.ts:53-75`).
- El catálogo de tableros se consulta por RPC (`list_boards_with_pending_counts`), no con un `select` directo: la RPC replica la visibilidad de RLS y añade el conteo de pendientes. La query usa `staleTime: 0` y refresca cada 30 segundos (`src/features/boards/api.ts:20-22`).
- Crear, renombrar y activar/desactivar un tablero invalidan la clave `['boards']` tras el éxito, de modo que el listado se recalcula con los valores nuevos del servidor (`src/features/boards/api.ts:24-60`).
- Eliminar un tablero elimina las cachés de sus tareas, comentarios, adjuntos y miniaturas, e invalida `['boards']` tras completarse Storage y la RPC (`src/features/boards/api.ts:135-145`).
- La sección «Tableros desactivados» se deriva en cliente de `is_active` sobre el mismo resultado de la query; no hay una segunda consulta para los tableros inactivos (`src/features/boards/BoardsPage.tsx:19-20,32-35`).
- Los destinos de traslado se filtran por `board.is_active` antes de ofrecerse, además de la comprobación del servidor en `move_task_to_board` (`src/features/board/BoardPage.tsx:411`).
- Tras un traslado se eliminan cachés de comentarios/adjuntos/miniaturas y se invalidan tareas; se valida el nuevo tablero en el servidor (`src/features/boards/api.ts:102-108`).
- Usuarios asignables y administración usan `staleTime: 0`; adjuntos y miniaturas emiten URLs firmadas de 60 segundos y refrescan cada 45 segundos. No se observó sincronización Realtime.
- Al cargar el avatar propio, `AccountMenu` actualiza el perfil de Auth; al cambiar el de otra cuenta, `UsersPage` invalida las queries `admin-users`, `tasks`, `comments` y `assignable-users` para refrescar las proyecciones (`src/shared/ui/AccountMenu.tsx:29-39`, `src/features/users/UsersPage.tsx:65-74`).

## Errores, reintentos y límites

- Las funciones de datos lanzan directamente el error de Supabase (`src/features/board/api.ts:21-22`, `src/features/board/commentsApi.ts:15`, `src/features/board/attachmentsApi.ts:12`). No hay un formato de error API compartido.
- El selector de tableros es la excepción: `describeBoardError` traduce el código de Postgres a un mensaje en lenguaje claro y comparte esa traducción entre alta y actualización (`src/features/boards/BoardsPage.tsx:72-91`):

| Código/estado SQL | Significado en la interfaz |
| --- | --- |
| `23505` | Ya existe un tablero con ese nombre (índice único `lower(name)`) |
| `42501` / HTTP 403 | Supabase rechazó la operación por permisos (falta rol admin activo) |
| HTTP 401 | Sesión caducada |
| `22023` / `23514` | El nombre no cumple la regla de 1–120 caracteres sin espacios exteriores |
| `P0002` | El tablero ya no existe |
| `55000` | Solo se pueden eliminar tableros desactivados |
| `BOARD_ATTACHMENT_PATH_INVALID` | No se pudo identificar el path de un adjunto; no se inicia el borrado de Storage |
| `BOARD_ATTACHMENTS_DELETE_FAILED` | Falló la eliminación de objetos de Storage; la RPC no se invoca |
| `BOARD_DELETE_FAILED_AFTER_STORAGE` | La limpieza de Storage terminó, pero falló el borrado SQL del tablero |
| Cualquier otro | Mensaje genérico que añade el código del error |

- `retry: 1` aplica al comportamiento de queries de TanStack Query; no se encontró timeout explícito ni retry propio del cliente Supabase (`src/App.tsx:10-17`, `src/lib/supabase.ts:1-10`).
- Las lecturas del portal de tareas/comentarios/adjuntos no tienen paginación general.
  `get_task` sí pagina comentarios y adjuntos por separado: 50 por defecto, 1–100,
  `offset` y `next_offset` por colección; orden `created_at,id`. No hay snapshot entre
  peticiones: cambios concurrentes pueden desplazar resultados. [Contrato](01-endpoints.md).
- MCP usa `Cache-Control: no-store`, timeout de 10 s por fetch RPC y sin retry propio.
  La firma de listas se procesa en lotes de cinco; tras 15 s no inicia nuevas firmas.
  `read_task_attachment` descarga como máximo 5 MiB, con stream limitado, timeout
  15 s y sin seguir redirects. No se afirma que su descarga real remota esté probada.
  Fuentes: `supabase/functions/mcp/task.ts:41-92`, `workflow.ts:28-50`.
- Administración pagina de 50 en 50; usuarios asignables se recuperan en lotes de 500 y se filtran por nombre/correo en cliente (`supabase/functions/admin-users/index.ts:34-41`, `src/features/board/assigneesApi.ts:5-15`).
- Las respuestas de Edge usan `{ error: string }`; el cliente extrae JSON del error HTTP o muestra fallback de conexión. No devuelve contraseñas ni errores internos en crudo. Las RPC propagan el error del SDK y la UI conserva borrador con mensaje seguro (`src/features/users/api.ts:11-24`, `supabase/functions/admin-users/index.ts:73-75`).
- El upload de adjuntos en UI rechaza archivos mayores a 5 MiB; el bucket `task-attachments` no declara `file_size_limit` en el bootstrap, así que no asumir enforcement servidor de ese máximo (`src/features/board/CreateTaskModal.tsx`, `src/features/board/TaskDetailModal.tsx`, `supabase-schema.sql:354-357`). Los avatares son distintos: el bucket `avatars` declara máximo 2 MiB y MIME permitidos en el bootstrap/migración (`supabase-schema.sql:348-352`, `supabase/migrations/202610260003_profile_avatars.sql:5-10`).

## Nombres, versiones y serialización

- Estados, prioridades y roles se representan como uniones TypeScript y enums Postgres; deben mantenerse alineados (`src/types/index.ts:1-5`, `supabase-schema.sql:10-14`).
- No hay una estrategia de versionado/validación runtime general del portal. El código
  MCP local anuncia `serverInfo.version=0.3.0` y valida DTOs con Zod; no confundir
  esa versión de aplicación con la versión numérica del despliegue Edge. La migración
  y código actuales no se han verificado desplegados.
- Los adjuntos nuevos generan path `<taskId>/<UUID>.<extensión segura>` y almacenan metadata; el trigger verifica que el objeto pertenezca a la tarea y el borrado comprueba error. La lectura resuelve también referencias flat-path preexistentes. D-02 conserva una discrepancia entre URL almacenada y bucket privado (`src/features/board/attachmentsApi.ts`, `supabase/migrations/202610210001_boards.sql:133-172`).
- Avatares usan el path fijo `<profile-id>/avatar` con reemplazo (`upsert`) y la URL pública queda en `profiles.avatar_url`; el archivo se limita a JPEG/PNG/WebP de hasta 2 MiB (`src/features/users/avatarApi.ts:3-35`).
- Nombre administrativo 1–120 caracteres tras `trim`; contraseña 8–128 más política de Auth; email normalizado a minúsculas en alta. `rename` no modifica metadata de Auth. Los responsables se envían como UUIDs deduplicados; conjunto vacío significa retirar todos y no un error (`supabase/functions/admin-users/validation.ts:16-31`, `src/features/board/api.ts:94-112`).
