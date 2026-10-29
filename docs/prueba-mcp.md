# Prueba MCP — consulta de contexto y workflow de tareas

## Estado y alcance

Actualización documental del **2026-10-29**. El último producto publicado revisado
es `c2677c9b9084e3a56b6db36a1783c5d722e82780` (`v0.12.1`); el consentimiento
conjunto/workflow descrito abajo pertenece a cambios locales posteriores, sin commit
ni evidencia de despliegue. Esta actualización reutiliza pruebas locales recientes y
la evidencia remota anterior; no repite despliegues ni pruebas.

| Estado | Evidencia al 2026-10-29 |
| --- | --- |
| **IMPLEMENTADO y publicado previamente** | `whoami`, `get_task`, OAuth y lectura legacy; release `v0.12.1` |
| **DESPLEGADO (evidencia previa)** | Solo `202610280003` aplicada/registrada; `mcp` Edge **v3 ACTIVE**, `verify_jwt=false`; Pages `c2677c9` |
| **IMPLEMENTADO LOCALMENTE** | `202610290001`, consentimiento workflow, lectura de adjuntos y herramientas de inicio/comentario/revisión; no desplegados ni aplicados según evidencia disponible |
| **VERIFICADO LOCALMENTE** | 203 Vitest, 19 Deno MCP, lint/build; seis suites SQL en incremental/bootstrap y pruebas de concurrencia en PostgreSQL desechable |
| **PENDIENTE REMOTO/E2E** | Aplicar migración tras preflight, desplegar Edge y SPA compatibles, OAuth/navegador, catálogo fresco, restricciones reales, procesamiento de adjuntos/Storage y flujo completo con usuario |

**No declarar «workflow MCP listo» ni «E2E aprobado».** El código local anuncia
`serverInfo.version=0.3.0`; la evidencia Edge v3 anterior corresponde a la aplicación
`0.2.0`, no a la release `0.12.1` ni a la versión numérica Edge.
Las casillas siguientes son un checklist reutilizable de preparación/E2E, no una
certificación ni una orden de reaplicar SQL. El registro de lo ejecutado está en
la sección 8. En el proyecto con la evidencia remota anterior, no reejecutar
`202610280003`; la nueva `202610290001` es otra migración local y no debe aplicarse
hasta revisar el ledger/objetos y obtener autorización operativa.

La persona comparte un UUID; el asistente consulta todas las páginas, estudia
adjuntos compatibles y pregunta dudas. Solo tras aceptación puede iniciar la tarea,
registrar un comentario de resultado y, si el usuario valida, enviarla a revisión.
No finaliza tareas, no asigna ni reabre. Estas herramientas existen en el código
local; el E2E completo está pendiente.

Referencias autoritativas: [contrato y errores](../.data/01-endpoints.md),
[DTOs](../.data/02-models.md), [schema y discrepancia remota](../.data/04-schema.md),
[arquitectura](../.architecture/README.md), [UI](../.design/components.md).
La [guía de clientes](../mcp/README.md) explica conexión y consentimiento. La
[guía Supabase](../supabase/README.md) registra activación y discrepancia del ledger.
El contrato de datos define los campos y permisos; esta guía distingue evidencia
local, SQL remoto y E2E real.

### Conexión desde Pages y desarrollo local

1. Configurar en un cliente compatible un servidor remoto **Streamable HTTP con
   OAuth**, usando la URL indicada en la guía de clientes. En OpenCode, abrir el
   repo y, si solicita autenticación, usar `opencode mcp auth dashboardFurthurr`.
   Inspeccionar cliente/callback y aceptar conscientemente los permisos de la pantalla;
   no copiar tokens ni claves. La versión remota probada antes sigue siendo fase 2.
2. En la versión local de consentimiento, la autorización inicial concede identidad,
   lectura de tareas/adjuntos, inicio, comentarios y revisión; no hay paso de habilitar
   permisos en Perfil. Si Auth autoaprueba un grant antiguo, debe aparecer el prompt
   explícito de ampliación o la opción de continuar solo con lo ya concedido.
3. Reiniciar/reconectar MCP o abrir un chat nuevo para refrescar el catálogo. El
   código local espera seis herramientas; verificar `initialize` y `tools/list` reales.
