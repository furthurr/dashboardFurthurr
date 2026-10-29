# Catálogo de operaciones de datos

No se encontró OpenAPI. El contrato observado combina SDK de Supabase, una Edge Function administrativa, RPCs Postgres y el resource server MCP Streamable HTTP. Se documentan nombres, parámetros y respuestas sin valores de proyecto. RLS/grants o comprobaciones servidor explícitas controlan cada operación.

## Autenticación

### Iniciar sesión — `supabase.auth.signInWithPassword`

- Propósito: autenticar con email y contraseña.
- Auth: credenciales del usuario enviadas al SDK; la app recibe el resultado de Auth.
- Request observado: `{ email, password }`; no se documentan valores.
- Response: el componente solo consume `error`; la sesión se publica por `AuthContext`.
- Errores: error devuelto por Supabase Auth y mostrado como mensaje en la pantalla.
- Fuente: `src/features/auth/LoginPage.tsx:12-27`.

### Alta — operación administrativa, no `signUp`

`RegisterPage` fue retirado. `/register` redirige a `/users`; las altas se realizan mediante `admin-users` y `auth.admin.createUser`, sin cambiar la sesión del administrador y con `email_confirm: true`. El registro público queda deshabilitado por `supabase/config.toml:1-3`. Ver el contrato administrativo más abajo (`src/App.tsx:27-28`, `supabase/functions/admin-users/index.ts:43-56`).

### Recuperación y cambios de sesión — `getSession` / `onAuthStateChange`

- Propósito: hidratar y mantener el estado de sesión del cliente.
- Request: no hay parámetros de negocio observados.
- Response consumida: `Session | null`; si hay usuario, se consulta `profiles`.
- Errores: `getSession` no tiene manejo explícito de error en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:27-93`. Se consulta también el perfil al recuperar foco/cada 30 s; se descartan respuestas de identidades anteriores.

### Cerrar sesión — `supabase.auth.signOut`

- Propósito: cerrar la sesión de Supabase.
- Request: no hay parámetros.
- Response: `AuthContext.signOut()` espera la promesa, pero no devuelve ni transforma el resultado.
- Errores: no hay manejo local explícito en el código observado.
- Fuente: `src/features/auth/AuthContext.tsx:95-98`; después limpia TanStack Query.

## MCP remoto — servidor `dashboardFurthurr`

Endpoint del recurso: `https://<project-ref>.supabase.co/functions/v1/mcp`.
El transporte es Streamable HTTP stateless. El código desplegado el 2026-10-29 anuncia
seis herramientas (`whoami`, `get_task`, `read_task_attachment`, `start_task`,
`record_task_result`, `submit_task_for_review`) con `serverInfo.version=0.3.0` en Edge
**v4 ACTIVE**; la migración `202610290001` está aplicada y registrada. El E2E en
navegador y con cliente LLM sigue pendiente. No confundir la versión de aplicación MCP
con el número de versión Edge. [Guía de prueba](../docs/prueba-mcp.md).

### Protected Resource Metadata — `GET {resource}/oauth-protected-resource`

- Propósito: publicar `resource`, `authorization_servers` y métodos Bearer para
  que un cliente descubra Supabase Auth según RFC 9728. No requiere token.
- Response observado: `resource` es la URL canónica exacta del MCP,
  `authorization_servers` contiene el issuer `/auth/v1`, `bearer_methods_supported`
  contiene `header`, y `scopes_supported` contiene `email profile`.
- Errores: métodos distintos de GET → 405; un Origin fuera de la allowlist → 403.
- Fuente: `supabase/functions/mcp/index.ts:50-53,106-128`.

### Desafío de autorización — MCP sin token

- Una solicitud de protocolo sin Bearer devuelve HTTP 401 y `WWW-Authenticate`
  con `resource_metadata="{resource}/oauth-protected-resource"` y scopes
  `email profile`. La URL nunca se acepta desde `Host` o query parameters.
- Los clientes deben iniciar Authorization Code + PKCE contra Supabase Auth y
  enviar el access token en `Authorization: Bearer ...`; no enviar tokens de sesión
  del portal ni tokens en URL.
- La autorización interactiva pasa por `site_url` + `authorization_url_path` de
  Auth, que redirige al consentimiento Pages con `authorization_id` opaco. Cada
  cliente registra su propio OAuth client DCR/public y requiere consentimiento.
- Error local observado sin autorización: HTTP 401 con `resource_metadata`; no se
  incluyen códigos, secretos ni bearer en la respuesta.
- Fuente: `supabase/functions/mcp/index.ts:129-145`, `src/features/auth/mcpOAuth.ts:2-21`.

### Herramienta de identidad — `tools/call` `whoami`

- Propósito: identificar al perfil activo asociado al token MCP y al cliente OAuth.
- Request JSON-RPC: `tools/call` con `name: "whoami"` y argumentos vacíos. La consulta
  de tarea se realiza mediante la herramienta separada `get_task`.
