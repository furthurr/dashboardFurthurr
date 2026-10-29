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
| `SUPABASE_SERVICE_ROLE_KEY` | Administración; MCP fase 2 la usa solo para firmar adjuntos autorizados/validados | Secreto del entorno servidor; `<server-secret>`, nunca `VITE_*`, cliente MCP ni documentación de valores |

Fuente: `supabase/functions/admin-users/index.ts:20-23`. Los placeholders no representan valores desplegados.

MCP consulta identidad/tareas con `SUPABASE_ANON_KEY` y bearer OAuth individual,
con `role=mcp_identity`. Fase 2 agrega un cliente separado de firma que lee
`SUPABASE_SERVICE_ROLE_KEY` exclusivamente en runtime Edge, después de autorizar
la tarea y validar el path. Si no está disponible o falla Storage, la metadata
se conserva con `download_error`; no se concede privilegio al rol OAuth.
Fuente: `supabase/functions/mcp/index.ts:50-84`.

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

- Fase 2 local requiere la migración `202610280003`, deploy de `mcp` y publicación
  del portal de consentimiento; ninguno se ejecutó en esta sincronización. Ver
  [guía de prueba](../docs/prueba-mcp.md). Los registros remotos siguientes son
  evidencia histórica de fase 1, no una comprobación actual de `get_task`.
- Instalación reproducible por `npm ci` y build mediante `npm run build` (`.github/workflows/deploy.yml:24-37`).
- El build sube `dist` como artefacto de GitHub Pages (`.github/workflows/deploy.yml:39-53`).
- El prefijo de hosting está fijado en `vite.config.ts:6-13`.
- El repositorio no permite verificar si los secretos están configurados en GitHub ni qué proyecto Supabase corresponde a cada entorno.
- El build de Pages no despliega Edge Functions, migraciones ni ajustes de Auth. Para una instalación existente revisa la secuencia completa en `supabase/README.md` y el estado registrado en Supabase antes de aplicar cualquier migración. En el proyecto remoto consultado el 2026-10-28 el ledger y los objetos del schema no coinciden para varias migraciones previas; no aplicar la lista local en bloque ni volver a ejecutar el bootstrap.
- `supabase/config.toml` declara `auth.enable_signup = false`, `functions.admin-users.verify_jwt = false` y `functions.mcp.verify_jwt = false`. Esta última sólo permite el discovery/challenge en gateway; la Edge Function comprueba cada bearer. OAuth Server, DCR y el custom access-token hook fueron habilitados en el proyecto actual el 2026-10-28; el `config diff` posterior no dejó cambios declarados.
- Historial SQL consultado el 2026-10-28: el ledger contiene las entradas `202610190001`, `202610200001`, `202610200002`, `202610210001`, `202610220001` y `202610280002`. El estado de objetos muestra firmas/policies que corresponden a `202610220002`, `202610280001` y parte de `202610260003`, mientras no se hallaron la policy de nombre de adjunto (`202610260001`) ni `delete_inactive_board` (`202610260002`). `202610280002` se aplicó por SQL transaccional y se registró; ver la discrepancia completa en `supabase/README.md`. La suite MCP remota pasó con `ROLLBACK`.
- Edge/Auth actual consultado el 2026-10-28: `mcp` versión 2 ACTIVE; `admin-users` versión 6 ACTIVE; Pages publicó el commit `267cc91` en el run `40796012117`. No implica que todo cliente de escritorio/CLI haya completado OAuth; OpenCode Desktop verificó `whoami` antes del renombrado del alias, y se requiere reautorizar/verificar el nombre `dashboardFurthurr`.

## Higiene

- No añadir valores reales a este documento, a `.data/` ni a ejemplos versionados.
- No leer ni copiar el contenido de `.env.local`.
- Los nombres son coherentes con la inicialización real del cliente y el workflow; no usar `VITE_SUPABASE_KEY` (`src/lib/supabase.ts:3-10`).
