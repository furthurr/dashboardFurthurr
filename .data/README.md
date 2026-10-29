# Datos & API — Dashboard Furthurr

Documentación canónica de datos y contratos consumidos por la aplicación. Léela antes de cambiar consultas, tipos, el schema de Supabase o los límites de autorización.

## Estado de sincronización

- Tecnología detectada: cliente TypeScript `@supabase/supabase-js`, Supabase Auth/PostgREST/PostgreSQL/Storage, Edge Functions `admin-users` y `mcp`, OAuth 2.1 y RPCs de producto.
- Modo: `full`.
- ¿BD interna?: No. La persistencia es PostgreSQL gestionado externamente por Supabase; el schema de referencia está en `supabase-schema.sql`.
- Baseline Git consultado: `HEAD=267cc910b2f5623f3b9e1ee3d86f3bfebd2c40e9` (`docs(mcp): aclarar autenticación en OpenCode Desktop`). La sincronización documental queda local y no está contenida en ese commit.
- Última actualización documental de datos: 2026-10-28; sincronización MCP/OAuth y reconciliación de evidencia remota de Supabase. El árbol contiene cambios locales ajenos en selector de tableros y `.sdd/`; no se incorporan al alcance ni se atribuyen a `HEAD`.
- Estado remoto verificado el 2026-10-28: MCP y hook OAuth activos, migración `202610280002` aplicada, `mcp_whoami()` funciona con el probe transaccional y se habilitó DCR. Pages publicó el frontend con el run `40796012117`. La tabla `supabase_migrations.schema_migrations` no refleja todo el schema observado; ver la discrepancia detallada en [operación Supabase](../supabase/README.md). No extrapolar presencia de un objeto a aplicación registrada de su archivo de migración.
- El servidor MCP sólo expone `whoami`, que devuelve datos de identidad/PII. Las configuraciones por plataforma no contienen tokens; cada cliente obtiene autorización OAuth por separado. OAuth Server de Supabase está en beta.
- Commit base de implementación y primera sincronización: `eb25418de42c045d6be32a3091f8bb3f36b24ba0`, incluye el código, la migración y la documentación funcional inicial.
- Registro histórico de despliegue: la secuencia de migraciones y las pruebas SQL `boards.sql`, `task_assignments.sql` y `user_access.sql` se ejecutaron correctamente en el proyecto Supabase seleccionado el 2026-10-21; el 2026-10-22 se aplicaron `202610220001` y `202610220002` y volvieron a pasar las tres suites. Ese registro está versionado en `21a44df` y no acredita el estado remoto de migraciones posteriores.
- Estado de despliegue del ciclo de vida: `202610220001` y `202610220002` **aplicadas el 2026-10-22 en el proyecto Supabase remoto**, en ese orden. Las tres suites SQL remotas (`boards.sql`, `task_assignments.sql`, `user_access.sql`) pasan y revierten sus fixtures con `ROLLBACK`. La SPA se **publicó en GitHub Pages con `v0.6.0` el 2026-10-22** (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`, conclusión `success`) bajo el origen de Pages del proyecto. El redeploy de la Edge Function `admin-users` y la configuración de Auth remota se verificaron ese mismo 2026-10-22 y **ya no están pendientes** (marca siguiente).
- **Estado remoto histórico de `admin-users` y Auth (verificado el 2026-10-22):** el código remoto era versión 3 y no contenía `promote-admin`; se redesplegó como versión 4 ACTIVE, con código idéntico byte a byte al repo. Sin sesión respondía 401 desde su propio código, `config diff` no informaba cambios aplicables y `verify_jwt: false` estaba confirmado. La promoción de una cuenta se verificó manualmente en producción ese día. El contrato desplegado en esa fecha se registró como alineado con la SPA `v0.6.0`; no se consultó el remoto durante esta actualización, así que esta evidencia no certifica el estado actual ni migraciones posteriores.

## Contexto para IA

- **Qué consume:** SDK para Auth/tablas/Storage, `functions.invoke('admin-users')` para administración (incluida la promoción a admin) y RPCs para listar/crear/trasladar tareas, reemplazar responsables, gestionar miembros y operar el ciclo de vida de tableros. `fetchTasks` lee tareas/asignados y el `comment_count` de la vista existente `tasks_with_stats` (`src/features/board/api.ts:5-35`). Los adjuntos usan consultas directas a `task_attachments` y Storage; renombrar actualiza `file_name` y eliminar quita objeto y metadata (`src/features/board/attachmentsApi.ts:40-71`). No se encontró OpenAPI; [el catálogo](01-endpoints.md) documenta los contratos observados.
- **Qué expone:** Edge Function `mcp` por Streamable HTTP, discovery Protected Resource Metadata y una herramienta read-only `whoami`; consentimiento y grants pertenecen a Supabase Auth (`supabase/functions/mcp/index.ts:39-115`, `src/features/auth/OAuthConsentPage.tsx:18-78`). El contrato de salida vive en [JSON Schema](contracts/mcp-whoami.schema.json).
- **Auth:** `AuthProvider` verifica el perfil activo, lo refresca cada 30 s/al recuperar foco y limpia la caché ante cambio de identidad o pérdida de acceso. RLS/grants y verificaciones explícitas en Edge/RPC autorizan las operaciones; `is_active` no es revocación criptográfica de JWT (`src/features/auth/AuthContext.tsx:27-98`). OAuth MCP asigna el rol Postgres `mcp_identity` y una audiencia única; no es un rol `profiles.role`.
- **Modelos clave:** `Board` (con `is_active` y `pending_count`), `Task.board_id`, `board_members`, `AssigneeProfile`, `TaskWithAssignees.assignees` y `TaskWithAssignees.comment_count` derivado de `tasks_with_stats`, además de `ManagedUser` (`src/types/index.ts:33-47`, `src/features/board/api.ts:15-35`).
- **Fuentes de datos:** Supabase Auth/OAuth, PostgreSQL administrado, Storage y caché de TanStack Query. No se encontró una base de datos local.
- **Convenciones:** TanStack Query, cinco minutos/un reintento por defecto; administración y usuarios asignables usan `staleTime: 0`. El catálogo de tableros se obtiene por RPC (`list_boards_with_pending_counts`) con `staleTime: 0` y refresco de 30 s; alta, renombrado y activación/desactivación invalidan `['boards']`. Crear o eliminar comentarios invalida `['tasks']` para refrescar el conteo de las tarjetas; renombrar/eliminar adjuntos invalida `['attachments']` y `['task-image-previews']` (`src/features/board/attachmentsApi.ts:181-203`). Listado administrativo de 50 por página y consulta de cuentas activas en lotes de 500. No hay timeout explícito ni contrato global de error; la Edge Function sí devuelve `{ error: string }` y el selector de tableros traduce códigos SQL a mensajes (`src/features/boards/BoardsPage.tsx:72-91`, `src/features/board/commentsApi.ts:53-75`).
- **Integridad y permisos:** cada tarea tiene un `board_id`; admins ven todos los tableros y otras cuentas activas solo los **activos** en los que son miembros. Ser responsable de una tarea no concede acceso al tablero. RLS limita tareas, asignaciones, comentarios y metadatos/objetos de Storage. Las acciones sobre tareas existentes requieren acceso a su tablero; crear tarea además requiere rol y membresía. Renombrar o eliminar un adjunto se permite al uploader, al creador de la tarea o a un admin activo, siempre con acceso al tablero. El traslado requiere acceso al origen y a un destino activo. Admin gestiona miembros, renombra y activa/desactiva tableros.
- **Ciclo de vida de tableros:** `boards.is_active` permite desactivar un tablero sin borrar tareas, comentarios, adjuntos ni membresías. Mientras está desactivado, sus miembros dejan de verlo y de acceder a sus tareas (también por URL directa); el admin activo conserva el acceso y puede reactivarlo. El listado de pendientes suma `backlog`, `por_hacer` y `haciendo`.
- **Campos sensibles/PII:** perfiles incluyen email, nombre y avatar; el MCP devuelve id, email, full_name, role y client_id; tareas, comentarios y adjuntos contienen contenido de usuario e identificadores. No se documentan valores reales ni tokens.
- **Límite de esta documentación:** registra el contrato observado y las comprobaciones remotas fechadas, pero no certifica la configuración desplegada de Supabase más allá de esas verificaciones ni sustituye una auditoría de seguridad.

## Índice

- [Catálogo de operaciones](01-endpoints.md)
- [Modelos y tipos](02-models.md)
- [Mapeo entre Supabase y la aplicación](03-mapping.md)
- [Schema relacional y Storage](04-schema.md)
- [Convenciones de acceso y errores](05-conventions.md)
- [Datos sensibles y PII](06-sensitive-data.md)
- [Variables y entornos](07-environments.md)
- [Schema JSON de respuesta `whoami`](contracts/mcp-whoami.schema.json)
- [Deuda técnica de datos/APIs](data-tech-debt.md)

## Fuentes de verdad

- `supabase-schema.sql`: bootstrap de referencia para instalaciones nuevas; contiene también el aislamiento MCP. `supabase/migrations/` contiene secuencia local incremental. En el proyecto remoto actual, el ledger y el schema divergen para varias migraciones históricas; el detalle y la regla de no ejecutar `db push` a ciegas está en `supabase/README.md`. No reejecutar el bootstrap sobre una BD existente.
- `src/types/index.ts`: tipos TypeScript usados por la app.
- `src/lib/supabase.ts`: inicialización y nombres de variables necesarias.
- `src/features/auth/`, `src/features/users/`, `src/features/boards/` y `src/features/board/`: operaciones cliente; `supabase/functions/admin-users/`: administración; `supabase/functions/mcp/`: resource server remoto y `whoami`; `supabase/migrations/202610280002_mcp_identity.sql`: role, hook, RPC y aislamiento.
- `specs/04-modelo-datos.md` y `specs/05-auth-roles-permisos.md`: intención de producto y matriz prevista; contrastar con el SQL al cambiar el contrato.

## Discrepancias que deben conservarse visibles

- `task_attachments.file_url` conserva una URL generada por `getPublicUrl`, aunque el bucket es privado; la aplicación extrae el path y obtiene URLs firmadas breves para visualización. La discrepancia semántica remanente se registra en [deuda técnica](data-tech-debt.md).
- Las claves foráneas de autor/cargador de comentarios y adjuntos combinan `ON DELETE SET NULL` con columnas `NOT NULL`; ver [deuda técnica](data-tech-debt.md).
- Los responsables ahora usan una proyección explícita `AssigneeProfile`; la relación de autor de comentarios sigue tipada como `Profile` completo. D-03 queda parcialmente resuelta; ver [mapeo](03-mapping.md) y [deuda técnica](data-tech-debt.md).

Estas observaciones registran deuda restante, no certifican el entorno desplegado.

## Evidencia y límites

### MCP / OAuth — verificación remota 2026-10-28

- El proyecto actual firma JWT con ES256; Auth OAuth/DCR y el Custom Access Token
  Hook están activos. `mcp` está ACTIVE versión 2, `admin-users` versión 6 y el
  Pages workflow `40796012117` (commit `267cc91`) terminó en `success`.
- `mcp_identity.sql` se ejecutó con rollback de fixtures y pasó en Supabase remoto.
  Sin token, el endpoint devuelve 401 con `WWW-Authenticate`; el endpoint de
  Protected Resource Metadata y la metadata Auth OAuth fueron comprobados.
- La respuesta `whoami` fue ejecutada manualmente en OpenCode Desktop y devolvió
  la identidad activa (no se copian campos personales a esta documentación). El
  nombre de servidor/client config cambió después de `furthurr` a
  `dashboardFurthurr`; CLI informó el alias nuevo no autenticado. Renovación y
  revocación de sesión real, además de los otros clientes, no se validaron.
- Deno: pruebas de configuración de cliente (2) y MCP (5); `admin-users` (12) y
  suites SQL locales en harness Docker desechable. El runner ejecutó `mcp_identity`,
  `boards`, `task_assignments` y `user_access` tanto sobre instalación incremental
  como bootstrap nuevo; fixtures revertidos en ambos caminos. No es un E2E de todos
  los clientes ni una auditoría de seguridad.
- La tabla de migraciones remota y objetos detectados están desalineados; consultar
  [discrepancia de schema](04-schema.md) y `supabase/README.md` antes de nueva
  aplicación. No inferir el estado de migraciones por el tag de Pages.

Los apartados siguientes conservan resultados históricos de otras entregas; no
representan pruebas ejecutadas de nuevo en esta sincronización.

Se reutiliza evidencia previa de implementación en esta sesión: 79 pruebas Vitest, 9 Deno, build/lint correctos, pruebas SQL con `ROLLBACK` y comprobación HTTP de denegación anónima de RPC. Las migraciones y la Edge Function se registraron como desplegadas antes de esta sincronización.

Para tableros se registraron 111 pruebas Vitest, lint y build correctos. Los tres probes SQL pasaron con Auth/Storage simulados contra bootstrap+migración incremental local y contra el proyecto Supabase seleccionado; sus fixtures se revierten. Chromium con backend simulado cubrió selector, miembros y traslado a 360/768/1440 px. Esto no es E2E completo ni auditoría de seguridad. El build informa que el chunk principal supera 500 kB.

La acción local `promote-admin` se verificó con 115 pruebas Vitest, 11 pruebas Deno de `admin-users`, lint y build correctos. No requiere migración SQL. Su despliegue se comprobó el 2026-10-22: el código remoto pasó de la versión 3 (sin `promote-admin`) a la **versión 4, ACTIVE**, con el código **idéntico byte a byte** al del repo. La **verificación funcional** en producción se completó ese mismo 2026-10-22 con una sesión real de administrador: la persona responsable del proyecto confirmó que el botón «Hacer administrador» de «Usuarios» promueve correctamente la cuenta. La comprobación fue **manual**, no automatizada. El baseline Git vigente es `v0.6.0` / `21a44df`.

### Ciclo de vida de tableros (2026-10-22)

Evidencia de la implementación en la release `v0.6.0` (commit `21a44df`), **no comandos repetidos durante esta sincronización documental**:

- Vitest: 128 pruebas en 15 archivos, todas correctas. Cubren el selector (secciones, badge, renombrado, activar/desactivar, vista sin acciones para no admin) en `src/features/boards/BoardsPage.test.tsx:117-200`, los contratos RPC en `src/features/boards/api.test.ts:23-58` y el filtrado de destinos en `src/features/board/TaskDetailModal.test.tsx:15`.
- `npm run lint` y `npm run build` correctos; persiste el aviso preexistente de chunk principal >500 kB.
- SQL ejecutado contra PostgreSQL 16 local en Docker con Auth/Storage simulados, en dos rutas: (a) bootstrap nuevo y (b) base existente + `202610220001` y `202610220002`. Los probes de `supabase/tests/boards.sql` pasan en ambas; el baseline con el bootstrap de `HEAD` también pasó.
- Comprobación adicional: con tareas en los cinco estados, el contador marca 3 (solo `backlog`, `por_hacer` y `haciendo`).
- Navegador real (Chrome headless con CDP) contra `npm run dev`, interceptando las llamadas a Supabase con datos simulados: se verificaron las dos secciones, el badge, el renombrado (diálogo precargado y actualización de la lista), el ciclo desactivar/reactivar y la vista de rol no administrador sin acciones ni sección de desactivados.

Límites de esta evidencia:

- La verificación SQL descrita arriba es local, con PostgreSQL 16 en Docker y Auth/Storage simulados; la aplicación y la verificación remotas se documentan en el apartado siguiente.
- No hay E2E automatizado con cuentas reales ni auditoría de accesibilidad.
- La verificación SQL local usa un harness propio con Auth/Storage simulados, no el entorno Supabase: no certifica el comportamiento del servicio Supabase, sus grants efectivos ni sus políticas Storage.
- El baseline Git es `v0.6.0` / `21a44df` y ya no está pendiente: el commit incluye esta feature, las dos migraciones y esta documentación.

### Aplicación remota y verificación (2026-10-22)

Hecho verificado sobre el proyecto Supabase remoto (proyecto «furthurr'sDashboard»), registrado en `supabase/README.md`:

- Se aplicaron en este orden `supabase/migrations/202610220001_board_access_returning.sql` y `supabase/migrations/202610220002_board_lifecycle.sql`.
- Estado previo comprobado antes de aplicar: `boards.is_active` no existía y tampoco existían las RPCs `rename_board`, `set_board_active` y `list_boards_with_pending_counts`, ni la policy «Members read own memberships».
- Estado posterior comprobado: `boards.is_active` presente, las tres RPCs presentes y la policy «Members read own memberships» presente. El proyecto conserva sus 4 tableros y sus 32 tareas; la columna se creó con `true` en todos ellos.
- Verificación posterior a la aplicación: las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`:
  - `supabase/tests/boards.sql` → «PASS: boards, membership, RPC authorization, resources, transfer and revocation», con los nuevos probes de ciclo de vida (el admin ve los tableros desactivados y su contador, renombra, rechaza duplicado y nombre vacío, desactiva y reactiva; el miembro pierde visibilidad y acceso y recibe `42501`).
  - `supabase/tests/task_assignments.sql` → PASS.
  - `supabase/tests/user_access.sql` → PASS.

Estado y límites que quedan tras la aplicación remota:

- La SPA compatible **ya se publicó en GitHub Pages** con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`, conclusión `success`) bajo el origen de Pages del proyecto.
- El **baseline Git ya no está pendiente**: es `v0.6.0` / `21a44df`, con `main` sincronizada con `origin/main`.
- La publicación no aporta evidencia funcional nueva: la verificación remota sigue cubriendo solo SQL y **no sustituye una comprobación de la UI contra el servicio real, ni una auditoría de seguridad, ni E2E con cuentas reales**.
- El **redeploy de la Edge Function `admin-users`** (acción `promote-admin` de `v0.5.0`) y la **configuración de Auth remota** (`supabase/config.toml`) **ya no están pendientes**: ambos se verificaron el 2026-10-22 en el proyecto Supabase remoto (versión 4 de la función con código idéntico al repo; `config diff` con `update: 0` y `auth.enable_signup` ya deshabilitado en remoto).
- Siguen vigentes los límites: **no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad**, y el resto de la UI sigue sin comprobarse contra el servicio real. La **verificación funcional de `promote-admin` en producción se completó el 2026-10-22** con una sesión real de administrador —la persona responsable del proyecto confirmó que el botón «Hacer administrador» de «Usuarios» promueve correctamente la cuenta—, pero fue una comprobación **manual**, no automatizada.

### Edge Function `admin-users` y configuración de Auth (2026-10-22)

Verificación registrada en `supabase/README.md`:

- Estado previo comprobado: el código desplegado en el proyecto Supabase remoto era la **versión 3** y **no contenía** la acción `promote-admin`; el botón «Hacer administrador» de «Usuarios» habría fallado en producción.
- Redeploy: `supabase functions deploy admin-users` deja la función en **versión 4, ACTIVE**.
- Equivalencia de código: `supabase functions download admin-users` devuelve un código **idéntico byte a byte** a `supabase/functions/admin-users/index.ts` y `supabase/functions/admin-users/validation.ts` del repo.
- Validación de sesión: sin sesión, la función responde **401** con `{"error":"Inicia sesión para continuar."}` (`supabase/functions/admin-users/index.ts:18`), es decir, la comprobación del bearer la hace el propio código de la función y no el gateway (que está desactivado con `verify_jwt = false`).
- Configuración remota: `supabase config diff` informa **0 cambios que aplicar** (`update: 0`); `auth.enable_signup` no aparece en la diferencia —el registro público ya está deshabilitado en remoto, igual que en `supabase/config.toml`— y `functions list` confirma `verify_jwt: false` para `admin-users`. Las 10 diferencias reportadas son propiedades «solo remotas» (site_url, correo, MFA, pooler, storage vector) que `config push` conservaría y que no requieren ninguna acción.

Límites de esta verificación: la equivalencia del código desplegado y el rechazo sin sesión quedan completados por la **verificación funcional** del 2026-10-22 —la persona responsable del proyecto confirmó que promover una cuenta a administrador desde «Usuarios» funciona correctamente en producción—, pero fue una comprobación **manual**, no automatizada. Tampoco hay E2E automatizado con cuentas reales ni auditoría de accesibilidad.

### Conteo de comentarios en tarjetas (2026-10-23)

- `fetchTasks` consulta tareas con sus responsables y, en paralelo, obtiene `id`/`comment_count` desde `tasks_with_stats`; convierte el conteo a `number` y lo añade a `TaskWithAssignees`. El cliente no pide `attachment_count` en esta lectura (`src/features/board/api.ts:5-35`). La vista ya existe en `supabase-schema.sql:425-433`, tiene `SELECT` concedido a `authenticated` (`supabase-schema.sql:466-468`) y se ejecuta con permisos/RLS del llamador (`supabase/migrations/202610190001_user_administration.sql:54-56`).
- Crear o eliminar un comentario invalida también `['tasks']` para que el globo de la tarjeta reciba el conteo actualizado (`src/features/board/commentsApi.ts:53-75`). No se añade ni altera schema, migración, RPC o permiso de base de datos.
- Evidencia reutilizada de la implementación en esta sesión: 135 pruebas Vitest en 16 archivos, `npm run lint` y `npm run build` correctos; el build mantiene el aviso de chunk principal superior a 500 kB. Las pruebas cubren mapeo del conteo, globo accesible y actualización de caché. No se verificó esta lectura contra Supabase remoto ni mediante E2E de navegador.

### Gestión del nombre y eliminación de adjuntos (2026-10-26)

- Renombrar actualiza solo `task_attachments.file_name`; el objeto y path de Storage permanecen sin cambios. La mutación limita el grant a esa columna, aplica RLS para uploader/creador/admin activo y devuelve el `id` actualizado (`src/features/board/attachmentsApi.ts:40-53,181-190`, `supabase/migrations/202610260001_task_attachment_management.sql:4-22`).
- El borrado elimina el objeto de Storage antes de la metadata, valida ambos resultados y actualiza las queries de adjuntos/miniaturas (`src/features/board/attachmentsApi.ts:55-71,194-204`). Esas operaciones no son atómicas entre Storage y Postgres.
- Vitest del árbol local: 157 pruebas en 16 archivos; `npm run lint` y `npm run build` correctos. El build conserva el aviso de bundle >500 kB. La suite SQL `supabase/tests/boards.sql` no se ejecutó en esta actualización porque no quedó disponible un stack Supabase local; tampoco se aplicó la migración en remoto. No se hizo E2E visual ni auditoría de accesibilidad.
- En la sincronización documental del 2026-10-27 se actualizaron `specs/02-requisitos-funcionales.md`, `specs/04-modelo-datos.md`, `specs/05-auth-roles-permisos.md`, `specs/06-ui-ux-diseno.md`, `specs/11-progreso.md` y `supabase/README.md`. Esa actualización no ejecutó suites SQL ni verificó cambios remotos.
