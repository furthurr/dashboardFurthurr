# Entornos y configuración

La aplicación valida que las variables de Supabase existan al inicializar el cliente (`src/lib/supabase.ts:3-10`). Los siguientes valores son placeholders de formato, no credenciales ni URLs reales.

| Variable | Uso | Local | CI / despliegue |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Configurar en entorno local como `https://<project-ref>.supabase.co` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publishable del cliente | Configurar en entorno local como `<publishable-key>` | GitHub Actions la pasa al build desde el secreto homónimo (`.github/workflows/deploy.yml:33-37`) |

Solo servidor Edge, nunca en el build Vite:

| Variable | Uso | Configuración |
| --- | --- | --- |
| `SUPABASE_URL` | Proyecto que usa `admin-users` | Entorno de funciones Supabase; `<project-url>` |
| `SUPABASE_SERVICE_ROLE_KEY` | Administración; MCP la usa solo en Edge para firmar/descargar adjuntos ya autorizados y validados | Secreto del entorno servidor; `<server-secret>`, nunca `VITE_*`, cliente MCP ni documentación de valores |

Fuente: `supabase/functions/admin-users/index.ts:20-23`. Los placeholders no representan valores desplegados.

MCP consulta identidad/tareas/adjuntos y mutaciones acotadas con `SUPABASE_ANON_KEY`
y bearer OAuth individual, con `role=mcp_identity`. El lector de adjuntos firma y
descarga con un cliente separado que usa `SUPABASE_SERVICE_ROLE_KEY` solo en runtime
Edge tras RPC autorizada y validar task/bucket/path. La lectura está limitada a
5 MiB y formatos documentados; el rol OAuth no recibe acceso directo a Storage.
La migración workflow y código actual son locales y no se acreditan desplegados.
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

- Baseline de producto: `c2677c9b9084e3a56b6db36a1783c5d722e82780` / `v0.12.1`.
  Actualización focalizada del 2026-10-29; reutiliza evidencia operativa anterior
  de esta sesión, no repite pruebas, consultas Supabase ni despliegues.
- Fase 2 activada en el proyecto acordado: solo `202610280003` aplicada/registrada;
  `mcp` **Edge v3 ACTIVE**, `verify_jwt=false`, código remoto coincidente con el
  baseline anterior (`index.ts`, `task.ts`, `deno.json`). Esa Edge no acredita el
  workflow actual: `serverInfo.version=0.3.0`, `workflow.ts` y la migración
  `202610290001_mcp_workflow.sql` son cambios locales sin deploy verificado.
  `initialize` autenticado fresco también sigue pendiente.
- Pages run `40923924908` terminó en success para el baseline anterior; HTML y
  nuevos assets JS/CSS respondieron 200. Vite también sirvió HTML/módulo principal.
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
- Ledger consultado tras la activación del 2026-10-29: `202610190001`, `202610200001`, `202610200002`, `202610210001`, `202610220001`, `202610280002` y `202610280003`. Persisten discrepancias históricas de objetos frente al ledger; ver [schema](04-schema.md) y `supabase/README.md`. No reaplicar históricos ni marcar entradas como atajo. Las dos suites MCP remotas pasaron con `ROLLBACK`; no validan Storage real.
- Histórico de fase 1 (2026-10-28): `mcp` v2 y `admin-users` v6 ACTIVE, Pages `267cc91` / run `40796012117`. La operación del día 29 sustituyó MCP por v3; no redesplegó administración ni cambió hooks/Auth globales.

### Local, Pages y clientes MCP: límites comprobados

- «Local» significa Vite con el entorno Supabase acordado; no requiere duplicar
  backend ni instalar un stack Supabase completo. Pages y Vite usan HashRouter y
  base `/dashboardFurthurr/`; la API MCP permanece en Supabase.
- El portal local llama `mcp_list_workflow_access`, `mcp_revoke_workflow_permission`
  y `mcp_authorize_workflow` mediante su sesión ordinaria
  (`src/features/auth/mcpWorkflowAccess.ts:1-34`), no con fetch al MCP. Estas RPCs
  requieren la migración local `202610290001`; no están acreditadas en remoto.
  El preflight Edge desde Pages fue permitido; localhost y un origen ajeno fueron
  rechazados. Los clientes nativos sin `Origin` no necesitan CORS, mientras un
  cliente web con `Origin` requiere allowlist revisada. No habilitar wildcard ni
  cambiar Auth Site URL para eludir un fallo de prueba.
- `whoami` real funcionó después del despliegue histórico. OpenCode CLI 1.18.34 informó
  OAuth conectado, pero ejecución mediante modelo devolvió HTTP 401; su API local
  requirió autenticación y `orca` no estaba disponible. La sesión seguía solo con
  identidad; falta separar definitivamente catálogo cacheado de discovery.
- Catálogo fresco, consulta de tarea, consentimiento/retiro y sesión nueva desde
  cliente/navegador, así como descarga/caducidad/renovación reales, siguen pendientes.
  No interpretar SQL remoto, un enlace simulado o HTTP 200 como evidencia E2E.

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).
