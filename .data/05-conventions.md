# Convenciones de acceso a datos

## Autenticación y autorización

- La app inicializa un único cliente de Supabase con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/supabase.ts:1-10`).
- `AuthProvider` usa `getSession`, `onAuthStateChange` y `signOut`; las pantallas usan `signInWithPassword` y `signUp` (`src/features/auth/AuthContext.tsx:38-67`, `src/features/auth/LoginPage.tsx:12-27`, `src/features/auth/RegisterPage.tsx:13-35`).
- Las queries se ejecutan desde el navegador. RLS y grants del SQL definen acceso a filas; la presencia de un control en UI no es sustituto de esas reglas (`supabase-schema.sql:161-168`, `supabase-schema.sql:438-468`).

## Caché y consistencia

- `QueryClient` usa `staleTime = 5 minutos` y `retry = 1` por defecto (`src/App.tsx:10-17`).
- Claves observadas: `['tasks']`, `['comments', taskId]` y `['attachments', taskId]` (`src/features/board/api.ts:24-29`, `src/features/board/commentsApi.ts:19-24`, `src/features/board/attachmentsApi.ts:16-22`).
- Las mutaciones invalidan las consultas relacionadas tras éxito. La actualización de posiciones emite múltiples updates en paralelo; no se observa transacción (`src/features/board/api.ts:145-164`).
- El tablero aplica estado optimista al mover tareas y limpia la proyección tras éxito o error (`src/features/board/BoardPage.tsx:128-147`).

## Errores, reintentos y límites

- Las funciones de datos lanzan directamente el error de Supabase (`src/features/board/api.ts:14`, `src/features/board/commentsApi.ts:15`, `src/features/board/attachmentsApi.ts:12`). No hay un formato de error API compartido.
- `retry: 1` aplica al comportamiento de queries de TanStack Query; no se encontró timeout explícito ni retry propio del cliente Supabase (`src/App.tsx:10-17`, `src/lib/supabase.ts:1-10`).
- No se encontró paginación en las lecturas de tareas, comentarios o adjuntos revisadas.
- El upload en UI rechaza archivos mayores a 5 MiB (`src/features/board/TaskDetailModal.tsx:227-253`); el SQL crea el bucket sin configurar explícitamente un límite `file_size_limit` (`supabase-schema.sql:344-356`). No asumir que el límite de cliente sea enforcement de Storage.

## Nombres, versiones y serialización

- Estados, prioridades y roles se representan como uniones TypeScript y enums Postgres; deben mantenerse alineados (`src/types/index.ts:1-5`, `supabase-schema.sql:10-14`).
- No se documenta una estrategia de versionado de API ni un mapeo/validación runtime general.
- Los adjuntos generan una clave UUID con extensión original y almacenan metadatos en `task_attachments` (`src/features/board/attachmentsApi.ts:37-64`). El bucket/path debe mantenerse alineado con las policies de Storage; ver D-04.
