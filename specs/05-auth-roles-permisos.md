# 05 - Auth, Roles Y Permisos

Estado: `borrador`

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
- Puede crear y editar tareas si se aprueba esta regla.
- Puede crear comentarios.
- Puede editar solo sus comentarios.

Invitado:

- Puede ver tareas.
- No puede crear comentarios.
- No puede editar comentarios.
- No puede editar comentarios aunque sean propios, porque no puede crearlos.

## Reglas RLS Iniciales

- Todo usuario autenticado puede leer tareas.
- Solo admin y usuario pueden crear comentarios.
- Solo creador o admin pueden editar comentarios.
- Invitado no puede insertar comentarios.
- El admin puede actualizar roles.
- Un usuario puede actualizar ciertos campos de su propio perfil.

## Pendientes De Decisión

- Definir si usuario puede eliminar tareas.
- Definir si usuario puede editar tareas creadas por otros.
- Definir si invitado puede ver adjuntos.
- Definir si el primer usuario registrado será admin automáticamente o si se configura manualmente en Supabase.
