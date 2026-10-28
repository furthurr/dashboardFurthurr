# MCP de Furthurr — fase 1

Servidor remoto Streamable HTTP con una sola herramienta: `whoami`. Reutiliza las
cuentas de Supabase Auth del portal; las contraseñas se introducen únicamente en
el navegador. OAuth Server de Supabase está en **beta**.

## Límites de seguridad

- OAuth emite `role=mcp_identity` y `aud=<URL exacta del MCP>` mediante un Custom
  Access Token Hook. Las sesiones normales del portal no cambian.
- Este rol NO hereda `authenticated` ni `service_role`, no tiene acceso a tablas
  o vistas y solo puede ejecutar `mcp_whoami()`. La migración aborta si detecta
  permisos inesperados de ejecución en funciones públicas no-trigger.
- Las políticas restrictivas bloquean OAuth en tablas de negocio/Storage; no
  sustituyen el aislamiento por rol para RPCs `SECURITY DEFINER`.
- `admin-users` verifica la sesión y rechaza expresamente OAuth antes de acceder
  a perfiles o ejecutar acciones privilegiadas.
- `mcp_whoami` verifica en cada solicitud perfil activo, sesión existente, cliente
  de esa sesión y límite `not_after`. Revocar una concesión borra sus sesiones.
- El MCP valida firma ES256/RS256, emisor, audiencia, caducidad, rol y IDs. No usa
  la clave `service_role`. El cliente Supabase de la función usa la clave pública
  del entorno y el rol limitado para su única RPC de persistencia.
- No se aceptan tokens de sesión web, tokens en query ni URLs derivadas de Host.
  Los Origins de navegador se autorizan explícitamente, sin CORS `*`.
- El aislamiento se aplica a **todos los clientes OAuth del proyecto** en esta
  fase. Si ya hay otras integraciones OAuth, revisar este alcance antes de activar
  el hook; no sobrescribir otro hook sin componer/verificar su comportamiento.
- Los avatares públicos y los datos/URLs ya descargados no se vuelven privados.

## Activación por entorno (pendiente de validación en Supabase real)

No habilitar OAuth antes de terminar los controles de aislamiento. No ejecutar el
bootstrap sobre una base existente ni aplicar migraciones previas a ciegas.

1. En un entorno de prueba, aplicar las migraciones pendientes, incluida
   `supabase/migrations/202610280002_mcp_identity.sql`. Para una instalación nueva,
   el bootstrap ya contiene ese bloque: no volver a aplicar esa migración.
2. Configurar mediante una conexión privilegiada (URL de ejemplo):

   ```sql
   insert into public.mcp_oauth_configuration(singleton, resource_url)
   values (true, 'https://PROJECT_REF.supabase.co/functions/v1/mcp')
   on conflict(singleton) do update set resource_url = excluded.resource_url;
   ```

3. Verificar que Auth firma con ES256/RS256 y publica JWKS. Si aún usa HS256,
   planificar la migración de firma; no rotar claves de producción a ciegas.
4. Publicar el frontend con las rutas `#/oauth/consent` y
   `#/profile/connections`, junto al retorno de login implementado.
5. Publicar **también** `admin-users` con el rechazo de OAuth, antes de habilitar
   el servidor OAuth. Pages no despliega funciones ni SQL.
6. Configurar el Custom Access Token Hook de Auth:
   `pg-functions://postgres/public/mcp_access_token_hook`. Comprobar un login y un
   refresh normales del portal; conservar `enable_signup=false`.
7. Configurar el entorno de la función (sin llevar valores a `VITE_*`):

   | Variable | Uso |
   | --- | --- |
   | `SUPABASE_URL` | Inyectada por Supabase; API/JWKS del proyecto. |
   | `SUPABASE_ANON_KEY` | Clave pública inyectada por Supabase; no privilegiada. |
   | `MCP_RESOURCE_URL` | Misma URL canónica que la tabla, sin slash final. |
   | `MCP_ALLOWED_ORIGINS` | Origins de navegador separados por coma, si se necesitan. Vacío admite clientes nativos/cloud sin Origin. |

   Usar el dominio estándar del proyecto en esta fase. Los dominios personalizados
   necesitan un diseño explícito de issuer; no están soportados por esta configuración.