- Response: objeto estructurado `id`, `email`, `full_name`, `role`, `client_id`;
  contrato JSON Schema en [`contracts/mcp-whoami.schema.json`](contracts/mcp-whoami.schema.json).
  Email, nombre e identificadores son PII y pasan al contexto del agente.
- Auth servidor: `mcp_identity`, claim `aud` igual al resource URL y sesión activa
  en `auth.sessions`; además se verifica firma ES256/RS256, `iss`, `exp`, `sub`,
  `session_id` y `client_id`. La RPC `mcp_whoami()` es `SECURITY DEFINER` con
  `search_path = ''` y valida estado activo, audience, client y sesión en cada call.
- Respuestas de denegación: token ausente/inválido/revocado → 401; perfil inactivo
  o autorización insuficiente → 403; error de persistencia inesperado → 503. El
  flujo de identidad no usa privilegios `service_role`; la firma de adjuntos de
  `get_task` es una operación exclusivamente servidor separada.
- Fuente: `supabase/functions/mcp/index.ts:25-38,50-66,129-150`,
  `supabase/migrations/202610280002_mcp_identity.sql:47-74`.

### Consultar tarea — `tools/call` `get_task`

Implementación local en `supabase/functions/mcp/index.ts:151-166` y
`supabase/functions/mcp/task.ts:13-32,49-92`.

| Argumento | Tipo / valor por defecto | Validación |
| --- | --- | --- |
| `task_id` | UUID string, obligatorio | Formato GUID; se normaliza a minúsculas |
| `comments_offset` | integer, `0` | 0–2147483547 |
| `attachments_offset` | integer, `0` | 0–2147483547 |
| `page_size` | integer, `50` | 1–100, compartido por ambas páginas |

El objeto es estricto: no acepta campos extra, paths ni URLs proporcionadas por
el cliente. Los esquemas de entrada/salida se anuncian en `tools/list`.

- **Auth local:** bearer OAuth validado y `mcp_whoami()` previo. `mcp_get_task`
  revalida permiso de lectura, acceso al tablero y asignación en cada llamada. Para
  no admin sigue exigiendo membresía en un tablero activo; admin activo conserva su
  acceso al tablero, pero **también debe estar asignado**. Asignación sola no sustituye
  membresía para un no admin. Todos los roles, incluido admin, quedan limitados a
  `backlog`, `por_hacer` y `haciendo`.
- **Respuesta:** `task`, `board`, `assignees`, `comments`, `attachments`. Se devuelve
  como `structuredContent` y JSON en `content[type=text]`. Ver [modelos](02-models.md).
- **Paginación:** comentarios y adjuntos tienen `total`, `offset`, `next_offset`
  (integer o `null`) e `items`. Se ordenan por `created_at, id`. El cliente debe
  recorrer ambas continuaciones; no hay bucle automático del servidor ni snapshot
  entre peticiones. Una colección vacía es `[]`, no `null`.
- **Archivos:** metadatos más `download_url`, `expires_at`, `download_error`.
  Solo se firman rutas de esa tarea bajo el origen/bucket esperado, por 60 s;
  se elimina `file_url` de la salida. Error individual deja URL/expiración nulas y
  metadata visible. Legacy, fallo de Storage o límite de tiempo no provocan una
  firma privilegiada de una ruta arbitraria. El estudio de contenido se solicita
  por separado con `read_task_attachment`.
- **Errores de herramienta:** `isError: true` y texto seguro, sin `structuredContent`.
  Además de `PT403` (permiso OAuth), `PT404` (tarea/adjunto no disponible),
  `PT412` pide asignarse manualmente y `PT409` indica etapa no permitida; `PT428`
  obliga a volver a leer ante cambios concurrentes, `PT422` indica reutilización de
  request ID con datos distintos, `PT413` tamaño excedido, `PT415` archivo no seguro
  o no soportado, `22023` argumentos inválidos, `28000` sesión revocada/caducada y
  `42501` acceso no activo. Otros errores son genéricos.
  Un UUID/paginación inválido puede ser rechazado antes por el SDK MCP. Los HTTP
  401/403/503 del control de identidad son distintos de `isError` de la herramienta.
- **Privilegios:** lectura SQL con bearer OAuth en RPCs propias; firma y descarga
  exclusivamente servidor con `SUPABASE_SERVICE_ROLE_KEY` después de validar el
  path. El rol no obtiene grants directos de tablas/Storage; las escrituras están
  confinadas a RPCs de workflow y verifican el consentimiento correspondiente.
  Respuestas `Cache-Control: no-store`. Los textos retornados son datos no confiables.
- **Fuente SQL:** `202610280003_mcp_task_read.sql:63-116` (base previa, aplicada) y
  `202610290001_mcp_workflow.sql:122-193` (aplicada y registrada el 2026-10-29).

### Leer contenido de adjunto — `tools/call` `read_task_attachment`

