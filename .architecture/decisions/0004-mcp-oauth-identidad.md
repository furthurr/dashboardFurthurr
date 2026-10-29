# ADR 0004: MCP remoto OAuth limitado a identidad

- Estado: Aceptada
- Fecha: 2026-10-28

## Contexto

Se requiere conectar clientes de desarrollo a las cuentas Auth existentes sin
compartir contraseñas ni una clave privilegiada. GitHub Pages sólo publica assets
estáticos, por lo que el MCP necesita un endpoint remoto. Los access tokens OAuth
de Supabase participan en PostgREST/RLS; publicar únicamente una herramienta
`whoami` no bastaría para limitar el resto de las RPCs `SECURITY DEFINER`.

## Decisión

- Un único endpoint MCP Streamable HTTP se ejecuta como Supabase Edge Function.
- Supabase Auth OAuth Authorization Code + PKCE/DCR reutiliza la identidad del
  portal; Pages sirve consentimiento y revocación de grants.
- Un Custom Access Token Hook conserva sesiones normales del portal y asigna a
  sesiones OAuth audiencia exacta del MCP y el rol Postgres `mcp_identity`.
- `mcp_identity` no hereda `authenticated` ni `service_role`, no posee grants de
  tablas/vistas/RPCs de negocio y sólo puede ejecutar `mcp_whoami()`.
- La Edge Function verifica firma/issuer/audience/sesión; `mcp_whoami` comprueba
  perfil activo, sesión viva y cliente, y devuelve sólo identidad.
- Configuraciones project-scoped del repo permiten elegir cliente; cada usuario y
  cliente OAuth requiere consentimiento propio. Claude Desktop usa su conector
  remoto en la cuenta/organización y no un archivo del workspace.

## Alternativas consideradas

- Compartir una clave `service_role` o bearer estático — rechazado: daría permisos
  privilegiados y expondría credenciales en agentes/configuración.
- Reenviar el JWT normal del portal sin rol/audiencia dedicada — rechazado porque
  el token puede invocar APIs/RPCs de negocio y crear un confused deputy.
- Desplegar un MCP local distinto por agente — rechazado: duplica despliegues y no
  sirve para clientes remotos como Claude Desktop.

## Consecuencias

- Positivas: un solo servidor, identidad existente, consentimiento/revocación por
  usuario y defensa por rol Postgres además del catálogo de herramientas.
- Trade-offs: OAuth Server de Supabase está en beta; DCR admite registros dinámicos
  y el nombre de cliente no certifica confianza; la compatibilidad OAuth debe
  validarse individualmente por cliente.
- El hook/policies operan sobre sesiones OAuth del proyecto en general, no sólo
  MCP. Antes de agregar otros clientes OAuth hay que revisar el efecto global y no
  sobrescribir hooks existentes.
- `whoami` entrega email/nombre/ID/rol/cliente al contexto del agente; el resultado
  es PII. La fase no expone datos de tableros ni tareas.
- El estado remoto, variables y drift del migration ledger se documentan en
  [`supabase/README.md`](../../supabase/README.md) y `.data/04-schema.md`.

## Evidencia

- `supabase/functions/mcp/index.ts:23-35,39-58,61-115`
- `supabase/migrations/202610280002_mcp_identity.sql:4-109`
- `src/features/auth/OAuthConsentPage.tsx:18-78`
- `src/features/auth/OAuthConnectionsPage.tsx:15-41`
- `mcp/README.md`
