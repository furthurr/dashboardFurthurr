# 07 - Kanban Y Drag & Drop

Estado: `borrador`

## Librería Recomendada

Usar `dnd-kit`.

Motivos:

- Compatible con React y TypeScript.
- Funciona en SPA estática.
- Soporta mouse, touch y teclado.
- Permite listas ordenables y movimiento entre columnas.

## Columnas

Columnas iniciales:

- Backlog.
- Por hacer.
- Haciendo.
- En revisión.
- Finalizadas.

## Vaciar Finalizadas

- En tableros activos, un administrador puede usar la papelera junto al contador de Finalizadas.
- La confirmación identifica el tablero y advierte que se eliminarán permanentemente todas las tareas de esa columna, incluso las ocultas por filtros. Cancelar no modifica nada.
- El borrado usa el tablero seleccionado y el estado `finalizadas` en el momento de ejecutar la operación, sin afectar otras columnas ni tableros. Conserva los permisos existentes de borrado.
- Durante el envío se bloquea la confirmación; si falla, se muestra un error y se permite reintentar.

## Comportamiento

- Una card puede moverse dentro de la misma columna.
- Una card puede moverse a otra columna.
- Al cambiar de columna, se actualiza `status`.
- Al cambiar de posición, se actualiza `position`.
- La UI debe actualizarse de forma optimista.
- Si Supabase devuelve error, se revierte el movimiento.

## Persistencia De Orden

Cada tarea tendrá un campo `position`. La estrategia exacta queda pendiente:

- Opción A: enteros reordenados por columna.
- Opción B: posiciones decimales para evitar reordenamientos masivos.

Recomendación inicial: Opción B para facilitar movimientos frecuentes.

## Restricciones Por Rol

Resuelto:

- Cualquier cuenta autenticada y activa puede arrastrar y mover cualquier card, incluida una creada por otra persona.
- No hay restricción por rol para mover tareas a `finalizadas`.
- El movimiento cambia `status` y `position`, y es una edición compartida: aplica la misma regla que la edición de campos.