8. Desplegar `mcp` con `verify_jwt=false` según `supabase/config.toml`. Esto permite
   discovery sin sesión; el código protege todas las peticiones MCP.
9. En Authentication → OAuth Server, habilitar OAuth y configurar Site URL como
   el root publicado `https://PORTAL_HOST/dashboardFurthurr/` y Authorization Path
   como `/`. GoTrue concatena la base y el path, y agrega `?authorization_id=...`.
   No incluir una query ni un fragmento en Authorization Path. El resultado debe
   ser `https://PORTAL_HOST/dashboardFurthurr/?authorization_id=...`.
   No cambiar Site URL sin revisar los demás flujos de Auth. El ID emitido por
   GoTrue es opaco (32 caracteres alfanuméricos), no el UUID de la fila de Auth.
   La SPA normaliza la query a `#/oauth/consent?authorization_id=...`; no depende
   de rewrites de Pages ni de que Auth agregue parámetros dentro del hash.
10. Habilitar registro dinámico de clientes (DCR) para los clientes compatibles,
    o registrar clientes públicos con PKCE y callbacks exactos. DCR permite a
    clientes desconocidos registrarse: su nombre no acredita confianza. Revisar
    cliente y callback en el consentimiento, monitorizar registros y revocar accesos.
11. Si se emitieron tokens OAuth antes de activar el hook, revocar las concesiones
    y sesiones anteriores antes de abrir el servicio. No confiar solo en RLS para
    neutralizar tokens antiguos con rol `authenticated` frente a RPCs definer.
12. Completar la prueba de aceptación real: login → consentimiento → `whoami`;
    denegación; renovación; revocación con JWT todavía vigente; cuenta inactiva;
    acceso directo denegado a tablas, RPCs, Storage y `admin-users`; login web normal.

### Estado del piloto (2026-10-28)

Se aplicó únicamente `202610280002_mcp_identity` y se configuró el recurso MCP en
el proyecto del portal mediante Supabase CLI 2.121.0. No se reejecutó el bootstrap
ni se aplicaron migraciones anteriores ajenas al MCP. Se desplegaron `mcp` y la
protección OAuth de `admin-users`; se habilitaron el hook, OAuth/DCR y el retorno
al root publicado. El diff posterior no mostró cambios declarados pendientes.

GitHub Pages publicó el frontend del commit `133f382`, workflow `40757148648`.
Se comprobaron las rutas públicas, metadatos MCP/Auth, desafío 401 y retorno 302
con un ID opaco de 32 caracteres. El probe `mcp_identity.sql` pasó en Supabase real
y revirtió sus fixtures. Los conteos de perfiles, tareas y tableros no cambiaron.

OpenCode CLI 1.18.34 completó discovery y DCR como cliente público sin secreto.
El intento interactivo de `opencode mcp auth furthurr` abrió el flujo, pero terminó
por timeout sin completar el login. **No se ha validado todavía `whoami` con una
sesión OAuth real, ni renovación/revocación end-to-end ni OpenCode Desktop.**
El archivo `opencode.json` del proyecto configura la URL sin credenciales. Reinicia
OpenCode Desktop para cargarlo y autoriza la conexión desde su interfaz; como
alternativa ejecuta `opencode mcp auth furthurr` en tu terminal y completa el login
en el navegador. No copies contraseñas ni tokens al chat.

## Clientes

Todos deben apuntar a `https://PROJECT_REF.supabase.co/functions/v1/mcp`.
Ningún ejemplo contiene contraseña, bearer fijo o clave administrativa. No se
instalan configuraciones automáticamente en el equipo del usuario.

