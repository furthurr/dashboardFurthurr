# Entornos y configuración

La aplicación valida que las variables de Supabase existan al inicializar el cliente (`src/lib/supabase.ts:3-10`). Los siguientes valores son placeholders de formato, no credenciales ni URLs reales.

| Variable | Uso | Local | CI / despliegue |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Configurar en entorno local como `https://<project-ref>.supabase.co` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publishable del cliente | Configurar en entorno local como `<publishable-key>` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |

Solo servidor Edge, nunca en el build Vite:

| Variable | Uso | Configuración |
| --- | --- | --- |
| `SUPABASE_URL` | Proyecto que usa `admin-users` y `board-delete` | Entorno de funciones Supabase; `<project-url>` |
| `SUPABASE_SERVICE_ROLE_KEY` | Administración; borrado de tableros; MCP la usa solo en Edge para firmar/descargar adjuntos ya autorizados y validados | Secreto del entorno servidor; `<server-secret>`, nunca `VITE_*`, cliente MCP ni documentación de valores |

Fuente: `supabase/functions/admin-users/index.ts:20-23`, `supabase/functions/board-delete/index.ts:19-21`. Los placeholders no representan valores desplegados.

`board-delete` usa la credencial de servicio **solo en servidor** para ejecutar las RPCs `prepare_board_deletion` / `finish_board_deletion` (concedidas solo a `service_role`) y para eliminar objetos del bucket `task-attachments`. La identidad del actor se deriva del bearer verificado por `auth.getUser`, nunca del cuerpo de la petición (`supabase/functions/board-delete/index.ts:16-54`).

MCP consulta identidad/tareas/adjuntos y mutaciones acotadas con `SUPABASE_ANON_KEY`
y bearer OAuth individual, con `role=mcp_identity`. El lector de adjuntos firma y
descarga con un cliente separado que usa `SUPABASE_SERVICE_ROLE_KEY` solo en runtime
Edge tras RPC autorizada y validar task/bucket/path. La lectura está limitada a
5 MiB y formatos documentados; el rol OAuth no recibe acceso directo a Storage.
El workflow `202610290001` fue desplegado históricamente; la versión exacta remota del código y consentimiento unificado posteriores no está acreditada.
Fuente: `supabase/functions/mcp/index.ts:67-104`, `supabase/functions/mcp/workflow.ts:28-103`.

| Variable/ajuste | Uso | Restricción |
| --- | --- | --- |
| `SUPABASE_URL` | URL de Auth/PostgREST/JWKS, inyectada en el runtime Edge | Mantener el issuer estándar del mismo proyecto |
| `SUPABASE_ANON_KEY` | Clave publishable del proyecto para crear el cliente de la RPC | Sólo runtime Edge; no es privilegio ni reemplazo del bearer del usuario |
| `SUPABASE_SERVICE_ROLE_KEY` | Firma de adjuntos por 60 s, exclusivamente servidor | No se lee/copia su valor para preparar el test; validar su disponibilidad mediante una descarga controlada en el entorno de prueba |
| `MCP_RESOURCE_URL` | Audiencia canónica validada por el handler y `mcp_whoami()` | Debe coincidir exactamente con `mcp_oauth_configuration.resource_url`; HTTPS y la ruta `/functions/v1/mcp` |
| `MCP_ALLOWED_ORIGINS` | Allowlist CORS de orígenes web si se requiere | Lista separada por comas; vacío no añade Origins de navegador |
| Auth Site URL / Authorization Path | URL raíz de la SPA y path de consentimiento GoTrue | La SPA actual es Pages con HashRouter: Site URL al root publicado y Authorization Path `/`; GoTrue añade `authorization_id` como query |
| Custom Access Token Hook | Cambia claims de tokens OAuth para el rol/recurso MCP | `pg-functions://postgres/public/mcp_access_token_hook`; preservar tokens normales y no sobrescribir hooks existentes |

OAuth Server de Supabase está en beta. Auth debe firmar con ES256/RS256 (JWKS) para
que el MCP valide firma y audiencia; no habilitar el hook si el proyecto usa HS256
sin un plan aparte de rotación de claves. DCR está activado para los clientes MCP.

## Build/deploy observado

