# Convenciones de acceso a datos

## Autenticación y autorización

- La app inicializa un único cliente de Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase.ts:1-10`).
- `AuthProvider` hidrata sesión, escucha cambios y consulta perfil. Descarta respuestas de otra identidad y refresca cada 30 s/al recuperar foco; el login usa `signInWithPassword`. Ya no hay `signUp` cliente (`src/features/auth/AuthContext.tsx:27-98`, `src/features/auth/LoginPage.tsx:12-27`).
- Las altas usan Edge Function con `auth.admin.createUser`, correo confirmado y rol `usuario` forzado; el registro público se deshabilita por configuración. `verify_jwt = false` del gateway se compensa con `auth.getUser` y comprobación de admin activo dentro de la función (`supabase/functions/admin-users/index.ts:17-50`, `supabase/config.toml`).
- `promote-admin` es una acción específica de `admin-users`: exige admin activo, fija el rol del perfil objetivo a `admin` y no cambia su estado `is_active`; admite cuentas `usuario` o `invitado`, activas o inactivas. La autorización se verifica en servidor, no por la visibilidad del botón (`supabase/functions/admin-users/index.ts:24-28,68-72`, `src/features/users/UsersPage.tsx:47-48,113`).
- RLS/grants protegen operaciones directas; Edge/RPC verifican además permisos antes de usar privilegios servidor. Ocultar controles no sustituye esas reglas. Un invitado activo puede gestionar asignaciones, editar y mover cualquier tarea dentro de un tablero accesible, pero no crear tareas. La edición compartida se aplica por permisos de columna, mientras `created_by` permanece fuera del alcance de escritura del cliente (`supabase/migrations/202610200001_task_assignments.sql:7-76`, `supabase/migrations/202610200002_shared_task_editing.sql:1-19`, `supabase/migrations/202610210001_boards.sql:51-59`).
- El catálogo de tableros lo filtra RLS: admin activo ve todos (activos y desactivados); usuario/invitado solo los tableros **activos** de los que es miembro. Las asignaciones a tareas no conceden pertenencia al tablero. Crear tableros, renombrarlos, activarlos/desactivarlos y sustituir miembros se reserva a admin; las mutaciones de tarea validan membresía en el servidor (`supabase/migrations/202610210001_boards.sql:24-80`, `supabase/migrations/202610220002_board_lifecycle.sql:40-66`).
- El apagado de un tablero no es una revocación de identidad: solo retira el acceso de sus miembros. El admin activo conserva el acceso, las membresías no se borran y los JWT no se invalidan (`supabase/migrations/202610220002_board_lifecycle.sql:5,27-36`).
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
- La sección «Tableros desactivados» se deriva en cliente de `is_active` sobre el mismo resultado de la query; no hay una segunda consulta para los tableros inactivos (`src/features/boards/BoardsPage.tsx:19-20,32-35`).
- Los destinos de traslado se filtran por `board.is_active` antes de ofrecerse, además de la comprobación del servidor en `move_task_to_board` (`src/features/board/BoardPage.tsx:411`).
- Tras un traslado se eliminan cachés de comentarios/adjuntos/miniaturas y se invalidan tareas; se valida el nuevo tablero en el servidor (`src/features/boards/api.ts:102-108`).
- Usuarios asignables y administración usan `staleTime: 0`; adjuntos y miniaturas emiten URLs firmadas de 60 segundos y refrescan cada 45 segundos. No se observó sincronización Realtime.

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
| Cualquier otro | Mensaje genérico que añade el código del error |

- `retry: 1` aplica al comportamiento de queries de TanStack Query; no se encontró timeout explícito ni retry propio del cliente Supabase (`src/App.tsx:10-17`, `src/lib/supabase.ts:1-10`).
- No se encontró paginación en las lecturas de tareas, comentarios o adjuntos revisadas.
- Administración pagina de 50 en 50; usuarios asignables se recuperan en lotes de 500 y se filtran por nombre/correo en cliente (`supabase/functions/admin-users/index.ts:34-41`, `src/features/board/assigneesApi.ts:5-15`).
- Las respuestas de Edge usan `{ error: string }`; el cliente extrae JSON del error HTTP o muestra fallback de conexión. No devuelve contraseñas ni errores internos en crudo. Las RPC propagan el error del SDK y la UI conserva borrador con mensaje seguro (`src/features/users/api.ts:11-24`, `supabase/functions/admin-users/index.ts:73-75`).
- El upload en UI rechaza archivos mayores a 5 MiB; el bootstrap crea el bucket sin configurar `file_size_limit`. No asumir enforcement servidor del límite de cliente (`src/features/board/CreateTaskModal.tsx`, `src/features/board/TaskDetailModal.tsx`, `supabase-schema.sql:345-357`).

## Nombres, versiones y serialización

- Estados, prioridades y roles se representan como uniones TypeScript y enums Postgres; deben mantenerse alineados (`src/types/index.ts:1-5`, `supabase-schema.sql:10-14`).
- No se documenta una estrategia de versionado de API ni un mapeo/validación runtime general.
- Los adjuntos nuevos generan path `<taskId>/<UUID>.<extensión segura>` y almacenan metadata; el trigger verifica que el objeto pertenezca a la tarea y el borrado comprueba error. La lectura resuelve también referencias flat-path preexistentes. D-02 conserva una discrepancia entre URL almacenada y bucket privado (`src/features/board/attachmentsApi.ts`, `supabase/migrations/202610210001_boards.sql:133-172`).
- Nombre administrativo 1–120 caracteres tras `trim`; contraseña 8–128 más política de Auth; email normalizado a minúsculas en alta. `rename` no modifica metadata de Auth. Los responsables se envían como UUIDs deduplicados; conjunto vacío significa retirar todos y no un error (`supabase/functions/admin-users/validation.ts:16-31`, `src/features/board/api.ts:94-112`).
