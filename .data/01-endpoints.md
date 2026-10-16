# Catálogo de operaciones de datos

No se encontró contrato OpenAPI ni un backend HTTP propio. La app llama a Supabase mediante `@supabase/supabase-js`; se listan los recursos y operaciones del SDK, no rutas HTTP ni URLs de proyecto inventadas. Los accesos a tablas requieren que los grants/RLS del servicio admitan la sesión, según la operación.

## Autenticación

### Iniciar sesión — `supabase.auth.signInWithPassword`

- Propósito: autenticar con email y contraseña.
- Auth: credenciales del usuario enviadas al SDK; la app recibe el resultado de Auth.
- Request observado: `{ email, password }`; no se documentan valores.
- Response: el componente solo consume `error`; la sesión se publica por `AuthContext`.
- Errores: error devuelto por Supabase Auth y mostrado como mensaje en la pantalla.
- Fuente: `src/features/auth/LoginPage.tsx:12-27`.

### Registro — `supabase.auth.signUp`

- Propósito: crear cuenta, pasando `full_name` como metadata de usuario.
- Auth: Supabase Auth.
- Request observado: `{ email, password, options.data.full_name }`.
- Response: el componente consume `error`; después navega a `/board`.
- Errores: error devuelto por Auth; se muestra en la pantalla.
- Fuente: `src/features/auth/RegisterPage.tsx:13-35`.

### Recuperación y cambios de sesión — `getSession` / `onAuthStateChange`

- Propósito: hidratar y mantener el estado de sesión del cliente.
- Request: no hay parámetros de negocio observados.
- Response consumida: `Session | null`; si hay usuario, se consulta `profiles`.
- Errores: `getSession` no tiene manejo explícito de error en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:16-63`.

### Cerrar sesión — `supabase.auth.signOut`

- Propósito: cerrar la sesión de Supabase.
- Request: no hay parámetros.
- Response: `AuthContext.signOut()` espera la promesa, pero no devuelve ni transforma el resultado.
- Errores: no hay manejo local explícito en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:65-67`.

## PostgreSQL vía Supabase

### Leer perfil — `profiles.select`

- Propósito: recuperar el perfil del usuario autenticado.
- Request observado: `select('*').eq('id', userId).single()`.
- Response: fila tipada/casteada como `Profile` o error; un error deja `profile` en `null`.
- Fuente: `src/features/auth/AuthContext.tsx:22-36`.

### Leer tareas — `tasks.select` con relación de asignados

- Propósito: traer tareas ordenadas por `position` y una proyección de perfiles asignados.
- Request observado: `.from('tasks').select(...)`, con `*` y la relación `task_assignees(profile_id, profiles(full_name, avatar_url, role))`; se ordena por `position`.
- Response: filas transformadas a `TaskWithAssignees`; consultar [mapeo](03-mapping.md#tareas-y-asignados).
- Errores: el error Supabase se lanza; TanStack Query lo expone a la pantalla.
- Fuente: `src/features/board/api.ts:5-29`.

### Crear tarea — `tasks.insert`

- Propósito: insertar una tarea y calcular posición siguiente para el estado elegido.
- Request observado: título, descripción opcional, estado, prioridad, `created_by` y posición calculada consultando el máximo existente.
- Response: fila insertada (`select().single()`); error se lanza.
- Fuente: `src/features/board/api.ts:49-94`.

### Actualizar tarea — `tasks.update`

- Propósito: cambiar título, descripción, estado y prioridad.
- Request observado: `taskId` y esos campos; filtro por `id`.
- Response: no se consume fila; la query `tasks` se invalida al completar.
- Fuente: `src/features/board/api.ts:97-125`.

### Cambiar estado/posición — `tasks.update`

- Propósito: actualizar estado y posición de una tarea al moverla entre columnas.
- Request observado: `taskId`, `status`, `position`; filtro por `id`.
- Response: sin fila de respuesta consumida; invalidación de `tasks`.
- Fuente: `src/features/board/api.ts:31-47`.

### Reordenar posiciones — varias operaciones `tasks.update`

- Propósito: persistir la nueva posición de una lista de tareas.
- Request observado: arreglo `{ taskId, position }`; ejecuta una actualización por elemento usando `Promise.all`.
- Response: no hay transacción explícita; se invalidan las tareas al completar.
- Fuente: `src/features/board/api.ts:145-164`.

### Eliminar tarea — `tasks.delete`

- Propósito: borrar una tarea por `id`.
- Response: no se consume fila; error se lanza.
- Fuente: `src/features/board/api.ts:127-143`.

### Leer / crear / eliminar comentarios — `comments`

- Lectura: filtra por `task_id`, ordena por `created_at` ascendente y proyecta `author` desde `profiles` (`src/features/board/commentsApi.ts:5-24`).
- Creación: inserta `task_id`, `author_id` y `body`, devuelve la fila insertada (`src/features/board/commentsApi.ts:27-57`).
- Eliminación: borra por `id` (`src/features/board/commentsApi.ts:59-74`).
- Errores: errores de consulta/mutación se lanzan; no existe DTO común de error.

### Leer adjuntos — `task_attachments.select`

- Propósito: consultar metadatos por `task_id`, ordenados por fecha ascendente.
- Response: filas como `TaskAttachment`.
- Fuente: `src/features/board/attachmentsApi.ts:5-22`.

## Storage vía Supabase

### Subir adjunto — bucket `task-attachments`

- Secuencia observada: nombre generado con `crypto.randomUUID()` más extensión; `storage.upload`; obtiene `getPublicUrl`; inserta metadata en `task_attachments`.
- Metadata insertada: `task_id`, `uploaded_by`, nombre original, URL, tamaño y MIME.
- Request de Storage: opciones `cacheControl: '3600'` y `upsert: false`.
- Fuente: `src/features/board/attachmentsApi.ts:24-72`.
- Nota: el bucket se crea con `public = false` (`supabase-schema.sql:353-356`); ver discrepancia D-02.

### Eliminar adjunto — Storage y `task_attachments.delete`

- Secuencia observada: extrae el último segmento de `fileUrl`, intenta quitar ese objeto del bucket y después borra metadata por `id`.
- Response: se consulta el error al borrar metadata; el resultado de borrar el objeto no se valida explícitamente.
- Fuente: `src/features/board/attachmentsApi.ts:75-95`.

## Límites del catálogo

- Las rutas HTTP internas de Supabase, límites de tamaño configurados en el servicio, respuestas exactas de Auth y estado de despliegue del proyecto Supabase no son verificables desde este repositorio.
- No se observó paginación en las lecturas listadas.