- **Estado 2026-11-06 (publicado en `v0.16.0`, sin desplegar en Supabase):** la migración `202611060001_inactive_board_readonly.sql` y la Edge Function `board-delete` están versionadas, pero **no están aplicadas ni desplegadas en remoto**. `supabase/config.toml` declara `[functions.board-delete]` con `verify_jwt = false`: la comprobación del bearer la hace el propio handler. El push a `main` publica la SPA en GitHub Pages, pero Pages no despliega SQL ni funciones: hasta que la función esté desplegada, el borrado de tableros desde la SPA publicada sigue usando el flujo antiguo; aplicar la migración sin desplegar la Edge deja el borrado cerrado de forma explícita. Coordinar los tres pasos en una ventana de mantenimiento ([guía](../docs/tableros-solo-lectura.md)).
- Pages: [run 41576684027](https://github.com/furthurr/dashboardFurthurr/actions/runs/41576684027) terminó correctamente para `f501082` / `v0.14.0`. El backend no se verificó de nuevo. Las observaciones siguientes son históricas del 2026-10-29 salvo indicación distinta.
- Fase 2 activada en el proyecto acordado: solo `202610280003` aplicada/registrada;
  `mcp` **Edge v3 ACTIVE**, `verify_jwt=false`, código remoto coincidente con el
  baseline anterior (`index.ts`, `task.ts`, `deno.json`).
- Workflow activado el 2026-10-29: `202610290001_mcp_workflow.sql` aplicada y
  registrada; `mcp` **Edge v4 ACTIVE** (`verify_jwt=false`) con aplicación MCP
  `0.3.0`. Los hashes de `index.ts`, `task.ts`, `workflow.ts` y `deno.json` descargados
  coinciden con el repositorio. No confundir release `0.13.0`, aplicación MCP `0.3.0`
  y Edge v4. `initialize` autenticado fresco sigue pendiente.
- Pages run `40963945319` terminó en success para `0ebb61d` (v0.13.0); HTML y nuevos
  assets JS/CSS respondieron 200. Vite también sirvió HTML/módulo principal.
  Ni disponibilidad HTTP ni compilación prueban entorno local efectivo o flujo
  autenticado: [registro y procedimiento](../docs/prueba-mcp.md).
- React Router DOM 7.18.5, Zod 4.6.7 (SPA/Edge), Vite 8.3.5 y transitivas npm
  corregidas; auditorías npm completa/producción y Deno sin avisos conocidos.
  `npm ci`, 200 Vitest, lint/build y 11 Deno MCP/12 administración correctos.
  Verificación npm repetida sobre release aislada; Vitest pasó con placeholders
  tras fallar por configuración ausente. No se copiaron credenciales reales.
- Instalación reproducible por `npm ci` y build mediante `npm run build` (`.github/workflows/deploy.yml:24-37`).
- El build sube `dist` como artefacto de GitHub Pages (`.github/workflows/deploy.yml:39-53`).
- El prefijo de hosting está fijado en `vite.config.ts:6-13`.
- El repositorio por sí solo no acredita los valores configurados de GitHub ni qué proyecto usa cada entorno. La operación verificó el proyecto remoto mediante herramientas autenticadas; no inspeccionó secretos ni demostró login local. Antes de E2E confirmar el mismo proyecto en ambos frontends sin leer/copiar credenciales.
- El build de Pages no despliega Edge Functions, migraciones ni ajustes de Auth. Para una instalación existente revisa la secuencia completa en `supabase/README.md` y el estado registrado en Supabase antes de aplicar cualquier migración. En el proyecto remoto consultado el 2026-10-28 el ledger y los objetos del schema no coinciden para varias migraciones previas; no aplicar la lista local en bloque ni volver a ejecutar el bootstrap.
- `supabase/config.toml` declara `auth.enable_signup = false`, `functions.admin-users.verify_jwt = false` y `functions.mcp.verify_jwt = false`. Esta última sólo permite el discovery/challenge en gateway; la Edge Function comprueba cada bearer. OAuth Server, DCR y el custom access-token hook fueron habilitados en el proyecto actual el 2026-10-28; el `config diff` posterior no dejó cambios declarados.
- Ledger histórico consultado tras la activación del workflow: `202610190001`, `202610200001`,
  `202610200002`, `202610210001`, `202610220001`, `202610280002`, `202610280003` y
  `202610290001`. Persisten discrepancias históricas de objetos frente al ledger; ver
  [schema](04-schema.md) y `supabase/README.md`. No reaplicar históricos ni marcar
  entradas como atajo. Las tres suites MCP remotas (identidad, lectura y workflow)
  pasaron con `ROLLBACK`; no validan Storage real ni OAuth de navegador. Para el ledger posterior y la corrección focalizada de `202610260002`, ver [schema](04-schema.md).
- Histórico de fase 1 (2026-10-28): `mcp` v2 y `admin-users` v6 ACTIVE, Pages `267cc91` / run `40796012117`. La operación del día 29 sustituyó MCP por v3; no redesplegó administración ni cambió hooks/Auth globales.

### Local, Pages y clientes MCP: límites comprobados

- «Local» significa Vite con el entorno Supabase acordado; no requiere duplicar
  backend ni instalar un stack Supabase completo. Pages y Vite usan HashRouter y
  base `/dashboardFurthurr/`; la API MCP permanece en Supabase.
- El portal local llama `mcp_list_workflow_access`, `mcp_revoke_workflow_permission`
  y `mcp_authorize_workflow` mediante su sesión ordinaria
  (`src/features/auth/mcpWorkflowAccess.ts:1-34`), no con fetch al MCP. Estas RPCs
  requieren `202610290001`, aplicada y registrada en remoto el 2026-10-29.
  El preflight Edge desde Pages fue permitido; localhost y un origen ajeno fueron
  rechazados. Los clientes nativos sin `Origin` no necesitan CORS, mientras un
  cliente web con `Origin` requiere allowlist revisada. No habilitar wildcard ni
  cambiar Auth Site URL para eludir un fallo de prueba.
- `whoami` real funcionó después del despliegue histórico y se volvió a comprobar
  tras Edge v4. OpenCode CLI 1.18.34 informó OAuth conectado, pero ejecución mediante
  modelo devolvió HTTP 401; su API local requirió autenticación y `orca` no estaba
  disponible. La sesión seguía solo con identidad; falta separar definitivamente
  catálogo cacheado de discovery.
- Catálogo fresco con seis herramientas, consulta de tarea, consentimiento/retiro y
  sesión nueva desde cliente/navegador, así como descarga/caducidad/renovación reales,
  siguen pendientes. No interpretar SQL remoto, un enlace simulado o HTTP 200 como
  evidencia E2E.

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).

