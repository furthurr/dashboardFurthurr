# 05 - Auth, Roles Y Permisos

Estado: `aprobada`

Última actualización: 2026-10-21

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
- Puede promover cuentas no administradoras a `admin` desde la administración de usuarios.
- Puede crear, editar y eliminar tareas en cualquier tablero; el borrado conserva sus reglas por creador.
- Puede crear y editar comentarios.
- Puede editar comentarios de otros usuarios.

Usuario:

- Puede ver tareas en tableros donde es miembro.
- Puede crear tareas en tableros donde es miembro.
- Puede editar tareas propias o ajenas en tableros donde es miembro.
- Puede crear comentarios.
- Puede editar solo sus comentarios.

Invitado:

- Puede ver tareas en tableros donde es miembro.
- Puede editar tareas propias o ajenas en tableros donde es miembro.
- No puede crear comentarios.
- No puede editar comentarios.
- No puede editar comentarios aunque sean propios, porque no puede crearlos.

## Decisiones Resueltas

- Cualquier cuenta autenticada y activa puede editar los campos de cualquier tarea, sea propia o ajena, si tiene acceso al tablero de esa tarea.
- Usuario puede eliminar tareas solo si es el creador o admin. El borrado no se amplía.
- La edición compartida no permite cambiar el creador de la tarea: `created_by` no es escribible desde el cliente.
- Invitado puede ver adjuntos (SELECT en task_attachments para authenticated).
- El administrador inicial se configura manualmente en Supabase.
- Las altas administrativas crean cuentas con rol `usuario`, activas y con correo confirmado, sin enlace de activación.

## Roles: Definición Formal

El alcance de las acciones sobre tareas y sus recursos asociados (asignaciones, comentarios y adjuntos) de esta matriz es **solo dentro de un tablero accesible** por membresía, salvo los administradores activos, que ven todos los tableros. Ser responsable de una tarea no concede acceso a su tablero.

| Acción | Admin | Usuario | Invitado |
|---|---|---|---|
| Ver tareas | Todos los tableros | Solo miembros | Solo miembros |
| Crear tareas | Sí | Sí | No |
| Editar tareas propias | Sí | Sí | Sí |
| Editar tareas ajenas | Sí | Sí | Sí |
| Eliminar tareas propias | Sí | Sí | No |
| Eliminar tareas ajenas | Sí | No | No |
| Ver comentarios | En cualquier tablero | Solo miembros | Solo miembros |
| Crear comentarios | Sí | Sí | No |
| Editar comentarios propios | Sí | Sí | No |
| Editar comentarios ajenos | Sí | No | No |
| Eliminar comentarios propios | Sí | Sí | No |
| Eliminar comentarios ajenos | Sí | No | No |
| Subir adjuntos | Sí | Sí | No |
| Ver adjuntos | En cualquier tablero | Solo miembros | Solo miembros |
| Eliminar adjuntos propios | Sí | Sí | No |
| Eliminar adjuntos ajenos | Sí (de sus tareas) | No | No |
| Editar perfil propio | Sí | Sí | Sí |
| Promover cuentas no administradoras a `admin` | Sí | No | No |
| Asignar/desasignar responsables de tareas en tableros accesibles | Sí | Sí | Sí |

## Acceso y administración de tableros

- Todo usuario debe seleccionar un tablero después de iniciar sesión; la ruta de un tablero también valida su existencia y acceso.
- Un administrador activo puede ver todos los tableros, crear tableros y asignar/quitar miembros. Un tablero nuevo comienza sin miembros.
- Usuario e invitado activos solo ven y abren los tableros a los que están asignados. Cuentas nuevas no reciben membresías automáticamente.
- Un administrador activo puede **cambiar el nombre** de cualquier tablero y **desactivarlo o reactivarlo**. El nombre conserva las reglas de 1–120 caracteres y la unicidad sin distinguir mayúsculas, también en tableros desactivados.
- Los tableros desactivados se muestran en una **sección propia, visible solo para administradores activos**. Sus miembros dejan de verlos y de acceder a sus tareas, incluida la URL directa; el administrador activo conserva el acceso y puede reactivarlos.
- Desactivar un tablero **no borra** tareas, comentarios, adjuntos ni membresías; al reactivarlo, sus miembros recuperan el acceso.
- Un tablero desactivado no se ofrece como destino de traslado de tareas.
- El selector de tableros muestra el número de **tareas pendientes** de cada tablero visible: la suma de las tareas en `backlog`, `por_hacer` y `haciendo`.
- Las cuentas activas existentes se añaden inicialmente a `Offline`; `General` queda vacío. Todas las tareas preexistentes se asignan a `Offline` durante la migración.
- Crear tareas conserva la regla admin/usuario y exige membresía en ese tablero. Cualquier cuenta activa con acceso al tablero puede editar tareas según las reglas existentes.
- Trasladar una tarea permite a cualquier cuenta activa con acceso tanto al tablero de origen como al destino; conserva la identidad y relaciones de la tarea. No crea una copia. La tarea deja de ser visible en origen.
- RLS limita tareas, asignaciones, comentarios, metadatos de adjuntos y objetos de Storage al acceso del tablero. Los enlaces firmados ya emitidos permanecen utilizables hasta expirar; RLS no revoca descargas ya realizadas.
- Implementación: `supabase/migrations/202610210001_boards.sql`, `migrations/202610220001_board_access_returning.sql` y `migrations/202610220002_board_lifecycle.sql`. Los cambios de estado y nombre se aplican mediante RPC (`rename_board`, `set_board_active`) que exigen administrador activo; el cliente no escribe `boards` directamente. El selector usa `list_boards_with_pending_counts()`, que replica la visibilidad de RLS. Verificado con probes SQL contra PostgreSQL local y en el proyecto Supabase remoto el 2026-10-22, donde las tres suites remotas pasan y revierten sus fixtures. La SPA con este comportamiento se publicó en GitHub Pages con la versión `v0.6.0` el 2026-10-22.