- **Request estricto:** `{ task_id: UUID, attachment_id: UUID, offset?: integer,
  max_chars?: integer }`; defaults `0` y `12000`, límite de archivo 5 MiB. Cada llamada
  vuelve a comprobar consentimiento, acceso, asignación y etapa (`workflow.ts:19-26`,
  `202610290001_mcp_workflow.sql:179-193`).
- **Texto/código:** MIME textual/JSON/XML/JavaScript/YAML o extensión permitida;
  UTF-8 válido, máximo 12000 caracteres por fragmento, continuación con offset en
  caracteres JavaScript (UTF-16) y `next_offset`. NUL, ruta no validable y contenido
  binario/UTF-8 inválido se rechazan. Se etiqueta como contenido no confiable
  (`workflow.ts:81-103`).
- **Imágenes:** PNG/JPEG/GIF/WebP se comprueban mediante firma binaria y se emiten
  como bloque MCP `image` con base64. El cliente debe poder procesar ese tipo; si no,
  el asistente no debe afirmar que vio la imagen.
- **Otros formatos:** PDF y formatos no extraídos devuelven metadata y un enlace
  firmado por 60 s con advertencia; eso no significa que se haya estudiado el archivo.
  No se siguen URLs externas, no se extraen archivos comprimidos ni se ejecutan
  adjuntos. El descargador limita bytes reales, timeout a 15 s y rechaza redirects
  (`workflow.ts:28-50,84-93`).
- **Errores:** comparte errores de acceso/asignación/estado y añade tamaño excedido
  `PT413` o formato/path/codificación no admitidos `PT415`. No expone la URL original
  almacenada.

### Iniciar, registrar resultado y enviar a revisión — herramientas workflow

Las tres herramientas envían `task_id`, `request_id` UUID y `expected_updated_at`
de la lectura/operación previa; el request ID sirve para reintentar exactamente el
mismo payload y la versión evita sobrescribir una tarea que cambió. No existe una
acción genérica de estado ni una herramienta para `finalizadas`.

| Herramienta | Entrada adicional | Efecto local del servidor | Gate |
| --- | --- | --- | --- |
| `start_task` | `user_approved: true`, `context_summary` (1–12000 caracteres) | `backlog`/`por_hacer` → `haciendo`; si ya está `haciendo`, conserva el estado | Consentimiento `start_task`, asignación y etapa permitida |
| `record_task_result` | `summary`, `changes`, `clarifications`, `validation`, `observations` (cada uno 1–12000) | Inserta comentario de trabajo MCP con nombre de cliente declarado como no verificado, client ID e intervención/request ID; devuelve `comment_id` | `haciendo`, permiso `comment_task` y versión actual |
| `submit_task_for_review` | `user_validated: true`, `comment_id` | `haciendo` → `en_revision`; requiere comentario resultado existente del mismo usuario/cliente y vigente para la versión actual | Consentimiento `review_task`, declaración de validación y asignación |

Las banderas `user_approved`/`user_validated` son declaraciones incluidas por el
cliente MCP; SQL no puede comprobar el diálogo ni que el modelo realmente aclaró
todo el contexto. `workflowInstructions` guía el orden conversacional, mientras
SQL impone estados, permisos y transiciones. En `en_revision` y `finalizadas` se
rechazan lectura de tarea, lectura de adjunto y mutaciones; la persona debe moverla
manualmente a `haciendo`. Admin no omite asignación ni límites de etapa.

Los resultados se almacenan como comentario y, para idempotencia, también se guarda
un recibo/payload en `mcp_task_operations`; no hay política de retención en el SQL
local. Fuentes: `supabase/functions/mcp/workflow.ts:4-17,106-122`,
`supabase/functions/mcp/index.ts:145-203`,
`supabase/migrations/202610290001_mcp_workflow.sql:195-296`.

### Consentimiento y concesiones OAuth

- UI Pages: `/oauth/consent?authorization_id=<opaque-id>` muestra cliente, callback,
  scopes y cuenta; una aceptación concede identidad más los cinco permisos workflow.
  Si Auth autoaprueba un consentimiento antiguo por scopes, la página aún solicita
  aceptación explícita para ampliar permisos o permite continuar con identidad sin
  ampliación. El callback procede solo del `redirect_url` de Auth.
- Gestión: `/profile/connections` lista identidad y permisos de tareas; permite
  retirar permisos individualmente/todos sin perder `whoami`, o revocar el grant
  OAuth completo. El permiso workflow se asocia al consentimiento OAuth activo y su
  fecha, no a un scope nuevo; sesiones válidas del mismo grant aplican esa concesión.
- Las concesiones antiguas de lectura por sesión (`mcp_task_read_permissions`) se
  muestran como permisos efectivos de lectura para compatibilidad, pero no confieren
  escritura. `mcp_list_workflow_access()` devuelve cliente y arreglo de permisos;
  `mcp_revoke_workflow_permission()` limita la retirada al perfil activo del portal.
  Un consentimiento OAuth nuevo no hereda automáticamente la concesión anterior.
