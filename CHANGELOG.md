# Changelog

## [v0.7.0] - 2026-10-22

### Funcionalidades

- Mantener accesible «Nueva tarea» con un botón flotante fijo al desplazarse por el tablero.

## [v0.6.0] - 2026-10-22

### Funcionalidades

- Separar el selector de tableros en «Tableros activos» y «Tableros desactivados»; la sección de desactivados solo se muestra al administrador activo.
- Mostrar el badge «Tareas pendientes» con la suma de tareas en `backlog`, `por_hacer` y `haciendo` de cada tablero.
- Añadir las acciones «Cambiar nombre» y «Desactivar|Activar» en el selector, con diálogo de renombrado y de confirmación que explica el efecto sobre los miembros.
- Traducir los errores de Supabase (permisos, sesión caducada, nombre duplicado o inválido) a mensajes accionables y conservar el borrador tras un fallo.
- Limitar los destinos de traslado de una tarea a tableros activos.

### Permisos y backend

- Añadir `boards.is_active` y las RPCs `rename_board`, `set_board_active` y `list_boards_with_pending_counts`. El catálogo de tableros pasa a obtenerse por RPC, que replica la visibilidad de RLS.
- Reservar el renombrado y la activación/desactivación al administrador activo en el servidor (`42501`); desactivar un tablero conserva tareas, comentarios, adjuntos y membresías, y sus miembros pierden el acceso, también por URL directa, mientras el administrador activo lo mantiene y puede reactivarlo.
- Corregir la recursión RLS de `INSERT ... RETURNING` con `202610220001_board_access_returning.sql` y reescribir la policy «Accessible boards» sin invocar funciones que lean `boards`; los miembros leen su propia fila de `board_members` con la policy «Members read own memberships».

### Documentación y verificación

- Verificar 128 pruebas Vitest en 15 archivos, `npm run lint` y `npm run build` correctos; el build mantiene la advertencia de chunk principal superior a 500 kB.
- Validar el SQL contra PostgreSQL 16 local con Auth/Storage simulados por dos rutas: bootstrap nuevo y base existente con las dos migraciones del 2026-10-22. Los probes de `supabase/tests/boards.sql` pasan en ambas.
- Comprobar en Chrome headless con CDP contra `npm run dev`, con llamadas a Supabase simuladas: las dos secciones, el badge, el renombrado, el ciclo desactivar/reactivar y la vista sin acciones para cuentas no administradoras.
- Actualizar especificaciones, contratos, documentación de diseño, arquitectura, índices del proyecto y guía operativa de Supabase.
- Límites de la evidencia: no hay pruebas E2E con cuentas reales ni auditoría de accesibilidad; la verificación local usa Auth/Storage simulados y no reproduce el entorno Supabase.

### Notas de despliegue

- `202610220001_board_access_returning.sql` y `202610220002_board_lifecycle.sql` ya están aplicadas en el proyecto Supabase remoto, en ese orden, el 2026-10-22. Tras aplicarlas pasan las tres suites remotas (`boards.sql`, `task_assignments.sql` y `user_access.sql`) y revierten sus fixtures con `ROLLBACK`; el proyecto conserva sus 4 tableros y sus 32 tareas.
- En una instalación existente que no las tenga, aplicarlas en ese orden antes de publicar la SPA compatible. El bootstrap `supabase-schema.sql` ya incluye los mismos objetos.
- La publicación de la SPA en GitHub Pages ocurre con este push a `main`; el workflow de Pages no aplica SQL ni Edge Functions.

## [v0.5.0] - 2026-10-22

### Funcionalidades

- Permitir que un administrador activo promueva cuentas `usuario` o `invitado` a `admin` desde «Usuarios», sin alterar el estado de la cuenta.

### Permisos y backend

- Añadir una acción específica en `admin-users`, protegida por autorización del administrador activo y sin permitir degradar administradores.

### Documentación y verificación

- Actualizar especificaciones, contratos y guías operativas sobre la promoción administrativa.
- Verificar 115 pruebas Vitest, 11 pruebas Deno, lint, build y diff-check. El build mantiene la advertencia de chunk superior a 500 kB.

### Notas de despliegue

- Re-desplegar la Edge Function `admin-users` para habilitar la acción. No se ha hecho deploy del backend.

## [v0.4.0] - 2026-10-21

### Funcionalidades

- Seleccionar un tablero después del inicio de sesión y volver al selector desde el Kanban.
- Crear tableros como administrador y asignar o retirar miembros por tablero.
- Trasladar tareas a otro tablero accesible conservando la tarea y sus relaciones.

### Permisos y backend

- Añadir las tablas `boards` y `board_members`, exigir `board_id` en cada tarea y restringir tareas y recursos asociados por RLS.
- Crear `Offline` y `General`; las tareas existentes y cuentas activas existentes se asignan a `Offline`, mientras `General` empieza vacío.
- Hacer que los traslados y la gestión de miembros se validen en RPCs; las asignaciones de tareas no conceden acceso a un tablero.
- Usar Storage privado y enlaces firmados breves para adjuntos, incluyendo compatibilidad de lectura para paths anteriores.

### Documentación y verificación

