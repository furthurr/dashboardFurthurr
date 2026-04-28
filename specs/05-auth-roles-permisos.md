# 05 - Auth, Roles Y Permisos

Estado: `aprobada`

Última actualización: 2026-04-28

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
- Puede crear y editar tareas si se aprueba esta regla.
- Puede crear comentarios.
- Puede editar solo sus comentarios.

Invitado:

- Puede ver tareas.
- No puede crear comentarios.
- No puede editar comentarios.
- No puede editar comentarios aunque sean propios, porque no puede crearlos.

## Decisiones Resueltas

- Usuario puede eliminar tareas solo si es el creador o admin.
- Usuario puede editar tareas solo si es el creador o admin.
- Invitado puede ver adjuntos (SELECT en task_attachments para authenticated).
- Primer usuario registrado será `invitado` por defecto; admin se configura manualmente en dashboard de Supabase.
- Todos los nuevos usuarios se crean con rol `invitado` automáticamente via trigger.

## Roles: Definición Formal

| Acción | Admin | Usuario | Invitado |
|---|---|---|---|
| Ver tareas | Sí | Sí | Sí |
| Crear tareas | Sí | Sí | No |
| Editar tareas propias | Sí | Sí | No |
| Editar tareas ajenas | Sí | No | No |
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
