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

Pendiente de decisión:

- Si invitado puede arrastrar cards.
- Si usuario puede mover cualquier tarea.
- Si solo admin puede mover tareas a `finalizadas`.