4. En Perfil → Conexiones autorizadas (`#/profile/connections`) comprobar el estado
   de permisos y probar retirar un permiso/todos y revocar grant. No habilitar desde
   esa página. Para local ejecutar `npm run dev` con configuración segura ya preparada y abrir
   `http://localhost:5173/dashboardFurthurr/#/profile/connections`. Confirmar que
   ambos frontends apuntan al entorno acordado; no asumirlo por servir HTML.
5. Copiar el UUID de una tarea de prueba y continuar con la sección 5. El permiso de
   workflow local sigue el grant OAuth; la validación de sesión activa se realiza en
   cada solicitud. No inferir comportamiento remoto hasta desplegarlo.

No hace falta un backend en Pages ni un Supabase íntegramente local. El portal
gestiona consentimiento mediante RPC Supabase (`src/features/auth/mcpWorkflowAccess.ts`),
no llamando al endpoint MCP desde el navegador. En la comprobación operativa, el
preflight Edge permitió Pages, rechazó localhost y un origen ajeno. Los clientes
nativos sin `Origin` no necesitan CORS; un cliente web que envíe `Origin` sí debe
estar permitido. No ampliar la allowlist ni cambiar Auth Site URL improvisadamente.

## 1. Preparar el entorno y los datos de prueba

Responsable operativo: `developer` o persona administradora del entorno. La
documentación no aplica migraciones ni publica servicios. Usar preferentemente
un **proyecto de pruebas**, no datos privados de producción.

- [ ] Identificar el proyecto Supabase y el frontend/cliente MCP que realmente se
  van a probar; todos deben apuntar al mismo entorno. No asumir que Vite usa una
  base local: el frontend puede estar conectado al Supabase remoto.
- [ ] Revisar estado/diff local y acordar el conjunto de cambios a publicar;
  existen cambios ajenos en `src/features/boards/`, `.sdd/` y lockfile raíz.
  No hacer push/commit global como efecto de este checklist.
- [ ] Tener respaldo y plan operativo para el cambio SQL. No reejecutar
  `supabase-schema.sql` sobre una instalación existente ni ejecutar `db push`
  global para resolver el ledger desalineado.
- [ ] Preparar cuentas de prueba: A (miembro de tablero activo), B (sin membresía
  en ese tablero), un admin activo y, si procede, una cuenta invitada miembro.
- [ ] Preparar una tarea de prueba con título, descripción, notas, estado,
  prioridad, responsables, al menos dos comentarios y dos archivos sin datos
  sensibles. Subir los archivos desde la UI actual para usar paths de tarea.
- [ ] Preparar una tarea con colecciones vacías y otra de un tablero inaccesible
  para A; no usar IDs ni contenido reales en documentos de evidencia.

No leer/copiar valores de `.env*`, claves o almacenes de credenciales. No imprimir
tokens ni URLs firmadas para comprobar configuración. La disponibilidad de firma
se comprueba mediante descarga controlada, no exponiendo la credencial servidor.

## 2. Verificación automática local disponible

Comandos para el responsable de pruebas, desde la raíz del repo:

```bash
npm ci
npm audit
npm audit --omit=dev
npm run test -- --run --no-file-parallelism
npm run lint
npm run build
deno test --config supabase/functions/mcp/deno.json --allow-env --allow-read --allow-net supabase/functions/mcp/index_test.ts supabase/functions/mcp/workflow_test.ts
deno test --allow-read --allow-run=docker supabase/tests/mcp_sql_test.ts
```

Requieren dependencias instaladas, Deno y Docker en ejecución; no instalar o
reemplazar dependencias como efecto implícito de documentar. El harness usa imagen
`postgres:16` en un contenedor desechable sin red, con Auth/Storage simulados.
`mcp_sql_test.ts` reproduce bootstrap completo e incremental (`202610280002` +
`202610280003` + `202610290001`), seis probes con fixtures revertidos, más llamadas
concurrentes para conflicto de versión e idempotencia. El script legado
`run_mcp_task_read.sh` también ejecuta el subconjunto del flujo de lectura. Ninguna
de estas pruebas certifica Supabase Auth/Storage reales.
**Nunca ejecutar `mcp_harness.sql` en un proyecto Supabase.**