## Arranque local protegido — 2026-11-06

Vite da prioridad a las variables de entorno heredadas del shell sobre la
configuración local del proyecto (`.env.local`). Para que el desarrollo local use
siempre la configuración local, `npm run dev` ya no invoca `vite` directamente: ejecuta
`scripts/dev.mjs`, que elimina `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`
del entorno **del proceso hijo** antes de cargar la CLI de Vite.

| Aspecto | Comportamiento observado |
| --- | --- |
| Script | `npm run dev` → `node scripts/dev.mjs` (`package.json:6-9`) |
| Limpieza | `clearInheritedSupabase(environment)` borra ambas claves del objeto de entorno y devuelve si había configuración heredada (`scripts/dev-environment.mjs:1-9`) |
| Trazabilidad | Si había variables heredadas, se informa por `console.info` **sin mostrar sus valores** (`scripts/dev.mjs:6-8`) |
| Alcance | No modifica el entorno del shell padre ni el de otros procesos |
| Ejecución de Vite | Se importa la CLI instalada de Vite en el mismo proceso, conservando flags, señales y códigos de salida (`scripts/dev.mjs:10-14`) |
| Pruebas | `npm run test:dev-env` (`node --test scripts/test-dev-environment.mjs`), 4/4 correctas |
| Lint | `eslint.config.js` incluye un bloque para `scripts/**/*.mjs` con `js.configs.recommended` y globals de Node |

Este mecanismo **no** cambia la configuración de CI ni de Pages: el workflow de
despliegue sigue pasando las variables desde sus secretos. Tampoco sustituye a
`.env.local`: si el archivo local no existe, la aplicación fallará al inicializar el
cliente, que es el comportamiento esperado (`src/lib/supabase.ts:3-10`).
