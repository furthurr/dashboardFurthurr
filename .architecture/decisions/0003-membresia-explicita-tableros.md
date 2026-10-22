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
- Operación: instalaciones existentes deben aplicar `202610210001_boards.sql` antes de publicar el frontend compatible. Se aplicó y verificó con probes en el proyecto Supabase elegido el 2026-10-21; Pages aún no recibió esta versión.
