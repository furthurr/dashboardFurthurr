# Tableros con mis tareas pendientes

## Comportamiento aprobado

- Separar los tableros activos accesibles con al menos una tarea pendiente asignada a la cuenta actual en «Tableros con mis tareas pendientes».
- No repetirlos en «Tableros activos»; conservar «Tableros desactivados» para administradores.
- Pendientes significa `backlog`, `por_hacer` y `haciendo`, tanto para el total general como para «Mis tareas pendientes».
- Mostrar en todas las tarjetas avatar y primer nombre de miembros explícitos y responsables de tareas, sin duplicados.
- Tener alguna tarea asignada, incluso finalizada, concede acceso al tablero activo y sus recursos. Quitar la última asignación revoca ese acceso salvo membresía explícita o rol administrador activo.
- Mantener la gestión manual de miembros como vía adicional de acceso. Desactivar el tablero bloquea miembros y responsables; el administrador activo conserva acceso.

## Implementación y aceptación

- `202610280001_board_assignment_access.sql` amplía acceso RLS y la RPC `list_boards_with_pending_counts`, que añade `my_pending_count` y `people`.
- La proyección de personas incluye exclusivamente `id`, `full_name` y `avatar_url`.
- El listado se invalida tras cambios de tareas, responsables, miembros y traslados.
- Pruebas DOM/API en `src/features/boards/`; permisos y conteos en `supabase/tests/board_assignment_access.sql`, con fixtures revertidos.
- La migración se aplica separadamente de GitHub Pages. No reejecutar el bootstrap en instalaciones existentes.
