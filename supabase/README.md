# Operación y despliegue de Supabase

La SPA sigue alojada en GitHub Pages. Las operaciones privilegiadas se ejecutan en la Edge Function `admin-users`, nunca en el navegador.

## Instalación existente

1. Realiza una copia de seguridad y prueba primero en un proyecto de pruebas.
2. Ejecuta las migraciones pendientes en orden: `migrations/202610190001_user_administration.sql`, `migrations/202610200001_task_assignments.sql`, `migrations/202610200002_shared_task_editing.sql`, `migrations/202610210001_boards.sql`, `migrations/202610220001_board_access_returning.sql` y `migrations/202610220002_board_lifecycle.sql`. No vuelvas a ejecutar el schema bootstrap en una instalación existente. Las tareas existentes se asignan al tablero `Offline`; las cuentas activas existentes se convierten en miembros de `Offline`; `General` inicia sin miembros. Revisa la política de asignación antes de aplicar en producción.
3. En Supabase Auth, deshabilita **Allow new users to sign up** (registro público). La API administrativa `createUser` continúa disponible. No es necesario desactivar globalmente la confirmación por correo: esta función usa `email_confirm: true` al crear cada cuenta.

   Alternativamente, con CLI **2.121.0** se puede revisar y aplicar el único ajuste declarado de Auth en `config.toml`, conservando las propiedades no declaradas:

   ```bash
   npx supabase@2.121.0 config diff --project-ref <project-ref>
   npx supabase@2.121.0 config push --project-ref <project-ref>
   ```
4. Despliega con la CLI de Supabase, autenticada y vinculada al proyecto correcto:

   ```bash
   supabase functions deploy admin-users
   ```

   `config.toml` desactiva únicamente la validación JWT del gateway de esta función: la función valida el bearer token con `auth.getUser` y exige un perfil `admin` activo antes de cualquier operación. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables del entorno de funciones de Supabase. **Nunca** las copies a variables `VITE_*` ni a la SPA.

   Estado del proyecto de producción (2026-10-22): `admin-users` está desplegada en la **versión 4, ACTIVE**, y el código descargado del remoto es **idéntico byte a byte** a `functions/admin-users/` del repositorio. La versión anterior (3) no contenía la acción `promote-admin`, por lo que «Hacer administrador» habría fallado; tras el redespliegue la función responde sin sesión con `401 {"error":"Inicia sesión para continuar."}`, es decir, valida el bearer en su propio código y no en el gateway. `supabase config diff` informa **0 cambios aplicables**: `auth.enable_signup` ya está deshabilitado en remoto y `functions list` confirma `verify_jwt: false`. Las diferencias que reporta el diff son propiedades solo remotas (site_url, correo, MFA, pooler, storage vector) que `config push` conservaría y que no requieren acción.
5. Publica la web con `npm run build` y el flujo habitual de GitHub Pages.

Para una instalación nueva, `../supabase-schema.sql` incluye el modelo de tableros y sus políticas; no apliques además las migraciones ya incluidas en el bootstrap.

### Tableros y acceso por membresía

`202610210001_boards.sql` crea `boards` y `board_members`, asigna las tareas/usuarios activos existentes a `Offline`, y crea `General` vacío. `202610220001_board_access_returning.sql` corrige la comprobación RLS usada al devolver la fila recién creada por PostgREST. `202610220002_board_lifecycle.sql` añade `boards.is_active`, las RPCs de renombrado y de activación, y el listado con tareas pendientes. Admin activo accede a todos los tableros, crea tableros y sustituye miembros; usuarios e invitados solo acceden a tableros donde sean miembros. Ser responsable de una tarea no concede acceso. Las cuentas nuevas no reciben membresías automáticamente.

### Ciclo de vida de los tableros

`202610220002_board_lifecycle.sql` añade `boards.is_active` (por defecto `true`) y tres RPCs:

- `rename_board(p_board_id, p_name)`: solo administrador activo. Recorta el nombre y exige entre 1 y 120 caracteres; el índice único sigue rechazando nombres duplicados (`23505`) y el nombre inválido devuelve `22023`.
- `set_board_active(p_board_id, p_active)`: solo administrador activo. Desactiva o reactiva un tablero **sin borrar** tareas, comentarios, adjuntos ni membresías.
- `list_boards_with_pending_counts()`: devuelve `id`, `name`, `is_active`, `created_at` y `pending_count` (tareas en `backlog`, `por_hacer` y `haciendo`). El administrador activo ve todos los tableros, incluidos los desactivados; las demás cuentas solo ven los tableros activos de los que son miembros.

Al desactivar un tablero, sus miembros dejan de verlo en el selector y de acceder a sus tareas (RLS), incluida la URL directa; el administrador activo conserva el acceso y puede reactivarlo. La policy de lectura de `boards` ya no llama a ninguna función que lea `boards`, para no reintroducir la recursión que corrigió `202610220001_board_access_returning.sql`; los miembros leen su propia fila de `board_members` mediante la policy «Members read own memberships».

