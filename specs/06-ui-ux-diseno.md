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
- Tablero horizontal con columnas.
- Cada columna representa un estado.
- Cada tarea se muestra como card.
- Modal o drawer para detalle de tarea.

## Cards

Cada card debe mostrar como mínimo:

- Título.
- Prioridad.
- Avatares de asignados.
- Indicador de comentarios.
- Indicador de adjuntos si existen.

## Detalle De Tarea

Debe mostrar:

- Título editable según permisos.
- Descripción.
- Estado.
- Prioridad.
- Asignados.
- Anotaciones especiales.
- Adjuntos.
- Comentarios.

El modal de detalle se cierra al hacer clic fuera del panel, igual que al usar el botón de cierre o Escape, salvo mientras una operación esté en curso.

## Responsive

- Desktop: columnas horizontales con scroll lateral si es necesario.
- Mobile: columnas apiladas o scroll horizontal optimizado.

## Accesibilidad

- Colores con contraste suficiente.
- Estados no deben depender solo del color.
- Botones y acciones con textos claros.