- Scopes `email`/`profile` son de identidad, no permisos SQL. El aislamiento real
  usa rol SQL, consentimiento y checks en cada RPC. Fuente: `src/App.tsx:11-16,39-42`,
  `src/features/auth/OAuthConsentPage.tsx:18-106`,
  `src/features/auth/OAuthConnectionsPage.tsx:10-89`,
  `src/features/auth/mcpWorkflowAccess.ts:1-34`,
  `supabase/migrations/202610290001_mcp_workflow.sql:15-107`.

## PostgreSQL vía Supabase

### Leer tableros accesibles con pendientes — RPC `list_boards_with_pending_counts`

- Propósito: obtener el catálogo de tableros visibles con el número de tareas pendientes. Sustituye a la lectura directa `boards.select`.
- Request: sin parámetros; se invoca como `supabase.rpc('list_boards_with_pending_counts')`.
- Response local: `id`, `name`, `is_active`, `created_at`, `pending_count`, `my_pending_count` y `people` (proyección de ID/nombre/avatar); la ampliación de asignaciones está en `supabase/migrations/202610280001_board_assignment_access.sql:44-83`.
- `pending_count` suma las tareas del tablero en estado `backlog`, `por_hacer` o `haciendo`; excluye `en_revision` y `finalizadas` (`supabase/migrations/202610220002_board_lifecycle.sql:71-85`).
- Autorización del portal local: `SECURITY DEFINER`, path vacío; admin activo ve todos y el resto tableros activos por membresía **o asignación** (`supabase/migrations/202610280001_board_assignment_access.sql:73-83`). No crea membresías. `get_task` no usa esta ampliación: no admin requiere membresía explícita.
- Errores: el error de Supabase se propaga; la pantalla distingue carga, error con reintento y catálogo vacío (`src/features/boards/BoardsPage.tsx:28-30`).
- Fuente: `src/features/boards/api.ts:7-22`, `supabase/migrations/202610220002_board_lifecycle.sql:71-90`.

### Crear tablero — `boards.insert`

- Request: `{ name }`; el cliente recorta el nombre. SQL exige 1–120 caracteres, sin espacios exteriores, y unicidad sin distinguir mayúsculas (`supabase-schema.sql:576,580`).
- Auth: solo administrador activo, reforzado por RLS y la restricción SQL. Un tablero recién creado no tiene miembros y nace con `is_active = true` por defecto (`supabase-schema.sql:577`).
- Nota de RLS: `INSERT ... RETURNING` de PostgREST evalúa también la policy de lectura de `boards`; por eso esa policy no invoca ninguna función que lea `boards` (ver «Ciclo de vida de tableros» en [schema](04-schema.md)).
- Fuente: `src/features/boards/api.ts:24-34`, `supabase/migrations/202610210001_boards.sql:4-9,47-48`, `supabase/migrations/202610220002_board_lifecycle.sql:12-24`.

### Renombrar tablero — RPC `rename_board`

- Propósito: cambiar el nombre de un tablero sin salir del selector.
- Request: `{ p_board_id: uuid, p_name: text }`; el cliente recorta el nombre antes de enviarlo (`src/features/boards/api.ts:44-47`).
- Response: `void`; no se consume fila.
- Auth: solo admin activo; en caso contrario la RPC lanza `42501` (`supabase/migrations/202610220002_board_lifecycle.sql:40-54`).
- Validación: nombre recortado de 1–120 caracteres (`22023`), tablero inexistente (`P0002`). El índice único `lower(name)` reporta el duplicado como violación de unicidad (`23505`).
- La RPC no cambia `is_active` ni toca tareas, comentarios, adjuntos o membresías.
- Fuente: `src/features/boards/api.ts:36-47`, `supabase/migrations/202610220002_board_lifecycle.sql:38-54`.

### Activar/desactivar tablero — RPC `set_board_active`

- Propósito: desactivar o reactivar un tablero sin borrarlo.
- Request: `{ p_board_id: uuid, p_active: boolean }`; response `void`.
- Auth: solo admin activo (`42501`); tablero inexistente (`P0002`), argumentos nulos (`22023`).
- Semántica: desactiva o reactiva la fila `boards.is_active`. No borra tareas, comentarios, adjuntos ni membresías; la reactivación devuelve el acceso a los miembros que conservaban su membresía (`supabase/migrations/202610220002_board_lifecycle.sql:56-66`).
- Efecto colateral autorizado en RLS: mientras el tablero está desactivado, sus miembros pierden la lectura del tablero y el acceso a sus tareas (también por URL directa); el admin activo conserva el acceso.
- Fuente: `src/features/boards/api.ts:49-60`, `supabase/migrations/202610220002_board_lifecycle.sql:56-66`.

### Eliminar tablero desactivado — Storage + RPC `delete_inactive_board`

