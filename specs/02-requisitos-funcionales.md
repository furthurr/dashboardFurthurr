# 02 - Requisitos Funcionales

Estado: `borrador`

## Autenticación

- El usuario puede registrarse con correo y password.
- El usuario puede iniciar sesión.
- El usuario puede cerrar sesión.
- El sistema mantiene sesión persistente.
- Cada usuario tiene perfil con nombre completo, correo, foto, nick o alias y tipo.

## Roles

- Los tipos de usuario son `admin`, `usuario` e `invitado`.
- Admin puede gestionar tareas, comentarios y usuarios.
- Usuario puede gestionar tareas y comentarios según permisos definidos.
- Invitado puede visualizar, pero no crear ni editar comentarios.

## Tareas

- Cada tarea tiene título.
- Cada tarea tiene descripción.
- Cada tarea tiene estado.
- Cada tarea tiene prioridad.
- Cada tarea puede asignarse a una o varias personas.
- Cada tarea puede tener anotaciones especiales.
- Cada tarea puede tener adjuntos de máximo 5 MB.

## Estados

- `backlog`
- `por_hacer`
- `haciendo`
- `en_revision`
- `finalizadas`

## Prioridades

- `urgente`
- `alta`
- `normal`
- `baja`

## Comentarios

- Una tarea puede tener múltiples comentarios.
- Un usuario puede crear comentarios si no es invitado.
- Un comentario puede editarse por su creador.
- Un comentario puede editarse por un admin.
- Invitados no pueden crear comentarios.
- Invitados no pueden editar comentarios.

## Kanban

- Las tareas se visualizan como cards.
- Las cards pueden arrastrarse entre columnas.
- Al soltar una card en otra columna, cambia su estado.
- El orden dentro de una columna debe persistirse.

## Adjuntos Y Anotaciones

- Las anotaciones especiales aceptan texto y links.
- Los archivos binarios no deben exceder 5 MB.
- Los adjuntos deben quedar relacionados a una tarea.
