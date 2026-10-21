# 05 - Auth, Roles Y Permisos

Estado: `aprobada`

Última actualización: 2026-10-20

## Archivo De Referencia

El esquema completo está en [`supabase-schema.sql`](../supabase-schema.sql). Las policies RLS están definidas ahí.

## Autenticación

Se usará Supabase Auth con correo y password.

El password no se guarda manualmente en tablas públicas. Supabase Auth se encarga del almacenamiento seguro.

## Perfil

Después del registro debe existir un registro relacionado en `profiles`.

Campos requeridos por producto:

- Nombre completo.
- Correo.
- Foto.
- Nick o alias.
- Tipo de usuario.

## Roles

Admin:

- Puede ver usuarios.
- Puede editar roles.
- Puede crear, editar y eliminar tareas.
- Puede crear y editar comentarios.
- Puede editar comentarios de otros usuarios.

Usuario:

- Puede ver tareas.
- Puede crear tareas.
- Puede editar cualquier tarea, propia o ajena.
- Puede crear comentarios.
- Puede editar solo sus comentarios.

Invitado:

- Puede ver tareas.
- Puede editar cualquier tarea, propia o ajena.
- No puede crear comentarios.
- No puede editar comentarios.
- No puede editar comentarios aunque sean propios, porque no puede crearlos.

## Decisiones Resueltas

- Cualquier cuenta autenticada y activa puede editar los campos de cualquier tarea, sea propia o ajena.
- Usuario puede eliminar tareas solo si es el creador o admin. El borrado no se amplía.
- La edición compartida no permite cambiar el creador de la tarea: `created_by` no es escribible desde el cliente.
- Invitado puede ver adjuntos (SELECT en task_attachments para authenticated).
- El administrador inicial se configura manualmente en Supabase.
- Las altas administrativas crean cuentas con rol `usuario`, activas y con correo confirmado, sin enlace de activación.

## Roles: Definición Formal

| Acción | Admin | Usuario | Invitado |
|---|---|---|---|
| Ver tareas | Sí | Sí | Sí |
| Crear tareas | Sí | Sí | No |
| Editar tareas propias | Sí | Sí | Sí |
| Editar tareas ajenas | Sí | Sí | Sí |
| Eliminar tareas propias | Sí | Sí | No |
| Eliminar tareas ajenas | Sí | No | No |
| Ver comentarios | Sí | Sí | Sí |
| Crear comentarios | Sí | Sí | No |
| Editar comentarios propios | Sí | Sí | No |
| Editar comentarios ajenos | Sí | No | No |
| Eliminar comentarios propios | Sí | Sí | No |
| Eliminar comentarios ajenos | Sí | No | No |
| Subir adjuntos | Sí | Sí | No |
| Ver adjuntos | Sí | Sí | Sí |
| Eliminar adjuntos propios | Sí | Sí | No |
| Eliminar adjuntos ajenos | Sí (de sus tareas) | No | No |
| Editar perfil propio | Sí | Sí | Sí |
| Editar roles de otros | Sí | No | No |
| Asignar/desasignar responsables de cualquier tarea | Sí | Sí | Sí |

## Asignaciones de tareas

- Cualquier cuenta autenticada y activa, incluido `invitado`, puede asignar y desasignar responsables de cualquier tarea, sin ser creadora ni administradora.
- Crear tareas mantiene los permisos actuales (`admin` y `usuario`). La tarea y sus responsables iniciales se guardan en una transacción.
- Se permite cero, uno o varios responsables; no se admiten duplicados ni nuevos responsables inexistentes o inactivos.
- Una asignación previa a una cuenta inactiva se conserva y puede retirarse. Desactivar cuentas no modifica asignaciones automáticamente.
- En el detalle, «Guardar asignaciones» es independiente del guardado de los demás campos. No amplía permisos de eliminación de tareas.
- Las escrituras de asignaciones usan funciones Postgres autenticadas que comprueban el estado de la cuenta y bloquean la tarea durante la transacción; el cliente no puede escribir directamente en `task_assignees`.

## Edición compartida de tareas

- Cualquier cuenta autenticada y activa, incluidos `admin`, `usuario` e `invitado`, puede editar los campos de cualquier tarea: título, descripción, estado, prioridad y posición.
- La creación de tareas sigue reservada a `admin` y `usuario`; la edición compartida no amplía ese permiso.
- El borrado de tareas no se amplía: solo el creador o un `admin` pueden eliminar.
- La interfaz no oculta el campo de edición por rol ni por autoría: el detalle muestra los campos editables y «Guardar cambios» para cualquier cuenta activa.
- El cliente solo puede escribir `title`, `description`, `status`, `priority` y `position` en `tasks`. `created_by`, `created_at` y `updated_at` no son escribibles desde el cliente, de modo que nobody puede reclamar la propiedad de una tarea ajena para después eliminarla.
- El movimiento entre columnas y el reordenado comparten la misma regla: cualquier cuenta activa puede mover y reordenar cualquier tarea.
- La base de datos es la frontera efectiva de esta regla; la interfaz solo refleja el permiso y no lo restringe.

## Administración de usuarios

- La cabecera ofrece «Usuarios» únicamente a administradores activos; la ruta también está protegida.
- El listado muestra nombre, correo, rol y estado activo/inactivo.
- Los administradores activos pueden editar el nombre completo de cualquier cuenta desde «Editar nombre». Se precarga el nombre actual, se recortan espacios exteriores y se exige entre 1 y 120 caracteres. Esta acción solo modifica `profiles.full_name`, no el correo, rol, contraseña ni estado.
- Solo un administrador activo puede dar de alta cuentas, establecer una nueva contraseña o activar/desactivar cuentas mediante una Edge Function con autorización verificada en servidor.
- El alta solicita nombre, correo y contraseña; no cambia la sesión del administrador y no permite elegir roles.
- Cambiar contraseña no requiere la anterior ni un correo de recuperación. No se muestran ni almacenan contraseñas en la aplicación.
- Desactivar conserva cuentas y contenido, bloquea el acceso a la aplicación y a datos/Storage privados incluso con un token anterior. Reactivar restablece el acceso.
- Un administrador no puede desactivarse a sí mismo.
- El rol y el estado no son editables desde el cliente de tablas. No hay edición de roles en esta sección.
- El registro público de Supabase debe deshabilitarse en el despliegue; las cuentas se crean con la API administrativa.
