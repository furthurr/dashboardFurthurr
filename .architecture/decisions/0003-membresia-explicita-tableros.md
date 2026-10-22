# ADR 0003: Membresía explícita para acceso a tableros

- Estado: Aceptada (decisión funcional confirmada por el usuario)
- Fecha: 2026-10-21

## Contexto

El producto necesita separar actividades en tableros y restringir la visibilidad a sus miembros, manteniendo visibilidad global para administradores. Ocultar cards o filtrar en React no es una frontera de autorización suficiente para PostgREST y Storage.

## Decisión

- Cada tarea lleva una sola FK obligatoria a `boards`.
- `board_members` representa el acceso explícito. Admin activo accede a todos; otras cuentas activas solo a sus membresías. Ser responsable de una tarea no concede acceso.
- RLS y RPCs aplican el ámbito en Postgres también a asignaciones, comentarios y adjuntos.
- Cuentas activas existentes se asignan a `Offline`; `General` inicia vacío. Nuevas cuentas no reciben membresías por defecto.
- Un traslado modifica la tarea existente, requiere acceso a ambos tableros y conserva sus relaciones.

## Alternativas consideradas

- Filtrar solo en el frontend — descartado porque no protege lecturas directas ni recursos relacionados.
- Conceder acceso automáticamente al asignar tareas — descartado; una asignación no sustituye el permiso de leer el tablero completo.
- Mantener una vista global para no administradores — descartado por requisito de aislamiento de tableros.

## Consecuencias

- Positivas: autorización coherente en tablas y recursos, una única pertenencia por tarea y traslados sin duplicación.
- Negativas / trade-offs: la asignación inicial y gestión manual de miembros son necesarias; retirar membresía corta nuevas solicitudes, pero no revoca contenido descargado ni URLs firmadas ya emitidas.
- Operación: instalaciones existentes deben aplicar `202610210001_boards.sql` antes de publicar el frontend compatible. Se aplicó y verificó con probes en el proyecto Supabase elegido el 2026-10-21; Pages recibió esa versión con la release `v0.6.0` el 2026-10-22.
- Enmienda 2026-10-22 (ciclo de vida de tableros): la membresía sigue siendo la base del acceso, pero ya no basta sola. `boards.is_active` desactiva un tablero sin borrar contenido ni membresías; sus miembros pierden el acceso, también por URL directa, y el admin activo conserva el suyo. Publicar el frontend compatible exige además `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql`, en ese orden; **ambas se aplicaron en el proyecto remoto ese mismo 2026-10-22** y las tres suites SQL remotas pasaron con fixtures revertidos mediante `ROLLBACK`, de modo que la base ya es compatible con esa UI. La SPA se **publicó en GitHub Pages con `v0.6.0` el 2026-10-22** (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`) y está servida en <https://furthurr.github.io/dashboardFurthurr/>. Detalle en [arquitectura](../README.md#ciclo-de-vida-de-tableros).