RLS limita tareas, asignaciones, comentarios, metadata de adjuntos y Storage por tablero. Crear tarea exige rol admin/usuario activo y acceso al tablero; cambiar tablero usa `move_task_to_board`, exige acceso a origen y destino y actualiza la misma tarea conservando sus relaciones. La secuencia se aplicó en el proyecto Supabase seleccionado y los probes SQL remotos pasaron el 2026-10-21. El push y publicación de la SPA siguen pendientes.

`202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` se aplicaron en ese mismo proyecto el 2026-10-22, en ese orden. Después de aplicarlas se verificaron de nuevo las tres suites (`boards.sql`, `task_assignments.sql` y `user_access.sql`): las tres pasan y sus fixtures se revierten con `ROLLBACK`. El proyecto conserva sus 4 tableros y sus 32 tareas; la columna `is_active` se creó con `true` en todos ellos.

Las cargas nuevas usan path `<task-id>/<UUID>.<ext>`; las antiguas con path plano se resuelven desde metadata. El bucket de adjuntos permanece privado. La UI genera URLs firmadas de corta duración; accesos firmados ya emitidos o archivos descargados no se revocan retroactivamente.

Prueba transaccional con fixtures revertidos:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/boards.sql
```

Verificación local: `boards.sql`, `task_assignments.sql` y `user_access.sql` pasan contra PostgreSQL embebido con Auth/Storage simulados, bootstrap y secuencia incremental. Verificación remota: las mismas suites pasaron contra el proyecto Supabase seleccionado; cada fixture se revierte con `ROLLBACK`. Ninguna prueba es auditoría de seguridad completa ni valida otros entornos.

## Contrato y comprobación manual

POST autenticado a `admin-users`, vía `supabase.functions.invoke`:

- `{ action: 'list', page: 1 }`: devuelve `users`, `total`, `pageSize` (50).
- `{ action: 'create', fullName, email, password }`: alta como `usuario`, activa y confirmada.
- `{ action: 'password', userId, password }`: establece contraseña (8–128 caracteres, además de la política de Supabase).
- `{ action: 'rename', userId, fullName }`: administrador activo actualiza solo el nombre en `profiles` (1–120 caracteres tras recortar espacios exteriores); no cambia metadata de Auth ni otros campos de la cuenta.
- `{ action: 'set-active', userId, active }`: cambia el estado; prohíbe desactivarse a sí mismo.
- `{ action: 'promote-admin', userId }`: solo un administrador activo puede promover cualquier cuenta no administradora (`usuario` o `invitado`, activa o inactiva); fija `profiles.role = 'admin'` y conserva `is_active`. No existe acción de degradación.
- Errores: `{ error: string }`, HTTP 400/401/403/405/500. No se devuelven secretos ni contraseñas.

Comprueba con cuentas separadas:

Antes de publicar la nueva SPA, verifica además: admin ve Offline y General, usuario/invitado ve solo tableros asignados, asignar una tarea no añade membresía, miembro de ambos tableros traslada una sola tarea conservando sus relaciones, y la cuenta que no pertenece al destino recibe denegación. Al retirar una membresía, nuevas peticiones de tablas/Storage deben quedar denegadas.

Para el ciclo de vida de los tableros: en «Tableros», el administrador ve «Cambiar nombre», «Desactivar» y «Activar»; el tablero desactivado pasa a su propia sección, visible solo para administradores. Comprueba que un miembro deja de ver el tablero desactivado y que su URL directa responde «no tienes acceso»; que «Tareas pendientes» suma `backlog`, `por_hacer` y `haciendo`; y que una cuenta no administradora recibe denegación al invocar `rename_board` o `set_board_active` directamente.

1. Un admin ve «Usuarios»; usuario e invitado no pueden abrir la ruta ni invocar la función (403).
2. Alta: la sesión del admin no cambia; la cuenta nueva entra inmediatamente sin correo.
3. Cambia la contraseña; la nueva permite entrar y la anterior no. Esto no promete revocar sesiones existentes.
4. Desactiva una cuenta ya conectada: con su JWT anterior, tareas, comentarios, asignaciones, vistas y Storage privado dejan de ser accesibles. La UI comprueba el perfil cada 30 segundos y al volver a la ventana. Reactiva y verifica el acceso.
5. Intenta cambiar `role` o `is_active` directamente con el cliente autenticado: debe ser rechazado por permisos de columnas.
6. Verifica que las tareas, comentarios y adjuntos del usuario desactivado se conservan.
7. Desde «Usuarios», confirma la promoción de una cuenta `usuario` o `invitado`; verifica que el rol cambia a `admin`, que `is_active` no cambia y que una cuenta no administradora recibe 403 si intenta invocar directamente la operación. Re-despliega `admin-users` para que la acción nueva esté disponible en Supabase.

`is_active` es el estado de acceso a **esta plataforma**: no elimina el usuario de Auth ni invalida criptográficamente sus JWT. La protección inmediata es RLS, que consulta el estado en cada petición. El cliente autenticado puede leer su propio perfil inactivo para mostrar el bloqueo, pero no modificarlo. Los avatares del bucket público siguen siendo públicos; archivos ya descargados o URLs firmadas emitidas previamente no pueden retirarse retroactivamente mediante RLS.

La migración presupone las tablas y vistas del schema local. No certifica políticas adicionales, RPCs o buckets creados fuera del repositorio: revísalos en el proyecto desplegado antes de producción.

### Prueba SQL de permisos

`tests/user_access.sql` necesita al menos un administrador activo. Comprueba acceso activo, protección de columnas y bloqueo de lecturas/escrituras con una identidad inactiva, incluidas las vistas. Crea una tarea y desactiva temporalmente al administrador **solo dentro de una transacción que termina en `ROLLBACK`**; no deja datos de prueba ni cambios de estado persistentes.

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/user_access.sql
```