Evidencia local de la implementación del workflow (reutilizada, no repetida aquí):
203 Vitest en 22 archivos, 19 Deno MCP, lint/build, seis probes SQL en ambas rutas
y dos pruebas concurrentes PASS. PostgreSQL 16/Auth/Storage simulados no validan
servicios reales. No se hizo E2E OAuth ni descarga real. El build mantiene avisos de
bundle >500 kB y `__dirname` ante el futuro loader nativo de Vite. No equivale a una
auditoría de seguridad completa.

## 3. Preparar Supabase sin aplicar cambios a ciegas

- [ ] Consultar el ledger y los objetos reales. La evidencia de fase 1 registró
  cambios de ciclo de vida/asignación y avatares que no estaban todos en el ledger.
  Resolver con el responsable la secuencia efectiva, sin ejecutar migraciones
  históricas duplicadas ni marcar objetos como aplicados por simple presencia.
- [ ] Confirmar requisitos: tablas de tarea/relaciones y tablero con `is_active`,
  Auth OAuth con `oauth_clients`/`sessions`, configuración de audiencia y
  `mcp_whoami()` de `202610280002` funcional.
- [ ] La evidencia remota previa registra `202610280003`; no volver a aplicarla.
  Revisar el ledger y objetos del proyecto real antes de proponer el workflow local
  [`202610290001_mcp_workflow.sql`](../supabase/migrations/202610290001_mcp_workflow.sql).
  Requiere tabla de lectura legacy, tablas de tarea/adjunto/tablero y tablas Auth
  `oauth_consents`/`oauth_authorizations`. No es idempotente para reejecución.

Consultas de inventario **de solo lectura**, para una conexión operativa autorizada
(no incluyen datos de cuentas, tareas o credenciales):

```sql
select version from supabase_migrations.schema_migrations order by version;

select
  to_regclass('public.tasks') as tasks,
  to_regclass('public.boards') as boards,
  to_regclass('auth.sessions') as oauth_sessions,
  to_regclass('auth.oauth_clients') as oauth_clients,
  to_regclass('auth.oauth_consents') as oauth_consents,
  to_regclass('auth.oauth_authorizations') as oauth_authorizations,
  to_regclass('public.mcp_task_read_permissions') as legacy_task_permissions,
  to_regclass('public.mcp_workflow_permissions') as workflow_permissions,
  to_regclass('public.mcp_task_operations') as workflow_operations;

select table_schema, table_name, column_name, data_type
from information_schema.columns
where (table_schema = 'public' and table_name = 'boards' and column_name = 'is_active')
   or (table_schema = 'auth' and table_name = 'sessions'
       and column_name in ('id', 'user_id', 'oauth_client_id', 'not_after'))
order by table_schema, table_name, column_name;

select
  to_regprocedure('public.mcp_whoami()') as identity_rpc,
  to_regprocedure('public.mcp_get_task(uuid,integer,integer,integer)') as task_rpc,
  to_regprocedure('public.mcp_get_attachment(uuid,uuid)') as attachment_rpc,
  to_regprocedure('public.mcp_work_task(uuid,text,uuid,timestamptz,jsonb)') as work_rpc,
  to_regprocedure('public.mcp_list_workflow_access()') as permissions_rpc,
  to_regprocedure('public.mcp_authorize_workflow(text)') as consent_rpc;
```

Presencia no demuestra definición, grants ni aplicación registrada. Si los objetos
nuevos ya existen, detenerse y comparar sus definiciones; no reejecutar el archivo.

- [ ] Solo tras comparar SQL/objetos y aprobar la operación con la persona responsable,
  aplicar `202610290001` si está realmente pendiente y registrar evidencia. No editar
  manualmente el ledger ni ejecutar un push global como atajo. El `ROLLBACK` de tests
  no revierte la migración persistente.
- [ ] En proyecto de pruebas, ejecutar
  [`supabase/tests/mcp_task_read.sql`](../supabase/tests/mcp_task_read.sql) y
  [`supabase/tests/mcp_workflow.sql`](../supabase/tests/mcp_workflow.sql) y
  [`supabase/tests/mcp_identity.sql`](../supabase/tests/mcp_identity.sql) con conexión
  autorizada para fixtures; confirmar `PASS` y `ROLLBACK`. Revisar compatibilidad
  del schema administrado Auth antes de ejecutar fixtures de clientes/sesiones.
  Esto no valida descargas reales de Storage ni una conexión OAuth del cliente.