- Propósito: borrar permanentemente un tablero previamente desactivado y sus tareas, comentarios, responsables y metadata de adjuntos.
- Request del cliente: `{ p_board_id: uuid }` a `supabase.rpc('delete_inactive_board', ...)`. Antes de llamar a la RPC, `deleteInactiveBoard` confirma que el tablero existe y está desactivado; pagina las tareas/adjuntos, deriva y deduplica paths y elimina objetos de `task-attachments` por lotes de hasta 100 (`src/features/boards/api.ts:69-123`).
- Response SQL: `void`. La RPC vuelve a comprobar admin activo, ID y estado bajo bloqueo de fila; elimina tareas y después el tablero. Los datos relacionales se eliminan por cascadas (`supabase/migrations/202610260002_delete_inactive_boards.sql:5-25`).
- Auth/validación: solo admin activo (`42501`); ID nulo (`22023`); tablero inexistente (`P0002`); tablero activo (`55000`). La comprobación del cliente no sustituye el control de la RPC.
- Fallos parciales: Storage y PostgreSQL no son una transacción única. `BOARD_ATTACHMENTS_DELETE_FAILED` detiene el borrado SQL; `BOARD_DELETE_FAILED_AFTER_STORAGE` indica que los objetos ya se quitaron pero la RPC falló. Paths irreconocibles producen `BOARD_ATTACHMENT_PATH_INVALID` antes de limpiar (`src/features/boards/api.ts:88-131`).
- Caché: tras éxito se quitan consultas de tareas, comentarios, adjuntos y miniaturas, e invalida `['boards']` (`src/features/boards/api.ts:135-145`).
- Estado remoto: la migración existe localmente; no se verificó su aplicación en Supabase.
- Fuente: `src/features/boards/api.ts:69-145`, `supabase/migrations/202610260002_delete_inactive_boards.sql:5-25`.

### Leer/administrar membresías — `board_members` y RPC `set_board_members`

- Las lecturas de miembros se paginan en rangos de 500. El admin puede leer la tabla completa de membresías y sustituirlas mediante `{ p_board_id, p_profile_ids }`.
- Cada miembro autenticado puede además leer **su propia fila** de membresía mediante la policy «Members read own memberships» (`profile_id = auth.uid()`), que no expone las membresías ajenas (`supabase/migrations/202610220002_board_lifecycle.sql:7-10`).
- Se admiten perfiles existentes y activos; los miembros inactivos ya asignados se pueden conservar o retirar, pero no agregar de nuevo. La lista completa se reemplaza atómicamente.
- Fuente: `src/features/boards/api.ts:62-91`, `supabase/migrations/202610210001_boards.sql:63-80`, `supabase/migrations/202610220002_board_lifecycle.sql:9-10`.

### Leer perfil — `profiles.select`

- Propósito: recuperar el perfil del usuario autenticado.
- Request observado: `select('*').eq('id', userId).single()`.
- Response: fila tipada/casteada como `Profile` o error; un error deja `profile` en `null`.
- Fuente: `src/features/auth/AuthContext.tsx:27-45`; un perfil no activo o un fallo limpia también la caché.

### Leer tareas — `tasks.select` con relación de asignados