## Asignaciones de tareas

- Cualquier cuenta autenticada y activa, incluido `invitado`, puede asignar/desasignar responsables de tareas en tableros accesibles, sin ser creadora ni administradora.
- Crear tareas mantiene los permisos actuales (`admin` y `usuario`). La tarea y sus responsables iniciales se guardan en una transacción.
- Se permite cero, uno o varios responsables; no se admiten duplicados ni nuevos responsables inexistentes o inactivos.
- Una asignación previa a una cuenta inactiva se conserva y puede retirarse. Desactivar cuentas no modifica asignaciones automáticamente.
- En el detalle, «Guardar asignaciones» es independiente del guardado de los demás campos. No amplía permisos de eliminación de tareas.
- Las escrituras de asignaciones usan funciones Postgres autenticadas que comprueban el estado de la cuenta y bloquean la tarea durante la transacción; el cliente no puede escribir directamente en `task_assignees`.

## Edición compartida de tareas

- Cualquier cuenta autenticada y activa, incluidos `admin`, `usuario` e `invitado`, puede editar los campos de cualquier tarea dentro de un tablero accesible: título, descripción, estado, prioridad y posición.
- La creación de tareas sigue reservada a `admin` y `usuario`; la edición compartida no amplía ese permiso.
- El borrado de tareas no se amplía: solo el creador o un `admin` pueden eliminar.
- La interfaz no oculta el campo de edición por rol ni por autoría: el detalle muestra los campos editables y «Guardar cambios» para cualquier cuenta activa.
- El cliente solo puede escribir `title`, `description`, `status`, `priority` y `position` en `tasks`. `created_by`, `created_at` y `updated_at` no son escribibles desde el cliente, de modo que nobody puede reclamar la propiedad de una tarea ajena para después eliminarla.
- El movimiento entre columnas, reordenado y traslado de tablero comparten la regla de acceso: cualquier cuenta activa mueve/reordena en un tablero accesible y cambia a otro solo si también tiene acceso al destino.
- La base de datos es la frontera efectiva de esta regla; la interfaz solo refleja el permiso y no lo restringe.

## Administración de usuarios

- La cabecera ofrece «Usuarios» únicamente a administradores activos; la ruta también está protegida.
- El listado muestra nombre, correo, rol y estado activo/inactivo.
- Los administradores activos pueden editar el nombre completo de cualquier cuenta desde «Editar nombre». Se precarga el nombre actual, se recortan espacios exteriores y se exige entre 1 y 120 caracteres. Esta acción solo modifica `profiles.full_name`, no el correo, rol, contraseña ni estado.
- Un administrador activo puede promover a `admin` cualquier cuenta no administradora (`usuario` o `invitado`), esté activa o inactiva, desde «Usuarios» y tras confirmar la acción. Solo cambia `profiles.role`; `is_active` permanece igual. La interfaz no ofrece degradar administradores.
- Solo un administrador activo puede dar de alta cuentas, establecer una nueva contraseña o activar/desactivar cuentas mediante una Edge Function con autorización verificada en servidor.
- El alta solicita nombre, correo y contraseña; no cambia la sesión del administrador y no permite elegir roles.
- Cambiar contraseña no requiere la anterior ni un correo de recuperación. No se muestran ni almacenan contraseñas en la aplicación.
- Desactivar conserva cuentas y contenido, bloquea el acceso a la aplicación y a datos/Storage privados incluso con un token anterior. Reactivar restablece el acceso.
- Un administrador no puede desactivarse a sí mismo.
- El cliente no actualiza `profiles.role` ni `profiles.is_active` directamente mediante PostgREST. La promoción usa una acción específica de `admin-users`, que verifica en servidor el rol activo del actor; no hay selección arbitraria de rol ni degradación desde esta sección.
- El registro público de Supabase debe deshabilitarse en el despliegue; las cuentas se crean con la API administrativa.