- [ ] Confirmar fronteras: `mcp_identity` sin grants directos de tablas/Storage ni
  gestión de consentimientos; solo `mcp_work_task` puede mutar y valida action allowlist,
  permiso, asignación, estado y versión. RPC de autorización/listado/revocación solo
  para sesión ordinaria activa del portal.

## 4. Desplegar las piezas compatibles

Solo para el responsable con autorización operativa. El procedimiento siguiente
sirve para otra instalación o un cambio futuro; la evidencia remota anterior cubre
`202610280003` y Edge fase 2, no `202610290001` ni la versión local 0.3.0. No
repetir la migración ya registrada; hacer preflight antes de proponer la nueva.

1. Aplicar y comprobar SQL revisado antes de ofrecer el consentimiento de workflow.
2. Desplegar la Edge Function revisada en el proyecto seleccionado:

   ```bash
   supabase functions deploy mcp --project-ref <project-ref>
   ```

3. Confirmar por comportamiento que el runtime dispone de `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, `MCP_RESOURCE_URL` y, para la firma, la credencial
   exclusivamente servidor `SUPABASE_SERVICE_ROLE_KEY`. `MCP_ALLOWED_ORIGINS`
   debe incluir el origen de prueba si el cliente envía `Origin`. No imprimir
   valores, agregar secretos a presets ni llevarlos a `VITE_*`.
4. Conservar el gateway MCP `verify_jwt=false` de `supabase/config.toml:9-11`:
   permite discovery público, **no desactiva la verificación JWT dentro de Edge**.
   No cambiar hooks/Auth globales ni otras funciones para probar esta fase.
5. Publicar el frontend compatible mediante el workflow habitual. Pages no aplica
   SQL ni despliega Edge. Alternativa para probar UI: Vite con un proyecto de pruebas
   ya configurado; no trasladar Auth Site URL a localhost improvisadamente.
6. Reconectar cliente MCP para refrescar catálogo. La versión local debe anunciar seis
   herramientas; no asumir el comportamiento solo por la conexión de identidad o por
   el nombre de servidor.

Si hay despliegue parcial en otra instalación, no dar por lista la prueba. Registrar qué pieza falta:
una web nueva contra SQL anterior mostrará permisos «Sin verificar», y un MCP
anterior seguirá limitado a las herramientas desplegadas aunque el consentimiento
del cliente ya se haya realizado.

## 5. Prueba mínima de punta a punta

La secuencia siguiente aplica **solo después** de aplicar en un proyecto de prueba
la nueva migración y desplegar una Edge/SPA compatibles. Mientras eso no ocurra,
no esperar el comportamiento local descrito en la herramienta remota.

### A. Consentimiento y catálogo

- [ ] Desde una conexión OAuth nueva, revisar cuenta activa, cliente, callback y
  lista de cinco permisos en `#/oauth/consent`; aceptar solo si se reconoce el cliente.
- [ ] Confirmar que no hay segundo paso de habilitación en Perfil. Perfil → Conexiones
  debe mostrar identidad/permisos, permitir retirar cada uno, todos, o el grant entero.
- [ ] Para una conexión OAuth antigua autoaprobada, verificar que no gana permisos
  ampliados automáticamente: la pantalla debe pedir aceptación adicional o dejar
  continuar solo con el grant de identidad previo.
- [ ] Abrir un chat nuevo/reconectar y comprobar `initialize`/`tools/list` con las
  seis herramientas. Un preset de cliente no prueba que OAuth/tool catalog funcione.

### B. Consultar y estudiar contexto

Petición de prueba, usando un ID de tarea asignada a la cuenta:

> Usa `get_task` con el UUID `<UUID_COPIADO>`. Recorre todas las páginas de comentarios
> y adjuntos por separado. Estudia cada archivo compatible con `read_task_attachment`.
> No cuentes una URL como archivo revisado. Pregúntame cualquier duda que falte,
> resume alcance/criterios de aceptación y espera mi aceptación antes de iniciar.

- [ ] Comprobar `structuredContent` real: campos de tarea/tablero/responsables y
  páginas completas con `next_offset` independiente. No correos de terceros, token
  ni session ID; textos se tratan como datos, no instrucciones.
