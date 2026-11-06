# Deuda técnica de datos/APIs

Hallazgos de contrato y consistencia observados en la capa de datos. Esta
sincronización focalizada reutiliza evidencia remota previa de esta sesión;
no repite consultas remotas, no modifica producto ni es una auditoría de seguridad.

Actualización 2026-11-02: aplicada y registrada `202610260002` tras confirmar que
faltaba `delete_inactive_board(uuid)`. Probe SQL focalizado con `ROLLBACK` y 37/37
Vitest correctos; sin borrado de tableros reales. **D-09 permanece abierta** y
**D-11 queda parcialmente mitigada solo para esa migración**. No se reconciliaron
los demás objetos/entradas. [Evidencia y límites](../supabase/README.md#corrección-del-borrado-de-tableros--2026-11-02).

Actualización 2026-11-06 (local, sin desplegar): el diseño de borrado cambia. La
migración `202611060001_inactive_board_readonly.sql` **retira** `delete_inactive_board`
y traslada el borrado a la Edge Function `board-delete`, con manifiesto persistido en
`board_deletion_jobs` y RPCs `service_role`. **D-09 queda mitigada por diseño** en el
árbol local (manifiesto reutilizable, reintento administrativo y reactivación
bloqueada), pero **sigue abierta en el entorno remoto**, donde el flujo antiguo sigue
vigente. **D-15** registra la ventana de despliegue y **D-16** el arranque local
heredado. No se ejecutaron pruebas ni despliegues durante esta actualización
documental; la evidencia de implementación (215 Vitest, 18 Deno de Edge, 19 Deno MCP,
SQL en PostgreSQL 16 desechable, lint y build) es local y no es E2E de Auth, OAuth ni
Storage real.

Revisión de MCP 2026-10-28: el proyecto remoto fue consultado ese mismo día tras
activar Supabase OAuth y desplegar `mcp`. El probe `supabase/tests/mcp_identity.sql`
pasó remotamente y revierte sus fixtures. La tabla de control de migraciones y los
objetos reales divergen en migraciones históricas; D-11 documenta el riesgo
operativo. No se certifica la seguridad de la configuración completa ni se
reemplaza una auditoría de seguridad del proyecto.

Revisión focalizada 2026-10-21: D-03 sigue **parcialmente resuelta** por `AssigneeProfile`. D-04 queda **resuelta para el contrato observado**: path de tareas, comprobación del resultado de eliminación y soporte de paths previos en la policy. D-02 se reduce: vistas de archivos usan URLs firmadas, pero `file_url` sigue persistiendo una URL generada por `getPublicUrl` aunque el bucket sea privado. La migración y probes se ejecutaron en el proyecto Supabase seleccionado; esto no es auditoría de seguridad ni certifica otros entornos.

Revisión focalizada 2026-10-22 (ciclo de vida de tableros): el contrato de `boards.is_active` y de las tres RPCs nuevas quedó observado y verificado primero en local (PostgreSQL 16 en Docker con Auth/Storage simulados) y después **aplicado y verificado en el proyecto Supabase remoto** ese mismo 2026-10-22, en el orden `202610220001` → `202610220002`; las tres suites SQL remotas pasan y revierten sus fixtures con `ROLLBACK`. Se añade D-06 (coste del conteo de pendientes) y D-07, que pasa de «despliegue pendiente» a «publicación de la SPA pendiente» y queda **resuelto** al publicarse la SPA con `v0.6.0` el 2026-10-22 (workflow «Deploy to GitHub Pages», run `39860177282`, `headSha=21a44df`).

Revisión focalizada 2026-10-22 (cierre de los pendientes de despliegue): la Edge Function `admin-users` se redesplegó con `supabase functions deploy admin-users` y quedó en **versión 4, ACTIVE**, con el código remoto **idéntico byte a byte** a `supabase/functions/admin-users/index.ts` y `supabase/functions/admin-users/validation.ts` del repo; el código desplegado anterior, versión 3, **no contenía** la acción `promote-admin`, de modo que el botón «Hacer administrador» habría fallado en producción. `supabase config diff` informa **0 cambios que aplicar** (`update: 0`): `auth.enable_signup` ya está deshabilitado en remoto y `functions list` confirma `verify_jwt: false`. **Ya no queda deuda de despliegue pendiente**; en ese momento se añadió D-08 con la comprobación funcional que todavía faltaba, cerrada en la revisión siguiente.

Revisión focalizada 2026-10-22 (verificación funcional de `promote-admin`): D-08 pasa a **resuelto**. La persona responsable del proyecto confirmó ese 2026-10-22 que **promover una cuenta a administrador desde «Usuarios» funciona correctamente en producción** (botón «Hacer administrador»), tras el redespliegue de `admin-users` en la versión 4 con código idéntico al repo. La evidencia acumulada es: (a) función `admin-users` desplegada en **versión 4, ACTIVE**, con el código remoto **idéntico byte a byte** al del repositorio —la versión 3 **no contenía** la acción `promote-admin`—; (b) **verificación funcional completada el 2026-10-22 en producción con una sesión real de administrador**; (c) sin sesión, la función responde `401 {"error":"Inicia sesión para continuar."}`, validación hecha en su propio código y no en el gateway; y (d) `supabase config diff` sin cambios aplicables, con `auth.enable_signup` ya deshabilitado en remoto y `verify_jwt: false` confirmado. La comprobación fue **manual**, no automatizada: siguen sin cubrirse E2E automatizado con cuentas reales ni auditoría de accesibilidad.

Revisión documental del árbol local 2026-10-26: se incorporan el borrado permanente de tableros inactivos y la carga de avatares. No se ejecutaron pruebas ni se verificaron las migraciones nuevas en Supabase remoto. D-09 registra el límite de consistencia distribuida observado en el código de borrado; no se hizo auditoría de seguridad.

## 🔴 Crítica

| # | Hallazgo | Ubicación (archivo:línea) | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos verificados de esta severidad en el alcance documental. | — | — | — | — |

## 🟠 Alta

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| — | Sin hallazgos verificados de esta severidad en el alcance documental. | — | — | — | — |

## 🟡 Media

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-01 | Regla de borrado incompatible con nullabilidad: `comments.author_id` y `task_attachments.uploaded_by` son `NOT NULL` pero sus FKs especifican `ON DELETE SET NULL`. | `supabase-schema.sql:73-76`, `supabase-schema.sql:89-93` | Borrar perfil referenciado puede fallar por violación `NOT NULL` en lugar de conservar el comportamiento esperado por la FK. | Bajo | Decidir si la relación debe ser nullable, restringir el borrado o usar otra acción referencial; alinear SQL y especificaciones. |
| D-02 | Metadata conserva URL construida por `getPublicUrl` mientras `task-attachments` es privado; UI obtiene links firmados de 60 s. | `src/features/board/attachmentsApi.ts`, `supabase-schema.sql`, `supabase/migrations/202610210001_boards.sql:133-172` | La columna representa una URL no destinada a consumo directo; visualización requiere firma y acceso vigente al tablero. | Bajo | Considerar almacenar solo object path o formalizar la URL metadata como referencia opaca; no asumir la configuración remota sin verificar. |
| D-03 | Parcialmente resuelta: responsables usan `AssigneeProfile` explícito; el autor de comentarios aún se castea a `Profile` completo desde una proyección parcial. | `src/types/index.ts:41-47`, `:55-66`, `src/features/board/commentsApi.ts:7-16` | El autor puede carecer de email, estado activo y otros campos que el tipo exige. | Bajo | Tipar la proyección de autor o ampliar/validar la respuesta; no reabrir el caso ya corregido de responsables. |
| D-04 | **Resuelta y versionada**: las cargas nuevas usan `<taskId>/<UUID>.<ext>`; la policy autoriza por metadata/tarea, contempla paths legacy y cliente comprueba error al borrar. | `src/features/board/attachmentsApi.ts`, `supabase/migrations/202610210001_boards.sql:133-172` | No se reproduce el desacople de path detectado en la versión anterior; falta comprobar el entorno real. | — | Verificar el entorno real; no equivale a auditoría de Storage. |
| D-09 | **Mitigada por diseño en local (2026-11-06), abierta en remoto:** el borrado ya no lo ejecuta el cliente. La Edge Function `board-delete` prepara un manifiesto en `board_deletion_jobs`, borra objetos en lotes de 100 y confirma el borrado relacional; un fallo deja el tablero inactivo, bloquea la reactivación y permite reintentar reutilizando el manifiesto. Sigue sin haber transacción distribuida ni rollback de archivos ya eliminados. | `supabase/functions/board-delete/index.ts:40-56`, `supabase/migrations/202611060001_inactive_board_readonly.sql:113-166` | Si la limpieza de Storage falla a medias, quedan objetos retirados y filas conservadas; no hay restauración. | Medio | Mantener el reintento administrativo y el bloqueo de reactivación; no afirmar atomicidad. Cerrar la deuda en remoto solo tras aplicar `202611060001`, desplegar `board-delete` y verificar el flujo con una sesión real. |
| D-10 | Abierta/mitigada por diseño: OAuth Server beta, DCR y hook global. `202610290001` fue verificada en remoto el 2026-10-29; `202610300002` unifica permisos y avance solo localmente. | `supabase/migrations/202610280002_mcp_identity.sql:23-45`, `202610300002_mcp_unified_consent.sql:5-174` | Nombre DCR no acredita confianza; el cliente autorizado recibe contenido privado y puede ejecutar cambios acotados automáticamente. | Medio | Mantener aislamiento y proyecciones; probar autoaprobación con y sin consentimiento de aplicación, ampliación de grants válidos, asignación/estados y revocación completa en E2E antes de declarar el flujo completo. No ampliar el hook global por accidente. |
| D-11 | Abierta, parcialmente mitigada: el ledger remoto no representa todos los cambios SQL observados en el schema; `202610260002` quedó aplicada y registrada el 2026-11-02. | `supabase/README.md`, `.data/04-schema.md`; migraciones `202610220002`, `202610260001`, `202610260003`, `202610280001` | El ledger consultado el 2026-11-02 incluye ya `202610260002`, además de las entradas MCP hasta `202610300002`, pero sigue sin las cuatro versiones citadas. El inventario histórico observó algunos de sus objetos; su estado completo no se volvió a comprobar. La ausencia de `delete_inactive_board` sí quedó corregida, no la discrepancia global. Un push global podría intentar recrear objetos existentes. | Medio | Comparar ledger y objetos antes de cada operación; no reaplicar `202610260002` ni marcar otras entradas sin comprobar sus DDL. Mantener reconciliación explícita y no hacer `db push` a ciegas. |

## 🟢 Baja

| # | Hallazgo | Ubicación | Impacto | Esfuerzo | Recomendación |
| --- | --- | --- | --- | --- | --- |
| D-12 | Limitación de compatibilidad MCP: el firmador rechaza rutas legacy/otros orígenes no validables. | `supabase/functions/mcp/task.ts:49-92` | Devuelve metadata y `download_error`, aunque el portal pueda resolver el archivo con sus policies. | Medio | Inventariar referencias sin exponer datos privados y planificar una reconciliación de paths si se requiere; no relajar el firmador ni mover archivos como efecto de documentar. |
| D-13 | Paginación MCP por offset sin snapshot entre llamadas. | `supabase/migrations/202610280003_mcp_task_read.sql:98-111` | Nuevos comentarios/adjuntos o borrados pueden desplazar páginas; no garantiza una captura histórica consistente. | Medio | Registrar la limitación, no modificar colecciones durante el test de paginación y evaluar cursores/snapshot si se requiere consistencia fuerte. |
| D-14 | La tabla `mcp_task_operations` conserva payload y resultado completos para garantizar reintentos idempotentes; no tiene expiración/retención y no se elimina al revocar OAuth. | `supabase/migrations/202610290001_mcp_workflow.sql:195-207,287-290` | Puede quedar una copia de datos privados de la interacción más tiempo que el grant, además del comentario visible en la tarea. | Medio | Decidir plazo de retención y evaluar almacenar solo recibo/campos mínimos o una limpieza controlada; conservar protección contra comentarios duplicados. |
| D-05 | Las lecturas listadas no muestran paginación; las listas se solicitan sin límite explícito en el cliente. | `src/features/board/api.ts:5-12`, `src/features/board/commentsApi.ts:5-14`, `src/features/board/attachmentsApi.ts:5-10` | Con crecimiento de datos, respuesta y consumo pueden crecer sin límite visible en esta capa. | Medio | Definir paginación/ventana si los volúmenes lo requieren y documentar el contrato. |
| D-06 | El conteo de pendientes se recalcula en cada listado: la RPC ejecuta un subselect correlacionado sobre `tasks` por tablero, y el cliente refresca cada 30 s. | `supabase/migrations/202610220002_board_lifecycle.sql:71-85`, `src/features/boards/api.ts:20-22` | Con muchos tableros y tareas el coste de la consulta crece; no hay caché ni materialización del conteo. | Medio/alto | Medir en el entorno real; considerar vista materializada o columna mantenida si el volumen lo justifica, o ampliar el intervalo de refresco. |
| D-07 | **Resuelto**: el contrato nuevo (`boards.is_active` y las RPCs `rename_board`, `set_board_active`, `list_boards_with_pending_counts`) está en el bootstrap y en migraciones, **se aplicó en el proyecto Supabase remoto el 2026-10-22** (en el orden `202610220001` → `202610220002`) y la SPA se **publicó en GitHub Pages con `v0.6.0` el 2026-10-22** (run `39860177282`, `headSha=21a44df`). | `supabase/migrations/202610220002_board_lifecycle.sql`, `supabase/migrations/202610220001_board_access_returning.sql`, `supabase/README.md` | La base remota y el frontend desplegado ya usan el mismo contrato; en una base sin las migraciones el listado por RPC fallaría y el selector quedaría en error con reintento. | Bajo | Mantener el orden de migraciones en instalaciones nuevas y repetir la comprobación manual del ciclo de vida contra el servicio real (sigue sin verificación E2E con cuentas reales). |
| D-08 | **Resuelto**: la verificación funcional de `promote-admin` en producción se completó el 2026-10-22 con una sesión real de administrador —la persona responsable del proyecto confirmó que el botón «Hacer administrador» de «Usuarios» funciona correctamente—. La comprobación se produjo tras el redeploy verificado (versión 4, ACTIVE, código remoto idéntico byte a byte al del repo; la versión 3 no contenía la acción) y tras el rechazo sin sesión (401 con el mensaje propio de la función, no del gateway). | `supabase/functions/admin-users/index.ts:68`, `supabase/functions/admin-users/validation.ts:33`, `src/features/users/UsersPage.tsx:113` | El flujo de promoción a administrador queda comprobado en producción; la comprobación fue manual, no automatizada. | — | Repetir la comprobación manual cuando cambie el contrato de `admin-users`; no hay E2E automatizado con cuentas reales ni auditoría de accesibilidad. |
| D-15 | **Abierta (2026-11-06, publicada en `v0.16.0`):** la migración `202611060001_inactive_board_readonly.sql` y la Edge Function `board-delete` no están aplicadas ni desplegadas en remoto. La migración no es idempotente (renombra funciones y crea objetos). | `supabase/migrations/202611060001_inactive_board_readonly.sql`, `supabase/functions/board-delete/README.md` | El entorno desplegado sigue admitiendo escrituras en tableros desactivados y conserva el borrado cliente con `delete_inactive_board`. Aplicar la migración sin desplegar la Edge deja el borrado cerrado de forma explícita. | Medio | Coordinar migración y despliegue de `board-delete` en una ventana de mantenimiento; contrastar ledger y objetos antes de aplicar; no reaplicar la migración ni restaurar los grants retirados. |
| D-16 | **Resuelta en local (2026-11-06):** Vite priorizaba las variables Supabase heredadas del shell sobre `.env.local`, de modo que el arranque local podía apuntar a un proyecto distinto del configurado. `npm run dev` ejecuta ahora `scripts/dev.mjs`, que las elimina del entorno del proceso hijo antes de cargar Vite. | `scripts/dev.mjs:1-14`, `scripts/dev-environment.mjs:1-9`, `package.json:6-9` | Sin la protección, el desarrollo local podía usar credenciales heredadas ajenas al proyecto y producir resultados engañosos. | Bajo | Mantener `npm run test:dev-env` en la verificación local; no reintroducir `vite` directo como script de desarrollo ni registrar valores de entorno. |

D-05 se limita a queries del portal de tareas/comentarios/adjuntos, no a `get_task`
(50 por defecto, máximo 100 por página), administración (50) o usuarios asignables
(500 por lote); este último acumula perfiles activos en memoria. D-12/D-13 son
límites de contrato; D-14 es una decisión de retención, no una vulnerabilidad
confirmada. Despliegue y E2E del workflow MCP siguen pendientes según
[la guía](../docs/prueba-mcp.md).

D-06 y D-07 registran el release `v0.6.0` (commit `21a44df`): el contrato de ciclo de vida se verificó aplicado en el proyecto remoto y la SPA se publicó en Pages. `admin-users` versión 4 y Auth también se verificaron el 2026-10-22; `promote-admin` se confirmó manualmente en producción (D-08 resuelto). Esta evidencia histórica cerró los pendientes de ese alcance en esa fecha, pero no acredita el estado remoto de las migraciones locales `202610260001`–`202610260003` ni de los cambios actuales. No hay E2E automatizado con cuentas reales ni auditoría de accesibilidad.

D-09, D-15 y D-16 describen el estado del 2026-11-06: el borrado solo-servidor y la protección del arranque local están implementados, verificados y publicados en `v0.16.0`, pero **el backend no está desplegado**. D-09 solo puede cerrarse en remoto tras aplicar `202611060001`, desplegar `board-delete` y comprobar el flujo con una sesión real; D-15 se cierra con esa misma ventana de mantenimiento.

## Pendiente fuera del alcance

Los comentarios y predicados de algunas policies RLS/Storage no describen exactamente la misma regla. La documentación de schema registra los predicados observados; una evaluación de seguridad requiere sincronizar `.security/` con la skill `security` o `code-review` y no se realizó aquí.
