# 06 - UI/UX Y Diseño

Estado: `borrador`

## Mejora integral implementada — pendiente de aceptación

El alcance y el plan de mejora transversal fueron aprobados. La implementación y su evidencia se registran en [la spec SDD-Tiny](../.sdd/specs/mejora-integral-ui/spec.md); queda pendiente de aceptación de cierre en Gate 4. Este vínculo no sustituye los requisitos de este documento.

- Identidad oscura grafito/índigo, controles y feedback compartidos entre acceso, registro, tablero y modales.
- Cabecera adaptable, Kanban con scroll propio y detalle con cuerpo desplazable y acciones visibles.
- Apertura de tarjetas mediante botón; asa de arrastre independiente y controles de movimiento con nombres accesibles.
- Diálogos con gestión de foco, Escape y cierre exterior; pestañas accesibles por flechas, Home y End.
- Guardado, comentarios y adjuntos conservan contenido ante errores; estados pendientes impiden envíos duplicados. El cierre se bloquea durante una operación para no perder su resultado.
- Confirmación antes de eliminar tareas, comentarios o adjuntos, conservando los permisos existentes.

## Referencia Principal

Usar `design-md/airtable` como referencia visual principal.

Objetivo visual:

- Productividad amigable.
- Cards claras y legibles.
- Columnas bien delimitadas.
- Uso de color para prioridad, estado y feedback.
- Interfaz similar a Trello sin copiar marca, logo ni assets.

## Referencia Secundaria

`design-md/linear.app` puede usarse como referencia alternativa si se decide una versión más sobria y orientada a project management.

## Layout Principal

- Barra superior con nombre del proyecto, usuario actual y acciones.
- Creación y detalle incluyen «Usuarios asignados»: desplegable con nombre/correo y lista de seleccionados con acción de desasignar. Los ya asignados desaparecen de las opciones y vuelven al retirarlos. «Todos» agrega a todos los usuarios activos disponibles, sin duplicar ni quitar asignaciones existentes; no se ofrece cuando no quedan candidatos. Incluye carga, error/reintento y vacío; mantiene el borrador ante fallos. En el detalle hay «Guardar asignaciones» independiente y aviso de cambios pendientes para evitar descartarlos al guardar otros campos.
- En la cabecera, las acciones de cuenta se agrupan en un botón que abre un panel lateral. Administradores: «Usuarios», «Perfil» y «Cerrar sesión»; usuarios e invitados: «Perfil» y «Cerrar sesión». Sustituye al acceso directo «Alta de Usuario».
- El perfil propio permite actualizar el nombre completo y la contraseña. El nombre se guarda en `profiles.full_name`; la contraseña se actualiza en Supabase Auth y nunca se almacena en tablas públicas.
- Administración de usuarios: listado paginado con nombre, correo, rol y estado, alta como usuario activo y confirmado, edición del nombre completo precargado, cambio de contraseña y confirmación de activación/desactivación. No permite desactivarse a sí mismo. Incluye estados de carga, vacío, error/reintento y envío bloqueado para evitar duplicados.
- Tablero horizontal con columnas.
- Cada columna representa un estado.
- Cada tarea se muestra como card.
- Modal o drawer para detalle de tarea.

## Filtro de responsables del tablero

- Junto a «Nueva tarea» se ofrece un desplegable con casillas por persona (nombre/correo), sin filtrar por roles.
- Al entrar se selecciona «Todos», que incluye tareas sin asignados. Seleccionar personas desmarca «Todos»; marcar «Todos» limpia las personas. Al retirar la última persona se recupera «Todos» automáticamente.
- La selección múltiple muestra tareas asignadas a cualquiera de las personas seleccionadas, sin duplicarlas. Resumen y contadores reflejan las tareas visibles; se informa cuando no hay coincidencias.
- Cada apertura de «Nueva tarea» precarga las personas del filtro como responsables editables; con «Todos» no precarga a nadie. Un fallo al crear conserva el borrador y sus asignaciones.
- El filtro es local a la vista y no se conserva tras recargar. Incluye carga, error/reintento y listado vacío. Los movimientos mantienen las tareas ocultas en el conjunto de datos y tienen en cuenta sus posiciones.

## Cards

Cada card debe mostrar como mínimo:

- Título.
- Descripción completa, con altura adaptable al contenido y conservando sus saltos de línea.
- Miniaturas de los adjuntos de imagen; al seleccionarlas, mostrar la imagen ampliada en un diálogo.
- Prioridad.
- Avatares de asignados.
- Indicador de comentarios.
- Indicador de adjuntos si existen.

## Detalle De Tarea

Debe mostrar:

- Título, descripción, estado y prioridad editables por cualquier cuenta activa, con independencia de quién creó la tarea.
- «Eliminar tarea» solo se ofrece al creador de la tarea o a un administrador.
- Descripción.
- Estado.
- Prioridad.
- Asignados.
- Anotaciones especiales.
- Adjuntos.
- Comentarios.
- El control para añadir adjuntos se presenta como un botón visible «Seleccionar archivo», muestra el nombre elegido e indica el límite de 5 MB.
- Al elegir un archivo válido se inicia la subida automáticamente, sin un botón adicional de envío; durante la carga se informa su estado y, si falla, se conserva el archivo para reintentar volviéndolo a seleccionar.

El modal de detalle se cierra al hacer clic fuera del panel, igual que al usar el botón de cierre o Escape, salvo mientras una operación esté en curso.

## Alta De Tarea

- El formulario permite seleccionar varios archivos opcionales y muestra los nombres seleccionados antes de crear la tarea.
- Cada archivo debe ser de 5 MB o menos; los que superan el límite se rechazan sin descartar los archivos válidos ya seleccionados.
- Tras crear la tarea se suben los archivos y se asocian a ella. Mientras se crean la tarea y sus adjuntos, el formulario impide envíos duplicados y cierres que puedan interrumpir el resultado.
- Si la tarea se crea pero alguna subida falla, se conserva la tarea, se informa qué archivos fallaron y se indica que pueden añadirse desde el detalle.

El envío de comentarios usa un botón compacto con icono de envío, sin texto visible que pueda cortarse. Permanece junto al campo también en móvil, con nombre accesible y ayuda «Enviar» («Enviando…» durante el envío), y se deshabilita mientras se procesa o el comentario está vacío.

## Responsive

- Desktop: columnas horizontales con scroll lateral si es necesario.
- Mobile: columnas apiladas o scroll horizontal optimizado.

## Accesibilidad

- Colores con contraste suficiente.
- Estados no deben depender solo del color.
- Botones y acciones con textos claros.

## Notificaciones temporales

- Las confirmaciones de tareas, comentarios y adjuntos y los avisos de movimiento cancelado se muestran como toasts flotantes en la esquina inferior derecha, sin desplazar el contenido.
- Se cierran automáticamente tras 4 segundos y permiten cierre manual con un botón accesible. Al pasar el puntero o mantener el foco dentro, el cierre se pausa; al salir se conceden otros 4 segundos de lectura.
- Cada nueva notificación sustituye la anterior y reinicia el tiempo, incluso si repite el mismo texto.
- Mantienen la paleta de feedback existente, se adaptan al ancho del móvil y anuncian su contenido mediante una región de estado sin mover el foco.
- Los errores de operaciones y validación conservan su feedback contextual persistente.