## Asignación múltiple de tareas

La migración `202610200001_task_assignments.sql` es necesaria antes de usar la nueva creación de tareas. Si la administración de usuarios ya está desplegada, aplica solamente esta migración pendiente. Esta característica usa funciones Postgres; no necesita otra Edge Function.

- `create_task_with_assignees(p_title, p_description, p_status, p_priority, p_assignee_ids)` devuelve una tarea JSON. Solo `admin` y `usuario` activos pueden crear; el propietario se obtiene de `auth.uid()`. La tarea y sus asignaciones se guardan juntas, sin tareas huérfanas si falla la validación.
- `set_task_assignees(p_task_id, p_assignee_ids)` reemplaza el conjunto completo de responsables y devuelve sus perfiles (`id`, `full_name`, `email`, `avatar_url`, `role`, `is_active`). Una lista vacía desasigna a todos. Puede usarla cualquier cuenta activa, **incluidos invitados**, en cualquier tarea.
- Ambas requieren sesión. Eliminan duplicados y rechazan IDs nulos/inexistentes o nuevos responsables inactivos. Una asignación previa a una cuenta inactiva puede conservarse o retirarse.
- Las escrituras directas del cliente a `task_assignees` están revocadas; no se amplían permisos para editar otros campos de tareas. Las sustituciones concurrentes se serializan bloqueando la tarea; prevalece el último conjunto guardado.
- La lista de usuarios activos se obtiene desde `profiles` con paginación y RLS; no requiere acceso a la función de administración de usuarios.

Prueba transaccional de permisos y consistencia, con cuentas/tareas de prueba que se revierten al terminar:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/task_assignments.sql
```

Comprobación manual: crea una tarea con varios responsables, quita uno y guarda las asignaciones en el detalle. Comprueba las iniciales en la tarjeta, reabre y desasigna a todos. Repite con usuario e invitado sobre una tarea ajena: deben poder guardar asignaciones y editar título, descripción, estado y prioridad, pero no eliminar la tarea. En el detalle, los responsables se guardan mediante «Guardar asignaciones», por separado del resto del borrador.

## Edición compartida de tareas

La migración `202610200002_shared_task_editing.sql` amplía la edición de tareas a cualquier cuenta activa. Si la administración de usuarios y las asignaciones ya están desplegadas, aplica solamente esta migración pendiente. No necesita otra Edge Function.

- Cualquier cuenta autenticada y activa, incluidos `admin`, `usuario` e `invitado`, puede editar `title`, `description`, `status`, `priority` y `position` de cualquier tarea y moverla o reordenarla.
- La creación de tareas sigue reservada a `admin` y `usuario`, y el borrado sigue reservado al creador o a un `admin`.
- La migración revoca el permiso de `UPDATE` sobre la tabla completa y concede permisos por columna. `created_by` deja de ser escribible desde el cliente, de modo que nadie puede reclamar una tarea ajena para después eliminarla.
- La policy restrictiva «Active account required» se mantiene: una cuenta desactivada no puede escribir tareas aunque tenga la sesión vigente.

Prueba transaccional de permisos y consistencia, con cuentas/tareas de prueba que se revierten al terminar:

```bash
npx supabase@2.121.0 db query --linked --project-ref <project-ref> --file supabase/tests/task_assignments.sql
```

Comprobación manual: con una cuenta `usuario` o `invitado`, abre una tarea creada por otra persona, cambia el título y guarda. El cambio debe persistir tras recargar. Comprueba que «Eliminar tarea» no aparece para esa cuenta y que sigue apareciendo para el creador y para un admin. Intenta cambiar `created_by` desde el cliente: debe ser rechazado por permisos de columnas.