- Propósito: traer las tareas del tablero seleccionado, ordenadas por `position`, sus perfiles asignados y el total de comentarios por tarea.
- Request observado: en paralelo, `.from('tasks').select(...)` filtra por `board_id`, ordena por `position` y expande `task_assignees(...)`; `.from('tasks_with_stats').select('id, comment_count')` filtra el mismo tablero. Las relaciones de asignados nulas se descartan.
- Response: filas transformadas a `TaskWithAssignees`; el cliente asocia `comment_count` por ID y lo convierte a `number` (`0` si no encuentra una fila de estadística). La vista también calcula `attachment_count`, pero esta lectura no lo solicita. Consultar [mapeo](03-mapping.md#tareas-y-asignados).
- Errores: el error de cualquiera de las dos consultas Supabase se lanza; TanStack Query lo expone a la pantalla.
- Fuente: `src/features/board/api.ts:5-35`, definición de la vista `supabase-schema.sql:425-433`.

### Crear tarea — RPC `create_task_with_assignees`

- Auth: `admin` o `usuario` activos; propietario derivado de `auth.uid()`, no del `createdBy` local del hook.
- Request: `{ p_board_id, p_title, p_description, p_status, p_priority, p_assignee_ids }`; descripción ausente → `null`; IDs deduplicados. SQL permite lista omitida por defecto `[]`.
- Response: objeto JSON de la tarea (`Task`), no incluye los perfiles de responsables; la query de tareas se invalida.
- Transacción: valida título/rol/estado, calcula posición con bloqueo por estado, inserta tarea y ejecuta `set_task_assignees`. Un error revierte ambas escrituras. Los adjuntos se suben **después**, fuera de esta transacción.
- Fuente: `src/features/board/api.ts:65-104`, `supabase/migrations/202610200001_task_assignments.sql:47-76`.

La firma incremental actual incluye `p_board_id` y exige acceso al tablero además del rol activo `admin`/`usuario`; posición se calcula dentro del tablero y estado (`supabase/migrations/202610210001_boards.sql:94-112`).

### Trasladar una tarea — RPC `move_task_to_board`

- Request: `{ p_task_id, p_board_id }`; operación transaccional, no inserta una segunda tarea.
- Auth: cuenta activa con acceso al tablero actual y al de destino. Conserva estado, prioridad, descripción y relaciones; calcula posición al final de la columna correspondiente del destino. RLS impide la mutación directa de `board_id`.
- Destino inactivo: `can_access_board` exige tablero activo para los miembros, de modo que un tablero desactivado no es un destino válido. La interfaz refuerza el filtro y solo ofrece tableros activos distintos del actual (`src/features/board/BoardPage.tsx:411`).
- Fuente: `src/features/boards/api.ts:93-110`, `supabase/migrations/202610210001_boards.sql:114-131`, `supabase/migrations/202610220002_board_lifecycle.sql:27-36`.

### Reemplazar responsables — RPC `set_task_assignees`

- Auth: cualquier cuenta activa, **incluido `invitado`**, sobre cualquier tarea de un tablero al que tenga acceso.
- Request: `{ p_task_id: UUID, p_assignee_ids: UUID[] }`; `[]` desasigna a todos. No admite lista nula ni IDs nulos; elimina duplicados.
- Response: `AssigneeProfile[]` en JSON, ordenados por nombre/ID. Actualiza la caché de tareas e invalida la query.
- Validación: destinos existentes y activos; permite conservar un destino inactivo si ya estaba asignado. Bloquea tarea y perfiles objetivo durante la transacción. Prevalece el último conjunto guardado, sin detección de conflicto de borradores.
- Permisos: no modifica título, descripción, propietario, estado ni prioridad. Escritura directa cliente en `task_assignees` revocada. La edición de esos campos de la tarea se rige por su propia policy y sus permisos por columna, no por esta RPC.
- Errores SQL: `42501` cuenta no autorizada; `22023` lista/destino inválido; `P0002` tarea inexistente. El SDK los propaga; la UI conserva el borrador y presenta un mensaje seguro.
- Fuente: `src/features/board/api.ts:106-123`, `supabase/migrations/202610200001_task_assignments.sql:5-45`.

### Usuarios asignables — `profiles.select`

- Auth: cuenta activa con acceso por RLS; no requiere ser administrador ni invocar `admin-users`.
- Selección: `id, full_name, email, avatar_url, role, is_active`, filtrada por `is_active = true`, ordenada por `full_name`/`id`.
- Paginación: rangos de 500 hasta recibir una página menor; devuelve `AssigneeProfile[]`. Query `['assignable-users']`, habilitada al abrir creación/detalle, `staleTime: 0`.
- Fuente: `src/features/board/assigneesApi.ts:5-20`.

### Actualizar tarea — `tasks.update`

- Propósito: cambiar título, descripción, estado y prioridad.
- Auth: cualquier cuenta autenticada activa, **incluido `invitado`**, sobre cualquier tarea de un tablero accesible; no se limita a la tarea creada por el actor.
- Request observado: `taskId` y esos campos; filtro por `id`.
- Columnas escribibles: solo `title`, `description`, `status`, `priority` y `position`. `created_by` no es escribible desde el cliente.
- Response: no se consume fila; la query `tasks` se invalida al completar.
- Errores: si la migración `202610200002_shared_task_editing.sql` no está aplicada en el proyecto, la base de datos rechaza la escritura con un error de RLS; la UI conserva el borrador y muestra un mensaje seguro.
- Fuente: `src/features/board/api.ts:125-153`, `supabase/migrations/202610200002_shared_task_editing.sql:1-19`.

### Cambiar estado/posición — `tasks.update`

- Propósito: actualizar estado y posición de una tarea al moverla entre columnas.
- Auth: cualquier cuenta autenticada activa, sobre cualquier tarea de un tablero accesible.
- Request observado: `taskId`, `status`, `position`; filtro por `id`.
- Response: sin fila de respuesta consumida; invalidación de `tasks`.
- Fuente: `src/features/board/api.ts:47-63`.

### Reordenar posiciones — varias operaciones `tasks.update`

- Propósito: persistir la nueva posición de una lista de tareas.
- Auth: cualquier cuenta autenticada activa.
- Request observado: arreglo `{ taskId, position }`; ejecuta una actualización por elemento usando `Promise.all`.
- Response: no hay transacción explícita; se invalidan las tareas al completar.
- Fuente: `src/features/board/api.ts:173-193`.

### Eliminar tarea — `tasks.delete`

- Propósito: borrar una tarea por `id`.
- Auth: el creador de la tarea o un `admin`. La edición compartida no amplía este permiso.
- Response: no se consume fila; error se lanza.
- Fuente: `src/features/board/api.ts:155-170`, `supabase/migrations/202610200002_shared_task_editing.sql:16-18`.

### Leer / crear / eliminar comentarios — `comments`

- Lectura: filtra por `task_id`, ordena por `created_at` ascendente y proyecta `author` desde `profiles` (`src/features/board/commentsApi.ts:5-24`).
- Creación: inserta `task_id`, `author_id` y `body`, devuelve la fila insertada (`src/features/board/commentsApi.ts:27-57`).
- Eliminación: borra por `id` (`src/features/board/commentsApi.ts:59-74`).
- Caché: tras crear se invalidan `['comments', taskId]` y `['tasks']`; tras eliminar, `['comments']` y `['tasks']`, para actualizar el detalle y los conteos de las tarjetas (`src/features/board/commentsApi.ts:53-75`).
- Errores: errores de consulta/mutación se lanzan; no existe DTO común de error.

### Leer adjuntos — `task_attachments.select`

- Propósito: consultar metadatos por `task_id`, ordenados por fecha ascendente.
- Response: metadata como `TaskAttachment`; por archivo se deriva el path de `file_url` y se emite URL firmada de 60 segundos. La lectura queda limitada por acceso al tablero de la tarea.
- Fuente: `src/features/board/attachmentsApi.ts:12-27`, `src/lib/storage.ts:1-10`.

### Renombrar adjunto — `task_attachments.update(file_name)`

- Propósito: cambiar el nombre visible del archivo en los metadatos. No cambia el objeto, su contenido ni su path en Storage.
- Request: `{ file_name }`, recortado; el cliente actualiza la fila filtrando por `id` y solicita el `id` resultante.
- Response: un `id`; si RLS no devuelve una fila, el cliente falla en vez de anunciar un cambio inexistente. El nombre vacío se rechaza antes de enviar la mutación.
- Auth: cuenta activa con acceso al tablero y que sea quien subió el adjunto, creadora de la tarea o admin activo. La policy se aplica en Postgres; el grant cliente solo permite `UPDATE(file_name)`.
- Caché: invalida `['attachments']` y `['task-image-previews']`, de modo que la lista y las miniaturas reciban el nombre nuevo.
- Fuente: `src/features/board/attachmentsApi.ts:40-53,181-190`, `supabase/migrations/202610260001_task_attachment_management.sql:4-22`, `supabase-schema.sql:461,617-628`.

## Storage vía Supabase

### Subir avatar — bucket `avatars` + `profiles.update`

- Propósito: cargar o reemplazar la foto de perfil propia; la UI administrativa también permite a un admin cambiar la foto de otra cuenta.
- Validación cliente: MIME `image/jpeg`, `image/png` o `image/webp`, máximo 2 MiB (`src/features/users/avatarApi.ts:3-16`).
- Request: path `<profile-id>/avatar`, `upsert: true`, `cacheControl: '0'`, content type del archivo; luego actualiza solo `profiles.avatar_url` con la URL pública del objeto (`src/features/users/avatarApi.ts:14-35`).
- Autorización: Storage y RLS permiten escritura al propietario o a un admin activo; el campo `avatar_url` es la columna de perfil actualizable. La lectura del bucket es pública. La migración configura tamaño máximo 2 MiB y MIME permitidos, además de policies de inserción/reemplazo (`supabase-schema.sql:363-404`, `supabase/migrations/202610260003_profile_avatars.sql:5-50`).
- Errores: propaga errores de Storage/Postgres; si el `UPDATE` no devuelve una fila, el cliente informa que no se guardó el perfil. El objeto puede haberse cargado antes del error de metadata; no hay transacción entre ambos servicios.
- Fuente: `src/features/users/avatarApi.ts:3-35`, `supabase/migrations/202610260003_profile_avatars.sql:5-50`.

### Subir adjunto — bucket `task-attachments`

- Secuencia observada: path `<taskId>/<UUID>.<extensión segura>`; `storage.upload`; genera `getPublicUrl` para persistir la referencia de metadata. El bucket es privado; la interfaz obtiene URL firmada al consultar el archivo.
- Metadata insertada: `task_id`, `uploaded_by`, nombre original, URL, tamaño y MIME.
- Request de Storage: opciones `cacheControl: '3600'` y `upsert: false`.
- Fuente: `src/features/board/attachmentsApi.ts:98-147`.
- El trigger SQL exige que una nueva referencia de metadata apunte a un path dentro del directorio UUID de su tarea. El borrado comprueba errores de Storage antes de eliminar metadata.

### Eliminar adjunto — Storage y `task_attachments.delete`

- Secuencia observada: deriva el path de `file_url`, comprueba el resultado de `Storage.remove` y después elimina la fila por `id`, solicitando el `id` borrado.
- Auth: quien subió el adjunto, quien creó su tarea o un admin activo, siempre con cuenta activa y acceso al tablero; RLS/Storage vuelven a aplicar la autorización en servidor.
- Errores: propaga fallos de Storage/Postgres y considera fallido el borrado si no se devuelve una fila. Storage y Postgres son llamadas separadas, no una única transacción.
- Caché: invalida `['attachments']` y `['task-image-previews']` al completar.
- Fuente: `src/features/board/attachmentsApi.ts:55-71,194-204`, `src/lib/storage.ts:1-10`, `supabase-schema.sql:327-340`, `supabase/migrations/202610210001_boards.sql:152-159`.

### Miniaturas — URLs firmadas de `task-attachments`

Consulta metadata por IDs de tareas, filtra MIME `image/`, firma rutas por 60 segundos y agrupa `{ id, fileName, signedUrl }` por tarea. La query se refresca cada 45 segundos; los enlaces de detalle también usan firmas breves. La referencia persistida sigue construida con `getPublicUrl` aunque el bucket sea privado; ver D-02. Fuente: `src/features/board/attachmentsApi.ts:73-127`, `src/lib/storage.ts:1-10`.

## Edge Function — `admin-users`

Cliente: `supabase.functions.invoke('admin-users', { body })`, POST con bearer de sesión. La función verifica `auth.getUser` y exige perfil `admin` activo **antes de todas las acciones**; la clave privilegiada solo existe en servidor (`src/features/users/api.ts:11-28`, `supabase/functions/admin-users/index.ts:13-32`).

| `body.action` | Campos de entrada | Respuesta correcta | Efecto |
| --- | --- | --- | --- |
| `list` | `page` entero 1–100000, por defecto 1 | `{ users: ManagedUser[], total, pageSize: 50 }` | Perfiles ordenados por fecha descendente/ID |
| `create` | `fullName`, `email`, `password` | `{ success: true }` | Auth con correo confirmado, perfil `usuario` activo; intenta compensación si falla perfil |
| `rename` | `userId`, `fullName` | `{ success: true }` | Solo `profiles.full_name`; no sincroniza metadata Auth |
| `password` | `userId`, `password` | `{ success: true }` | Establece contraseña con API administrativa; no promete invalidar sesiones existentes |
| `set-active` | `userId`, `active: boolean` | `{ success: true }` | Solo `profiles.is_active`; prohíbe desactivación propia y conserva datos |
| `promote-admin` | `userId` UUID | `{ success: true }` | Asigna `profiles.role = 'admin'`; no modifica `is_active` ni ofrece degradar roles |

`list` proyecta `avatar_url` junto con el resto de `ManagedUser`. El cliente hace una consulta adicional a `profiles(id, avatar_url)` si una versión anterior de la Edge Function omite esa propiedad (`supabase/functions/admin-users/index.ts:34-41`, `src/features/users/api.ts:28-48`). La carga de avatares no es una acción Edge: usa Storage y `profiles.update` (ver arriba).

Validación servidor: nombre recortado 1–120 caracteres; email validado, recortado y en minúsculas para alta; contraseña 8–128 caracteres más política de Auth; `userId` UUID. Solo un administrador activo puede ejecutar acciones; `promote-admin` acepta cualquier cuenta no administradora, activa o inactiva, y fija el rol en servidor, sin aceptar `role` ni `is_active` como valores del cliente. Propiedades extra se ignoran. Respuesta de error `{ error: string }`: 400 payload/operación o cuenta objetivo no actualizable, 401 sesión, 403 rol/estado, 405 método, 500 fallo interno/compensación/listado. `Cache-Control: no-store`; OPTIONS soportado. El cliente intenta leer el error JSON de `FunctionsHttpError.context` y usa fallback seguro en fallos de red/gateway (`supabase/functions/admin-users/validation.ts:8-34`, `supabase/functions/admin-users/index.ts:24-32,68-80`, `src/features/users/api.ts:11-24`).

## Límites del catálogo

- Las rutas HTTP internas de Supabase, límites de tamaño configurados en el servicio, respuestas exactas de Auth y estado de despliegue del proyecto Supabase no son verificables desde este repositorio.
- Administración usa páginas de 50 y usuarios asignables lotes de 500. Tareas/comentarios/adjuntos continúan sin paginación explícita. El catálogo no certifica rate limits ni configuración remota actual; conserva la evidencia previa de despliegue descrita en el README de este dominio.
- Historial remoto verificado hasta 2026-10-22: `202610220001`/`202610220002` y las tres suites SQL se aplicaron/pasaron en ese entorno; la SPA de ciclo de vida se publicó como `v0.6.0` (run `39860177282`). Esta evidencia no cubre el estado remoto actual ni las migraciones `202610260001`–`202610260003`, cuya aplicación no se verificó en esta sincronización.
- Estado local 2026-10-26: el código y las tres migraciones están presentes en el árbol de trabajo; no se ejecutaron suites SQL local/remota ni se consultó el proyecto Supabase remoto. La documentación del proyecto señala `v0.8.1` (run `40004615822`) como última publicación registrada, sin consulta remota durante esta operación.
