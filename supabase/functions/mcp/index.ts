import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export interface Config {
  supabaseUrl: string
  publishableKey: string
  resourceUrl: string
  allowedOrigins: string[]
}
export interface Identity {
  id: string
  email: string
  full_name: string
  role: string
  client_id: string
}
export class AccessError extends Error {
  constructor(public status: number) { super('MCP access denied') }
}

export function createVerifier(config: Config, key?: JWTVerifyGetKey) {
  const issuer = `${new URL(config.resourceUrl).origin}/auth/v1`
  const jwks = key ?? createRemoteJWKSet(new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`))
  return async (token: string) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer, audience: config.resourceUrl, algorithms: ['ES256', 'RS256'],
      requiredClaims: ['exp', 'iat', 'sub', 'session_id', 'client_id', 'role'],
    })
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (payload.role !== 'mcp_identity' || typeof payload.client_id !== 'string' || !uuid.test(payload.client_id)
      || typeof payload.session_id !== 'string' || !uuid.test(payload.session_id)
      || typeof payload.sub !== 'string' || !uuid.test(payload.sub)) throw new AccessError(401)
    return payload
  }
}

export function createHandler(config: Config, dependencies?: {
  verify: ReturnType<typeof createVerifier>
  identify: (token: string) => Promise<Identity>
}) {
  const issuer = `${new URL(config.resourceUrl).origin}/auth/v1`
  const metadataUrl = `${config.resourceUrl}/oauth-protected-resource`
  const endpoint = new URL(config.resourceUrl)
  const verify = dependencies?.verify ?? createVerifier(config)
  const identify = dependencies?.identify ?? (async (token: string): Promise<Identity> => {
    // This RPC is part of the MCP resource's own persistence boundary. The dedicated
    // role has no table access and cannot invoke the portal's business RPCs.
    const client = createClient(config.supabaseUrl, config.publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.rpc('mcp_whoami')
    if (error) throw new AccessError(error.code === '42501' ? 403 : error.code === '28000' ? 401 : 503)
    if (!data || typeof data.id !== 'string' || typeof data.client_id !== 'string') throw new AccessError(503)
    return data as Identity
  })

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin')
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
      'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Protocol-Version, MCP-Session-Id',
      'Vary': 'Origin',
    })
    const reply = (status: number, body: unknown) => Response.json(body, { status, headers })
    // No wildcard CORS. Native and cloud clients do not need an Origin header.
    if (origin && !config.allowedOrigins.includes(origin)) return reply(403, { error: 'Origen no permitido.' })
    if (origin) headers.set('Access-Control-Allow-Origin', origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const path = new URL(request.url).pathname
    // Supabase gateways may remove the /functions/v1 prefix internally.
    if (path === `${endpoint.pathname}/oauth-protected-resource` || path === '/mcp/oauth-protected-resource') {
      if (request.method !== 'GET') return reply(405, { error: 'Método no permitido.' })
      return reply(200, { resource: config.resourceUrl, authorization_servers: [issuer],
        bearer_methods_supported: ['header'], scopes_supported: ['email', 'profile'] })
    }
    if (path !== endpoint.pathname && path !== '/mcp') return reply(404, { error: 'Ruta no encontrada.' })
    if (!['POST', 'GET', 'DELETE'].includes(request.method)) return reply(405, { error: 'Método no permitido.' })
    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1]
    const unauthorized = () => {
      headers.set('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}", scope="email profile"`)
      return reply(401, { error: 'Autoriza la conexión con tu cuenta de Dashboard Furthurr.' })
    }
    if (!token) return unauthorized()
    let claims
    try { claims = await verify(token) } catch { return unauthorized() }
    let identity: Identity
    try {
      identity = await identify(token)
      if (identity.id !== claims.sub || identity.client_id !== claims.client_id) throw new AccessError(401)
    } catch (error) {
      if (error instanceof AccessError && error.status === 401) return unauthorized()
      return reply(error instanceof AccessError ? error.status : 503, { error: 'No se pudo verificar el acceso a Furthurr.' })
    }
    const server = new McpServer({ name: 'furthurr', version: '0.1.0' })
    server.registerTool('whoami', {
      title: 'Mi identidad en Furthurr',
      description: 'Identifica tu cuenta activa de Dashboard Furthurr. No consulta ni modifica tableros o tareas.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, () => ({ content: [{ type: 'text', text: JSON.stringify(identity) }], structuredContent: { ...identity } }))
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    try {
      await server.connect(transport)
      const response = await transport.handleRequest(request)
      const merged = new Headers(response.headers)
      headers.forEach((value, name) => merged.set(name, value))
      return new Response(response.body, { status: response.status, headers: merged })
    } catch {
      return reply(500, { error: 'No se pudo procesar la solicitud MCP.' })
    } finally { await server.close() }
  }
}

if (import.meta.main) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/$/, '')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const resourceUrl = Deno.env.get('MCP_RESOURCE_URL')?.replace(/\/$/, '')
  if (!supabaseUrl || !publishableKey || !resourceUrl) throw new Error('Missing MCP runtime configuration')
  Deno.serve(createHandler({ supabaseUrl, publishableKey, resourceUrl,
    allowedOrigins: (Deno.env.get('MCP_ALLOWED_ORIGINS') ?? '').split(',').map(value => value.trim()).filter(Boolean) }))
}
