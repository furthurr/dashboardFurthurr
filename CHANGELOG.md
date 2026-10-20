# Changelog

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