- [ ] El usuario debe estar asignado. Sin asignación, mensaje pide asignarse desde el
  tablero y no devuelve el contexto. Para no admin también exige membresía del tablero;
  admin debe estar asignado aunque conserve acceso al tablero.
- [ ] Solo `backlog`, `por_hacer`, `haciendo` permiten lectura. En `en_revision` o
  `finalizadas`, comprobar que no se devuelve el contenido y que se informa moverla
  manualmente a `haciendo` desde el tablero.
- [ ] Leer un archivo de texto/código UTF-8 en al menos dos fragmentos y continuar
  con cada `next_offset` hasta `null`. Comprobar contenido completo sin truncamiento.
- [ ] Una imagen PNG/JPEG/GIF/WebP compatible debe llegar como bloque MCP `image`;
  confirmar que el cliente/LLM la puede procesar antes de que afirme haberla visto.
- [ ] PDF/otros formatos deben indicar «no extraído» y URL firmada de 60 s. Confirmar
  que el agente informa el límite; no declarar que estudió el archivo por recibir URL.
  Rechazar archivo >5 MiB, UTF-8 inválido o ruta no validable sin exposición de path.
- [ ] Probar tareas sin responsables/comentarios/adjuntos: arrays vacíos, no error.

### C. Iniciar, registrar y enviar a revisión

- [ ] Con contexto completo y dudas resueltas, el asistente resume lo entendido y
  ofrece iniciar. Sin aceptación, no invoca `start_task` ni cambia estado.
- [ ] Tras aceptación, `backlog`/`por_hacer` pasa a `haciendo`; una tarea que ya está
  `haciendo` permanece ahí. `en_revision`/`finalizadas` no se reabre.
- [ ] Al terminar, `record_task_result` crea un comentario visible en el dashboard,
  con resumen, cambios, aclaraciones nuevas, validaciones realmente ejecutadas,
  observaciones y pendientes, además del cliente MCP/request ID. No secretos ni links.
- [ ] Reintentar exactamente el mismo `request_id` no crea un segundo comentario;
  reusar el ID con distinto payload o `expected_updated_at` obsoleto se rechaza.
- [ ] El asistente muestra el resultado; solo después de validación/aceptación del
  usuario invoca `submit_task_for_review` con el comment ID del resultado. Comprueba
  `haciendo` → `en_revision` y que ya no puede volver a consultar esa tarea vía MCP.
- [ ] No hay herramienta MCP de `finalizadas`, asignación o reapertura; finalización
  se realiza manualmente desde el tablero.

Los flags `user_approved` y `user_validated` que recibe SQL son declaraciones del
cliente: la base no puede inspeccionar la conversación ni probar que el modelo
examinó todas las páginas/archivos. Esta parte exige observar el cliente interactivo.

## 6. Matriz de controles de acceso y recuperación

Ejecutar con cuentas y datos de prueba, restaurando asignaciones/membresías/estados.
No desactivar la única cuenta admin ni usar tareas privadas de producción.

| Caso | Resultado esperado |
| --- | --- |
| Concesión nueva | Una aprobación explícita concede los permisos listados; scopes `email profile` no son autorización de datos |
| Consentimiento OAuth anterior autoaprobado | No hay ampliación silenciosa; aceptar permiso extra o continuar con identidad anterior |
| Usuario/invitado miembro y asignado a tarea permitida | Consulta permitida |
| Admin no asignado | Denegado por asignación igual que otros roles |
| Usuario asignado sin membresía de tablero | Denegado; asignación sola no sustituye membresía para no admin |
| Usuario con acceso de tablero, no asignado | Mensaje de autoasignación manual; no revela contenido de tarea |
| `backlog`, `por_hacer`, `haciendo` | Lectura/adjunto habilitados si permiso y asignación siguen vigentes |
| `en_revision`, `finalizadas` | Sin contexto ni mutaciones; pide cambio manual a `haciendo` |
| Retirar `read_tasks` o todos los permisos | MCP deja de leer/trabajar; `whoami` y conexión OAuth permanecen |
| Retirar permiso de comentario/revisión | Solo acción correspondiente denegada; listado refleja retiro |
| Revocar grant OAuth | Solicitudes posteriores rechazadas por sesión/grant inválidos |
| Cuenta inactiva, sesión revocada o expirada | Sin acceso a tarea ni operación |
| Quitar asignación/membresía o desactivar tablero | Nuevas llamadas se deniegan según el actor/board rule |
| Inicio con flag falso/sin alcance | Argumento rechazado, tarea no cambia |
| Resultado en tarea distinta de `haciendo` | Rechazado; no comentario nuevo |
| Revisión sin flag de validación/comentario MCP actual | Rechazada; no cambia estado |
| Solicitud concurrente con `updated_at` antiguo | `PT428`; releer antes de reintentar |
| Recibo retry igual / request ID con payload diferente | Reintento no duplica; payload distinto se rechaza |
| Adjuntos externos/legacy no validables o >5 MiB | No descarga path no confiable; muestra error seguro |

