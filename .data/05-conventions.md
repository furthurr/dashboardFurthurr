# Convenciones de acceso a datos

## Autenticación y autorización

- La app inicializa un único cliente de Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase.ts:1-10`).
- `AuthProvider` hidrata sesión, escucha cambios y consulta perfil. Descarta respuestas de otra identidad y refresca cada 30 s/al recuperar foco; el login usa `signInWithPassword`. Ya no hay `signUp` cliente (`src/features/auth/AuthContext.tsx:27-98`, `src/features/auth/LoginPage.tsx:12-27`).
- Las altas usan Edge Function con `auth.admin.createUser`, correo confirmado y rol `usuario` forzado; el registro público se deshabilita por configuración. `verify_jwt = false` del gateway se compensa con `auth.getUser` y comprobación de admin activo dentro de la función (`supabase/functions/admin-users/index.ts:17-50`, `supabase/config.toml`).
- RLS/grants protegen operaciones directas; Edge/RPC verifican además permisos antes de usar privilegios servidor. Ocultar controles no sustituye esas reglas. Un invitado activo puede gestionar asignaciones por RPC, no crear tareas, y sí puede editar y mover cualquier tarea: la edición de campos es compartida y se aplica por permisos de columna, mientras `created_by` permanece fuera del alcance de escritura del cliente (`supabase/migrations/202610200001_task_assignments.sql:7-76`, `supabase/migrations/202610200002_shared_task_editing.sql:1-22`).

## Caché y consistencia

- `QueryClient` usa `staleTime = 5 minutos` y `retry = 1` por defecto (`src/App.tsx:10-17`).
- Claves: `['tasks']`, `['comments', taskId]`, `['attachments', taskId]`, `['task-image-previews', idsNormalizados]`, `['assignable-users']` y `['admin-users', page]` (`src/features/board/api.ts:24-29`, `src/features/board/assigneesApi.ts:18-20`, `src/features/board/attachmentsApi.ts:86-95`, `src/features/users/UsersPage.tsx`).
- Las mutaciones invalidan las consultas relacionadas tras éxito. La actualización de posiciones emite múltiples updates en paralelo; no se observa transacción (`src/features/board/api.ts:145-164`).
- El tablero aplica estado optimista al mover tareas y limpia la proyección tras éxito o error (`src/features/board/BoardPage.tsx:128-147`).
- Guardar responsables sustituye `assignees` en la caché y luego invalida tareas. Crear tarea y responsables es una transacción SQL; los adjuntos siguen siendo operaciones posteriores con recuperación de fallo parcial. Cambiar de identidad/perder acceso limpia la caché (`src/features/board/api.ts:76-102`, `src/features/auth/AuthContext.tsx:35-65`).
- Usuarios asignables y administración usan `staleTime: 0`; vistas previas de imágenes usan 50 minutos de stale/refresco para URLs firmadas de una hora. No se observó sincronización Realtime.

## Errores, reintentos y límites

- Las funciones de datos lanzan directamente el error de Supabase (`src/features/board/api.ts:14`, `src/features/board/commentsApi.ts:15`, `src/features/board/attachmentsApi.ts:12`). No hay un formato de error API compartido.
- `retry: 1` aplica al comportamiento de queries de TanStack Query; no se encontró timeout explícito ni retry propio del cliente Supabase (`src/App.tsx:10-17`, `src/lib/supabase.ts:1-10`).
- No se encontró paginación en las lecturas de tareas, comentarios o adjuntos revisadas.
- Administración pagina de 50 en 50; usuarios asignables se recuperan en lotes de 500 y se filtran por nombre/correo en cliente (`supabase/functions/admin-users/index.ts:34-41`, `src/features/board/assigneesApi.ts:5-15`).
- Las respuestas de Edge usan `{ error: string }`; el cliente extrae JSON del error HTTP o muestra fallback de conexión. No devuelve contraseñas ni errores internos en crudo. Las RPC propagan el error del SDK y la UI conserva borrador con mensaje seguro (`src/features/users/api.ts:11-24`, `supabase/functions/admin-users/index.ts:73-75`).
- El upload en UI rechaza archivos mayores a 5 MiB; el bootstrap crea el bucket sin configurar `file_size_limit`. No asumir enforcement servidor del límite de cliente (`src/features/board/CreateTaskModal.tsx`, `src/features/board/TaskDetailModal.tsx`, `supabase-schema.sql:345-357`).

## Nombres, versiones y serialización

- Estados, prioridades y roles se representan como uniones TypeScript y enums Postgres; deben mantenerse alineados (`src/types/index.ts:1-5`, `supabase-schema.sql:10-14`).
- No se documenta una estrategia de versionado de API ni un mapeo/validación runtime general.
- Los adjuntos generan clave UUID con extensión original y almacenan metadata; el bucket/path debe mantenerse alineado con las policies (D-04, `src/features/board/attachmentsApi.ts:111-138`).
- Nombre administrativo 1–120 caracteres tras `trim`; contraseña 8–128 más política de Auth; email normalizado a minúsculas en alta. `rename` no modifica metadata de Auth. Los responsables se envían como UUIDs deduplicados; conjunto vacío significa retirar todos y no un error (`supabase/functions/admin-users/validation.ts:16-31`, `src/features/board/api.ts:76-92`).