- Actualizar modelos, contratos, permisos, flujo visual, arquitectura, índices y guía operativa de Supabase.
- Verificar con `npm ci`, build, lint y 111 pruebas Vitest. Los probes SQL pasaron contra bootstrap y migración incremental en PostgreSQL local embebido con Auth/Storage simulados; Chromium verificó el flujo a 360/768/1440 px con backend simulado.

### Notas de despliegue

- En instalaciones existentes, aplicar `supabase/migrations/202610210001_boards.sql` después de las migraciones previas y antes de publicar esta SPA. El build de GitHub Pages no aplica SQL.
- La secuencia de migraciones se aplicó y los probes SQL pasaron en el proyecto Supabase seleccionado el 2026-10-21. El push a `main` y la publicación en Pages siguen pendientes.
- El build informa que el chunk JavaScript principal supera 500 kB. `npm ci` informa 11 vulnerabilidades en dependencias (1 baja, 1 moderada y 9 altas).

## [v0.3.0] - 2026-10-20

### Funcionalidades

- Editar cualquier tarea desde su detalle, propia o ajena, con cualquier cuenta activa: título, descripción, estado y prioridad quedan guardables para `admin`, `usuario` e `invitado`.
- Mover y reordenar cualquier card del tablero, con independencia de quién la creó.
- Mantener «Eliminar tarea» reservado a quien creó la tarea o a un administrador.

### Permisos y backend

- Ampliar la policy de `UPDATE` sobre `tasks` a toda cuenta autenticada y activa, y sustituir el permiso de tabla completa por permisos por columna sobre `title`, `description`, `status`, `priority` y `position`.
- Impedir que el cliente escriba `created_by`, de modo que nadie puede reclamar una tarea ajena para después eliminarla.
- Añadir la migración `supabase/migrations/202610200002_shared_task_editing.sql` para instalaciones existentes y actualizar el bootstrap `supabase-schema.sql`.
- Actualizar las pruebas transaccionales de permisos y asignaciones con las nuevas reglas de edición, propiedad y borrado.

### Documentación y verificación

- Actualizar las especificaciones de requisitos, permisos, UI/UX, Kanban y progreso, además de la guía operativa de Supabase y la documentación del proyecto.
- Verificar con `npm ci`, build, lint, 89 pruebas de frontend, 9 pruebas de la Edge Function y las dos suites SQL transaccionales con `ROLLBACK`.

### Notas de despliegue

- La migración de edición compartida ya está aplicada en la instalación vinculada; GitHub Pages publica la SPA con este release.
- La Edge Function `admin-users` no cambia en esta versión y no requiere redespliegue.

## [v0.2.0] - 2026-10-20

### Funcionalidades

- Administrar cuentas desde «Usuarios»: listado paginado, alta confirmada, edición de nombre, contraseña y activación/desactivación.
- Agrupar las opciones de cuenta en un menú lateral según el rol y permitir editar el nombre y la contraseña del perfil propio.
- Filtrar el tablero por una o varias personas, con «Todos» por defecto y recuperación automática al quitar la última selección.
- Precargar los responsables seleccionados en el filtro al crear tareas; con «Todos» iniciar sin asignados.
- Asignar responsables desde un desplegable en creación y detalle: ocultar los ya elegidos, devolverlos al retirarlos y añadir todos los activos mediante «Todos».
- Crear tareas con sus responsables en una transacción y guardar asignaciones por separado desde cualquier cuenta activa.

### Permisos y backend

- Incorporar el estado activo de cuenta y comprobarlo en las rutas protegidas, las policies RLS y las operaciones administrativas.
- Restringir los cambios administrativos a la Edge Function `admin-users`, sin claves privilegiadas en el frontend.
- Incluir migraciones incrementales, configuración de registro público deshabilitado y pruebas transaccionales de permisos/asignaciones.

### Documentación y verificación

- Actualizar especificaciones, documentación del proyecto y guías de despliegue; registrar el proceso de release y excluir temporales de Supabase.
- Verificar instalación con `npm ci`, build, lint, 86 pruebas de frontend, 9 pruebas de la Edge Function y dos suites SQL con `ROLLBACK`.

### Notas de despliegue

- GitHub Pages publica la SPA; las migraciones y `admin-users` se despliegan por separado siguiendo `supabase/README.md`.
- La instalación vinculada ya dispone de los cambios SQL; las pruebas remotas de permisos y asignaciones se verificaron antes de publicar y la función administrativa se redesplegó con esta versión.
- Pendiente de mantenimiento: npm informa 11 vulnerabilidades en las dependencias actuales (1 baja, 1 moderada y 9 altas).

## [v0.1.0] - 2026-10-19

### Funcionalidades

- Crear la aplicación web con autenticación Supabase y un tablero Kanban para gestionar tareas.
- Definir el esquema inicial de datos para tareas, comentarios y adjuntos.
- Añadir controles accesibles para mover y reordenar tareas entre columnas.
- Mejorar las interacciones del tablero e incorporar notificaciones temporales.
- Permitir adjuntar varios archivos al crear una tarea y mostrar previsualizaciones de imágenes en las tarjetas.

### Correcciones

- Corregir la configuración del bucket de adjuntos y errores de compilación.
- Corregir los controles de movimiento del tablero y conservar nombres accesibles en autenticación.

### Documentación y mantenimiento

- Añadir especificaciones del producto y documentación operativa del proyecto.
- Unificar la licencia del proyecto bajo MIT.