Un token inválido/revocado puede producir HTTP 401 antes de llamar herramienta; una
denegación interna devuelve `isError=true`. No interpretar HTTP 200 como éxito si
MCP devuelve `isError`, un enlace como archivo estudiado, ni una página como colección
completa. Retirar acceso tampoco recupera datos ya descargados ni invalida URLs aún vigentes.

## 7. Diagnóstico rápido

| Síntoma | Comprobación siguiente |
| --- | --- |
| Solo aparece `whoami` o `get_task` | Confirmar entorno/versión Edge y refrescar catálogo; el Edge v3 histórico no incluye las herramientas del código local `0.3.0` |
| Perfil muestra permisos sin verificar | Revisar que la migración workflow esté aplicada y que frontend y servidor correspondan al mismo entorno |
| Consentimiento antiguo abre autorización extra | Aceptar ampliación explícita o continuar sin ampliar; no hacer grants manuales en SQL |
| «Puede faltar la migración del MCP» | Revisar presencia/contrato de RPCs, grants y schema cache en el proyecto correcto; no repetir migración sin comparar |
| «No estás asignado» | Asignar la cuenta al registro desde el tablero; ni admin omite el requisito |
| Tarea inaccesible en En revisión/Finalizadas | Moverla manualmente a Haciendo desde el tablero; el MCP no reabre |
| «Tarea no disponible o sin acceso» | UUID/entorno y acceso al tablero; para no admin se requiere membresía explícita además de asignación |
| Archivo no estudiado / `download_error` | Comprobar tipo, tamaño <=5 MiB, UTF-8 o firma de imagen, ruta y acceso; una URL no prueba lectura |
| OAuth rechaza conexión | Audiencia/JWKS/issuer, sesión y allowlist Origin; no usar token del portal ni debilitar controles |
| HTTP 401 al ejecutar OpenCode | Separar fallo de proveedor del modelo, autenticación de su API local y challenge del MCP; un 401 de otra capa no acredita fallo de `get_task` |
| Vite muestra ENOENT en Tailwind tras cambiar dependencias | Reiniciar el proceso de desarrollo y comprobar carga del CSS; no reinstalar paquetes o alterar lockfiles como primer paso |

Si se necesita detener una prueba, retirar el permiso concreto o todos desde
Conexiones y parar el cliente. Revocar el grant completo es diferente y quita
identidad. Rollback SQL/despliegue es operación aparte que debe planear la persona
operadora; no borrar comentarios de resultado ni retirar masivamente grants reales.

## 8. Registro de resultados, sin secretos

Registro de la operación del **2026-10-29**, contrastado con la release publicada.
No se copiaron identidad, tokens, contenido privado ni enlaces firmados. Esta
actualización documental no repite pruebas ni consulta nuevamente Supabase.

