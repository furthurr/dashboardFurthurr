# Despliegue de administración de usuarios

La SPA sigue alojada en GitHub Pages. Las operaciones privilegiadas se ejecutan en la Edge Function `admin-users`, nunca en el navegador.

## Instalación existente

1. Realiza una copia de seguridad y prueba primero en un proyecto de pruebas.
2. Ejecuta las migraciones pendientes en orden: `migrations/202610190001_user_administration.sql`, después `migrations/202610200001_task_assignments.sql` y por último `migrations/202610200002_shared_task_editing.sql`. No vuelvas a ejecutar el schema bootstrap en una instalación existente. Las cuentas existentes conservan su rol y quedan activas; las asignaciones existentes se conservan.
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
5. Publica la web con `npm run build` y el flujo habitual de GitHub Pages.

Para una instalación nueva, `../supabase-schema.sql` incluye el mismo endurecimiento; no hace falta aplicar además la migración.

## Contrato y comprobación manual

POST autenticado a `admin-users`, vía `supabase.functions.invoke`:

- `{ action: 'list', page: 1 }`: devuelve `users`, `total`, `pageSize` (50).
- `{ action: 'create', fullName, email, password }`: alta como `usuario`, activa y confirmada.
- `{ action: 'password', userId, password }`: establece contraseña (8–128 caracteres, además de la política de Supabase).
- `{ action: 'rename', userId, fullName }`: administrador activo actualiza solo el nombre en `profiles` (1–120 caracteres tras recortar espacios exteriores); no cambia metadata de Auth ni otros campos de la cuenta.
- `{ action: 'set-active', userId, active }`: cambia el estado; prohíbe desactivarse a sí mismo.
- Errores: `{ error: string }`, HTTP 400/401/403/405/500. No se devuelven secretos ni contraseñas.

Comprueba con cuentas separadas:

1. Un admin ve «Usuarios»; usuario e invitado no pueden abrir la ruta ni invocar la función (403).
2. Alta: la sesión del admin no cambia; la cuenta nueva entra inmediatamente sin correo.
3. Cambia la contraseña; la nueva permite entrar y la anterior no. Esto no promete revocar sesiones existentes.
4. Desactiva una cuenta ya conectada: con su JWT anterior, tareas, comentarios, asignaciones, vistas y Storage privado dejan de ser accesibles. La UI comprueba el perfil cada 30 segundos y al volver a la ventana. Reactiva y verifica el acceso.
5. Intenta cambiar `role` o `is_active` directamente con el cliente autenticado: debe ser rechazado por permisos de columnas.
6. Verifica que las tareas, comentarios y adjuntos del usuario desactivado se conservan.

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
