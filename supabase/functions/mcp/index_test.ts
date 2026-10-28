import { AccessError, createHandler, createVerifier, type Config } from './index.ts'
import { generateKeyPair, SignJWT, type JWTPayload } from 'jose'

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed') }
const id = '00000000-0000-0000-0000-000000000001'
const clientId = '00000000-0000-0000-0000-000000000002'
const config: Config = { supabaseUrl: 'https://example.test', publishableKey: 'fixture', resourceUrl: 'https://example.test/functions/v1/mcp', allowedOrigins: ['https://portal.example.test'] }
const identity = { id, client_id: clientId, email: 'person@example.test', full_name: 'Fixture', role: 'admin' }
const keys = await generateKeyPair('ES256')
const verifier = createVerifier(config, () => Promise.resolve(keys.publicKey))
async function sign(overrides: JWTPayload = {}) {
  return await new SignJWT({ sub: id, session_id: id, client_id: clientId, role: 'mcp_identity', ...overrides })
    .setProtectedHeader({ alg: 'ES256' }).setIssuer('https://example.test/auth/v1')
    .setAudience(config.resourceUrl).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
}
function request(method: string, body?: unknown, token?: string, origin?: string) {
  return new Request(config.resourceUrl, { method, headers: {
    Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}),
  }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
const rpc = (method: string, params?: unknown) => ({ jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) })

Deno.test('discovery is public and uses canonical URLs, never Host or forwarded headers', async () => {
  const handle = createHandler(config, { verify: verifier, identify: async () => identity })
  const response = await handle(new Request(`${config.resourceUrl}/oauth-protected-resource`, { headers: { 'X-Forwarded-Host': 'evil.test' } }))
  const data = await response.json()
  assert(response.status === 200 && data.resource === config.resourceUrl)
  assert(data.authorization_servers[0] === 'https://example.test/auth/v1')
  const denied = await handle(request('POST', rpc('initialize')))
  assert(denied.status === 401 && denied.headers.get('WWW-Authenticate')?.includes(`${config.resourceUrl}/oauth-protected-resource`))
})
Deno.test('rejects invalid, expired, portal, wrong-audience, wrong-issuer and unsigned tokens before DB access', async () => {
  let calls = 0
  const handle = createHandler(config, { verify: verifier, identify: async () => { calls++; return identity } })
  const wrongAudience = await new SignJWT({ sub: id, session_id: id, client_id: clientId, role: 'mcp_identity' }).setProtectedHeader({ alg: 'ES256' }).setIssuer('https://example.test/auth/v1').setAudience('authenticated').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
  const expired = await new SignJWT({ sub: id, session_id: id, client_id: clientId, role: 'mcp_identity' }).setProtectedHeader({ alg: 'ES256' }).setIssuer('https://example.test/auth/v1').setAudience(config.resourceUrl).setIssuedAt().setExpirationTime(1).sign(keys.privateKey)
  const wrongIssuer = await new SignJWT({ sub: id }).setProtectedHeader({ alg: 'ES256' }).setIssuer('https://evil.test/auth/v1').setAudience(config.resourceUrl).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
  for (const token of ['invalid', 'e30.e30.', await sign({ role: 'authenticated' }), await sign({ client_id: '' }), wrongAudience, expired, wrongIssuer]) {
    assert((await handle(request('POST', rpc('tools/list'), token))).status === 401)
  }
  assert(calls === 0)
})
Deno.test('enforces Origin, preflight, methods and unknown paths', async () => {
  const handle = createHandler(config, { verify: verifier, identify: async () => identity })
  assert((await handle(request('POST', rpc('tools/list'), undefined, 'https://evil.test'))).status === 403)
  const preflight = await handle(request('OPTIONS', undefined, undefined, config.allowedOrigins[0]))
  assert(preflight.status === 204 && preflight.headers.get('Access-Control-Allow-Origin') === config.allowedOrigins[0])
  assert((await handle(request('PUT'))).status === 405)
  assert((await handle(new Request(`${config.resourceUrl}/unknown`))).status === 404)
})
Deno.test('rechecks live access for initialization and all tool calls; refuses revoked/inactive sessions', async () => {
  const token = await sign()
  for (const status of [401, 403, 503]) {
    const handle = createHandler(config, { verify: verifier, identify: async () => { throw new AccessError(status) } })
    assert((await handle(request('POST', rpc('tools/list'), token))).status === status)
  }
  const mismatch = createHandler(config, { verify: verifier, identify: async () => ({ ...identity, id: clientId }) })
  assert((await mismatch(request('POST', rpc('tools/list'), token))).status === 401)
})
Deno.test('MCP initialize, tools/list and whoami expose identity only, with no cross-user state', async () => {
  const token = await sign()
  let calls = 0
  const handle = createHandler(config, { verify: verifier, identify: async () => { calls++; return identity } })
  const initialize = await handle(request('POST', rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } }), token))
  assert(initialize.status === 200)
  const tools = await (await handle(request('POST', rpc('tools/list'), token))).json()
  assert(tools.result.tools.length === 1 && tools.result.tools[0].name === 'whoami')
  const result = await (await handle(request('POST', rpc('tools/call', { name: 'whoami', arguments: {} }), token))).json()
  assert(result.result.structuredContent.id === id && result.result.structuredContent.role === 'admin')
  assert(!JSON.stringify(result).includes(token))
  const unknown = await (await handle(request('POST', rpc('tools/call', { name: 'list_boards', arguments: {} }), token))).json()
  assert(unknown.error || unknown.result?.isError)
  assert(calls === 4)
})