| Campo | Resultado y límite |
| --- | --- |
| Fecha y entorno | 2026-10-29; proyecto `furthurr'sDashboard`, ref `uujxatuuktccwkvavksr`; el mismo proyecto exige todavía E2E con cuentas de prueba |
| Commit de producto probado | `a6adb89` y `c2677c9b9084e3a56b6db36a1783c5d722e82780`; tag anotado v0.12.1, main y tag publicados |
| Migración 202610280003 | Aplicada únicamente esta migración, con dry-run previo en directorio temporal que contenía el historial remoto descargado; ledger, definiciones, columnas, grants, RLS y FK comprobados. No se reparó el ledger histórico |
| Deploy Edge | `mcp` v3 ACTIVE; `verify_jwt=false`; la descarga coincidía con el baseline local de fase 2 en la fecha de comprobación, no con el workflow actual. `0.2.0` en ese código; `initialize` autenticado pendiente |
| Publicación del portal | [Run 40923924908](https://github.com/furthurr/dashboardFurthurr/actions/runs/40923924908), success para `c2677c9`; HTML y nuevos assets JS/CSS con HTTP 200 |
| Frontend local | Vite sirvió HTML y módulo principal con HTTP 200; no acredita login ni consentimiento local |
| Cliente e identidad | OpenCode CLI 1.18.34 informó OAuth conectado; `whoami` real funcionó desde el cliente de esta sesión tras despliegue. No se registró versión Desktop ni catálogo fresco completo |
| Consentimiento y consulta de tarea | SQL remoto aprobado; consentimiento de navegador y consulta satisfactoria vía `get_task` real pendientes |
| Personas, páginas y colecciones vacías | Deno local y SQL remoto aprobados, incluidos offsets independientes; comparación por MCP/UI real pendiente |
| Descarga, caducidad/renovación y legacy | Validador/fallos de firma cubiertos localmente; descarga y caducidad reales no comprobadas |
| Denegaciones/revocación/sesión nueva | SQL remoto PASS para usuario/invitado/admin, membresía frente a asignación, tablero/cuenta inactivos, sesión expirada/revocada, retirada sin perder identidad y no herencia. E2E con cuentas reales pendiente |
| HTTP y CORS | MCP sin bearer: 401 con challenge; preflight Pages permitido, localhost y origen ajeno rechazados |
| Revisión UI móvil/teclado/portapapeles | Pendiente; build/Vitest no sustituyen revisión visual real |
| Limpieza | Fixtures SQL revertidos; comprobada ausencia de cuentas/clientes/tableros de prueba residuales, recurso canónico conservado y cero permisos de lectura al finalizar la operación |
| Bloqueos | Ejecución por modelo de OpenCode CLI: HTTP 401; API local de OpenCode autenticada; controlador GUI `orca` no disponible. No se extrajeron credenciales ni se rebajaron controles |
| Siguiente responsable/paso | `developer` o persona operadora con cliente renovado y cuenta de prueba en navegador: completar secciones 5–6 desde local y Pages, incluidos Storage real y retirada de permisos |

Las guías y la release **no acreditan E2E completo**. Para cerrar el pendiente,
registrar cliente/versión, resultado de cada caso y limpieza sin datos sensibles.

### Implementación workflow local — evidencia del 2026-10-29, sin activación remota

La operación de producto posterior a la release ejecutó **203 pruebas Vitest en 22
archivos**, **19 Deno MCP**, `npm run lint`, `npm run build` y PostgreSQL 16 desechable.
El harness pasó seis suites (`mcp_identity`, `mcp_task_read`, `mcp_workflow`, `boards`,
`task_assignments`, `user_access`) tanto en bootstrap como incremental, además de
pruebas concurrentes de versión y comentario idempotente. Fixtures con Auth/Storage
simulados terminaron revertidos. Esto no aplica `202610290001` en Supabase ni valida
OAuth, navegador, Storage real, cliente visual o comprensión de contenido por el LLM.

| Elemento local | Estado conocido |
| --- | --- |
| Código Edge y contrato | `serverInfo.version=0.3.0`, seis herramientas; no consta deploy posterior al Edge v3 histórico |
| Migración | `202610290001_mcp_workflow.sql` añadida al bootstrap local; **no consta aplicada en remoto** |
| OAuth/UI | Un consentimiento inicial conjunto y gestión/retirada desde conexiones; no se verificó navegador remoto |
| Adjuntos | Lector local de texto UTF-8 e imágenes PNG/JPEG/GIF/WebP, máximo 5 MiB; otros formatos avisan no extraídos; descarga real pendiente |
| Flujo de tarea | Asignación requerida para todos los roles; `backlog`/`por_hacer` → `haciendo`; comentario de resultado; tras validación → `en_revision`; nunca `finalizadas` |
| E2E | Pendiente de preflight SQL, despliegue autorizado de migración/Edge/Pages y prueba con cuenta/cliente compatibles |

Los mensajes e instrucciones del LLM guían conversación, no certifican que el usuario
aprobó verbalmente ni que los archivos se hayan entendido. Las flags de aprobación
son declaradas por el cliente; antes de declarar listo hay que comprobar el flujo real.