| Cliente | Configuración orientativa | Estado |
| --- | --- | --- |
| OpenCode Desktop/CLI | `mcp.furthurr = {"type":"remote","url":"https://PROJECT_REF.supabase.co/functions/v1/mcp"}` | HTTP/OAuth documentados; sin prueba real por variante. |
| Kiro IDE/CLI | `mcpServers.furthurr = {"url":"https://PROJECT_REF.supabase.co/functions/v1/mcp","oauthScopes":["email","profile"]}` | HTTP/OAuth documentados en ambas superficies; sin prueba real. Los scopes explícitos minimizan la solicitud de identidad. |
| Copilot en VS Code | `servers.furthurr = {"type":"http","url":"https://PROJECT_REF.supabase.co/functions/v1/mcp"}` en formato VS Code | Transporte documentado; OAuth/end-to-end pendientes para versión instalada. |
| Copilot CLI | `mcpServers.furthurr = {"type":"http","url":"https://PROJECT_REF.supabase.co/functions/v1/mcp","tools":["whoami"]}` | HTTP documentado; OAuth/end-to-end pendientes. No lee el formato `servers` de VS Code. |
| Antigravity App/IDE/CLI | `mcpServers.furthurr = {"serverUrl":"https://PROJECT_REF.supabase.co/functions/v1/mcp"}` | HTTP/OAuth documentados; sin prueba real por variante. |
| Claude Desktop | Conector personalizado remoto desde Configuración → Conectores. Elegir registro automático o cliente previamente registrado. | Documentado; requiere URL pública accesible desde la nube de Anthropic. Sin prueba real. |
| Claude Code CLI | `claude mcp add --transport http furthurr https://PROJECT_REF.supabase.co/functions/v1/mcp`, luego `/mcp` | HTTP/OAuth documentados; sin prueba real. |
| Pi | Pendiente identificar versión/extensión MCP concreta. | No se afirma soporte nativo ni edición Desktop. No se instala un adaptador no verificado. |

Estos fragmentos se integran en el objeto de configuración del cliente, no son
archivos completos intercambiables. Las políticas de organización/versiones pueden
restringir el uso. Un cliente configurado no se considera validado hasta invocar
`whoami` y comprobar su resultado, renovación y revocación.

Fuentes oficiales consultadas para el diseño:
- https://supabase.com/docs/guides/auth/oauth-server/getting-started
- https://supabase.com/docs/guides/auth/oauth-server/token-security
- https://supabase.com/docs/guides/ai-tools/byo-mcp
- https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- https://opencode.ai/docs/mcp-servers/
- https://kiro.dev/docs/mcp/configuration/
- https://code.visualstudio.com/docs/agent-customization/mcp-servers
- https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
- https://antigravity.google/docs/mcp
- https://code.claude.com/docs/en/mcp
- https://support.claude.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp
- https://github.com/earendil-works/pi/tree/main/packages/coding-agent

## Verificaciones locales

```sh
npm run test -- --run
npm run lint
npm run build
deno test --config supabase/functions/mcp/deno.json --allow-env supabase/functions/mcp/index_test.ts
deno test --allow-env supabase/functions/admin-users/index_test.ts
deno test --allow-read=supabase-schema.sql,supabase/migrations supabase/tests/mcp_bootstrap_test.ts
deno test --allow-run=docker --allow-read=supabase-schema.sql,supabase/migrations,supabase/tests supabase/tests/mcp_sql_test.ts
```

`supabase/tests/mcp_identity.sql` es un probe transaccional con `ROLLBACK` después
de la migración. Para un PostgreSQL vacío **desechable**, el soporte de prueba
`supabase/tests/support/mcp_harness.sql` simula las tablas/funciones mínimas de
Auth/Storage antes de cargar el bootstrap. **Nunca ejecutar ese harness en Supabase**.
Pasar esos probes no valida emisión de tokens, PKCE, DCR ni refresh de Auth real.
El runner `mcp_sql_test.ts` crea y elimina su propio contenedor sin puertos ni red,
prueba instalación incremental y bootstrap nuevo, y ejecuta las cuatro suites SQL.
