# 02 - Requisitos Funcionales

Estado: `borrador`

## Autenticación

- Un administrador activo puede dar de alta usuarios con correo y contraseña desde «Usuarios», sin confirmación por correo.
- El usuario puede iniciar sesión.
- El usuario puede cerrar sesión.
- El sistema mantiene sesión persistente.
- Cada usuario tiene perfil con nombre completo, correo, foto, nick o alias y tipo.
- Una cuenta activa puede cargar o reemplazar su propio avatar; un administrador activo puede hacerlo para cualquier cuenta. Se aceptan JPG, PNG y WebP de hasta 2 MiB.

## Roles

- Los tipos de usuario son `admin`, `usuario` e `invitado`.
- Admin puede gestionar tareas, comentarios y usuarios.
- Usuario puede gestionar tareas y comentarios según permisos definidos.
- Invitado puede visualizar, pero no crear ni editar comentarios.
- Cualquier cuenta activa puede editar los campos de cualquier tarea, propia o ajena; el borrado sigue reservado a su creador o a un administrador.
- Administración de usuarios: listado, alta como `usuario`, edición del nombre completo, cambio de contraseña, activación/desactivación y promoción a `admin`. Solo un administrador activo puede promover cualquier cuenta no administradora (`usuario` o `invitado`, activa o inactiva); la acción requiere confirmación, solo cambia el rol y no ofrece degradar administradores.
- La lista administrativa muestra los avatares y permite cambiar la foto de cualquier cuenta mediante un diálogo con vista previa.

## Tableros

- Un administrador activo puede crear tableros, gestionar miembros, cambiar nombre y activar/desactivar.
- Los tableros desactivados se muestran solo a administradores activos. Sus miembros pierden acceso hasta que el tablero se reactive.
- Un administrador activo puede eliminar permanentemente un tablero solo después de desactivarlo. La operación elimina el tablero, sus tareas, comentarios, responsables, metadata y objetos adjuntos; no hay recuperación.

## Tareas

- Cada tarea tiene título.
- Cada tarea tiene descripción.
- Cada tarea tiene estado.
- Cada tarea tiene prioridad.
- Cada tarea puede asignarse a una o varias personas.
- Al crearla se pueden elegir cero, uno o varios usuarios activos mediante un desplegable por nombre/correo, con opción «Todos» y sin mostrar los ya asignados. Al abrir el detalle se precargan los responsables y se pueden añadir o desasignar con un guardado independiente, disponible para cualquier cuenta activa, incluidos invitados.
- Cada tarea puede tener anotaciones especiales.
- Cada tarea puede tener adjuntos de máximo 5 MB.
- En «Adjuntos», el uploader, el creador de la tarea o un administrador activo con acceso al tablero puede renombrar o eliminar un adjunto. Renombrar cambia solo el nombre de metadata, no el objeto ni su path.
- Antes de eliminar un adjunto se confirma la acción con el nombre del archivo.
- Cualquier cuenta activa puede editar título, descripción, estado y prioridad de cualquier tarea, y moverla entre columnas o reordenarla dentro de su columna.

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
- Durante el alta de una tarea se pueden seleccionar varios archivos opcionales; cada archivo válido se adjunta a la tarea recién creada.
- Si la tarea se crea pero falla alguna subida, la tarea permanece creada y se informa qué archivos no se adjuntaron; la subida fallida puede intentarse de nuevo desde el detalle de esa tarea.
