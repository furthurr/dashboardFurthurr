# ADR 0005: lectura MCP de tareas con consentimiento por sesión

- Estado: aceptada en el plan del usuario e implementada localmente; despliegue y E2E pendientes.
- Fecha: 2026-10-28.
- Amplía [ADR 0004](0004-mcp-oauth-identidad.md); no elimina su aislamiento OAuth.

## Contexto

El usuario necesita entregar al asistente el UUID copiado del Kanban y consultar
título, descripción, estado, responsables, comentarios y archivos. Las conexiones
existentes solo habían sido autorizadas para identidad; conocer un UUID no debe
ampliar permisos ni permitir lecturas cruzadas.

## Decisión implementada

- Mantener `whoami` y añadir `get_task`, sin herramientas de escritura ni acceso
  directo del rol `mcp_identity` a tablas o Storage.
- Exigir consentimiento adicional en el portal. `mcp_task_read_permissions` vincula
  usuario/cliente/sesión viva; una reconexión no hereda la autorización. No se crea
  un scope OAuth nuevo: `email profile` sigue siendo identidad.
- Revalidar sesión/perfil y acceso en una RPC propia `SECURITY DEFINER` con path
  vacío. No admin requiere membresía explícita en tablero activo; admin activo
  conserva acceso a tableros desactivados. No reutilizar el helper del portal que
  permite acceso por asignación.
- Entregar proyecciones mínimas y páginas independientes para comentarios/adjuntos.
  Los textos son contenido de usuario no confiable, no instrucciones.
- Firmar en Edge por 60 s con credencial exclusivamente servidor y solo tras
  obtener metadata autorizada y validar origen, bucket y path de la tarea.
  No se usa esa credencial para consultar tareas ni se comparte con agentes.

## Consecuencias y límites

El permiso de lectura se puede retirar sin revocar identidad; borrar la sesión
elimina el permiso por cascada. Enlaces emitidos y descargas no se revocan
retroactivamente. Las rutas antiguas no validables se listan con error de descarga,
no se migran automáticamente. La paginación por offset no da un snapshot entre
llamadas. El soporte de descarga/análisis de archivos depende del cliente MCP.

## Evidencia y operación

- `supabase/functions/mcp/index.ts:63-84,125-154`.
- `supabase/functions/mcp/task.ts:13-32,49-92`.
- `supabase/migrations/202610280003_mcp_task_read.sql:4-116`.
- `src/features/auth/OAuthConnectionsPage.tsx:14-108`.
- [Guía de activación y prueba](../../docs/prueba-mcp.md): preparación documentada,
  no evidencia de aplicación de SQL ni despliegue remoto.
