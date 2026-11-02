# ADR 0006: workflow MCP de tareas con permisos conjuntos e idempotencia

- Estado: workflow manual activado en remoto el 2026-10-29; consentimiento unificado y automatización implementados **solo localmente**, sin despliegue ni E2E real verificados.
- Fecha: 2026-10-29.
- Amplía [ADR 0004](0004-mcp-oauth-identidad.md) y sustituye localmente el consentimiento de lectura por sesión del [ADR 0005](0005-mcp-lectura-tareas.md), conservando aislamiento OAuth.

## Contexto

Con lectura de tareas y adjuntos ya resuelta, el cliente MCP debía poder ejecutar un
ciclo de trabajo real —iniciar, registrar el resultado y enviar a revisión— sin
convertirse en un segundo canal de escritura con permisos más amplios que el portal.
Ese canal existe en un producto cuyo acceso se concede por membresía o asignación y
cuya autoridad real está en Postgres, no en la UI.

## Decisión implementada

- **Consentimiento conjunto.** El portal expone cinco permisos
  (`read_tasks`, `read_attachments`, `start_task`, `comment_task`, `review_task`) que
  se conceden juntos con avance automático y solo se retiran revocando la conexión completa. Se guardan en
  `mcp_workflow_permissions`, vinculados al consent, perfil y cliente.
- **Sin nuevos scopes OAuth.** `email profile` sigue siendo identidad; los permisos
  de workflow viven en tablas propias y en el consentimiento del portal, no en el
  token. El rol `mcp_identity` sigue sin grants directos sobre tablas o Storage.
- **Una única vía de escritura.** Las tres acciones viajan por la RPC
  `mcp_work_task`, `SECURITY DEFINER` con `search_path = ''`, concedida solo a
  `mcp_identity`. El servidor revalida identidad, sesión, consentimiento, permiso,
  asignación, membresía/tablero activo y etapa; la UI no decide nada.
- **Concurrencia optimista.** Cada mutación envía `expected_updated_at`; si la tarea
  cambió, la RPC responde `PT428` y el cliente debe volver a estudiar el contexto.
- **Idempotencia por `request_id`.** La clave primaria
  `(task_id, profile_id, client_id, request_id)` en `mcp_task_operations` permite
  reintentar la misma operación sin duplicar el efecto; reutilizar el identificador
  con otros datos responde `PT422`. La respuesta repetida es un recibo mínimo.
- **Transiciones acotadas.** `start_task` mueve `backlog`/`por_hacer` a `haciendo`;
  `record_task_result` solo en `haciendo` y escribe un comentario estructurado con
  el nombre del cliente declarado como no verificado, su id y el `request_id`;
  `submit_task_for_review` exige validación manual o modo automático autorizado y un `comment_id` vigente del
  mismo usuario y cliente y mueve a `en_revision`. **Finalizadas nunca se escribe
  por MCP**, y una tarea en `en_revision` deja de ser accesible para el MCP.
- **Automatización incluida (local).** El consentimiento de aplicación vigente incluye el conjunto completo y no requiere opt-in por tarea. `automatic` no envía banderas humanas y exige `work_completed=true` al revisar; comentario y recibo identifican el modo sin acreditar aceptación humana. El modo `human` compatible exige aceptación real. Revocar o renovar el grant invalida el consentimiento; una identidad OAuth sola no equivale a consentimiento de aplicación. La migración amplía grants válidos previos, incluso lectura legacy con sesión y fecha válidas.
- **Guía, no garantía.** Las instrucciones MCP orientan al modelo a estudiar
  todas las páginas y adjuntos relevantes, detenerse ante dudas o errores y
  registrar verificaciones reales antes de revisión. El servidor no puede comprobar
  que el modelo haya leído el contexto o completado efectivamente el trabajo.
- **Contenido no confiable.** Títulos, comentarios y archivos siguen siendo datos
  de usuario: el cliente MCP recibe instrucciones del sistema en la definición del
  servidor, no desde el contenido de la tarea.

## Consecuencias y límites

El MCP puede escribir en el tablero, por lo que su superficie es mayor que la de
`whoami`: requiere consentimiento por cliente, permiso por acción y asignación
explícita. La traza de cada mutación queda en `mcp_task_operations`, con `payload` y
`resultado` en JSONB y sin política de retención definida. El comentario de trabajo
queda en el tablero y es visible para el equipo; el nombre del cliente es un dato
declarado, no verificado. Revocar la conexión no invalida
comentarios ya escritos ni enlaces firmados emitidos.

## Evidencia y operación

- `supabase/functions/mcp/index.ts:145-193` (seis herramientas), `:83-91` (`mcp_work_task`).
- `supabase/functions/mcp/workflow.ts:4` (instrucciones), `:6-18` (esquemas Zod), `:106-122` (errores).
- `supabase/migrations/202610290001_mcp_workflow.sql:4-13`, `:43-66`, `:195-296`.
- Ampliación local: `supabase/migrations/202610300002_mcp_unified_consent.sql:5-174`, `src/features/auth/OAuthConnectionsPage.tsx`, `src/features/auth/OAuthConsentPage.tsx`.
- `src/features/auth/mcpWorkflowAccess.ts:4-41`, `src/features/auth/OAuthConsentPage.tsx:36-101`, `src/features/auth/OAuthConnectionsPage.tsx:28-80`.
- Contratos y datos: [`.data/01-endpoints.md`](../../.data/01-endpoints.md) y [`.data/04-schema.md`](../../.data/04-schema.md).
- Procedimiento y checklist: [guía de prueba MCP](../../docs/prueba-mcp.md).
