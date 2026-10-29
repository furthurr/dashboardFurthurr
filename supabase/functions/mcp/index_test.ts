import { AccessError, createHandler, createVerifier, type Config } from './index.ts'
import { addDownloads, attachmentPath, TaskError, type RawTask } from './task.ts'
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
Deno.test('MCP initialize, tools/list and whoami remain compatible, with no cross-user state', async () => {
  const token = await sign()
  let calls = 0
  const handle = createHandler(config, { verify: verifier, identify: async () => { calls++; return identity } })
  const initialize = await handle(request('POST', rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } }), token))
  assert(initialize.status === 200)
  const initialized = await initialize.json()
  assert(initialized.result.serverInfo.name === 'dashboardFurthurr')
  const tools = await (await handle(request('POST', rpc('tools/list'), token))).json()
  assert(tools.result.tools.length === 2 && tools.result.tools[0].name === 'whoami' && tools.result.tools[1].name === 'get_task')
  const result = await (await handle(request('POST', rpc('tools/call', { name: 'whoami', arguments: {} }), token))).json()
  assert(result.result.structuredContent.id === id && result.result.structuredContent.role === 'admin')
  assert(!JSON.stringify(result).includes(token))
  const unknown = await (await handle(request('POST', rpc('tools/call', { name: 'list_boards', arguments: {} }), token))).json()
  assert(unknown.error || unknown.result?.isError)
  assert(calls === 4)
})

const raw: RawTask = {
  task: { id, title: 'Fixture task', description: 'Description', status: 'haciendo', priority: 'alta',
    special_notes: 'Notes', created_at: null, updated_at: null },
  board: { id: clientId, name: 'Fixture board' }, assignees: [{ id: clientId, full_name: 'Person' }],
  comments: { total: 2, offset: 0, next_offset: 1, items: [{ id: clientId, body: 'Comment', author: { id, full_name: 'Author' }, created_at: null, updated_at: null }] },
  attachments: { total: 1, offset: 0, next_offset: null, items: [{ id: clientId, file_name: 'document.pdf', mime_type: 'application/pdf', file_size: 123,
    created_at: null, file_url: `https://example.test/storage/v1/object/public/task-attachments/${id}/file.pdf` }] },
}

Deno.test('get_task returns structured full task data, pagination and short-lived attachment links', async () => {
  const token = await sign()
  let reads = 0; let signs = 0
  const handle = createHandler(config, { verify: verifier, identify: async () => identity,
    getTask: (bearer, input) => {
      assert(bearer === token && input.task_id === id && input.comments_offset === 1 && input.page_size === 1)
      reads++
      return Promise.resolve(raw)
    },
    signAttachment: (path, seconds) => {
      signs++; assert(path === `${id}/file.pdf` && seconds === 60)
      return Promise.resolve('https://example.test/storage/v1/object/sign/task-attachments/fixture?token=fixture')
    },
  })
  const response = await handle(request('POST', rpc('tools/call', { name: 'get_task', arguments: { task_id: id, comments_offset: 1, page_size: 1 } }), token))
  const result = (await response.json()).result
  assert(!result.isError && reads === 1 && signs === 1)
  assert(result.structuredContent.task.title === raw.task.title && result.structuredContent.task.status === 'haciendo')
  assert(result.structuredContent.assignees[0].full_name === 'Person' && result.structuredContent.comments.items[0].body === 'Comment')
  const attachment = result.structuredContent.attachments.items[0]
  assert(attachment.download_url.includes('/sign/') && Date.parse(attachment.expires_at) > Date.now())
  assert(attachment.download_error === null && !('file_url' in attachment))
  assert(result.structuredContent.comments.next_offset === 1 && result.structuredContent.attachments.next_offset === null)
  assert(response.headers.get('Cache-Control') === 'no-store' && !JSON.stringify(result).includes(token))
})

Deno.test('get_task rejects invalid UUIDs, unknown arguments and invalid pagination before reading or signing', async () => {
  let reads = 0; let signs = 0
  const handle = createHandler(config, { verify: verifier, identify: async () => identity,
    getTask: async () => { reads++; return raw }, signAttachment: async () => { signs++; return '' } })
  const token = await sign()
  for (const args of [{ task_id: 'bad' }, { task_id: id, page_size: 101 }, { task_id: id, comments_offset: -1 },
    { task_id: id, attachments_offset: 0.5 }, { task_id: id, path: 'forbidden' }]) {
    const result = await (await handle(request('POST', rpc('tools/call', { name: 'get_task', arguments: args }), token))).json()
    assert(result.error || result.result?.isError)
  }
  assert(reads === 0 && signs === 0)
})

Deno.test('get_task requires new explicit consent, hides access/existence and never signs on query errors', async () => {
  let signs = 0
  const token = await sign()
  for (const code of ['PT403', 'PT404', '28000', '42501', 'internal']) {
    const handle = createHandler(config, { verify: verifier, identify: async () => identity,
      getTask: () => Promise.reject(new TaskError(code)), signAttachment: async () => { signs++; return '' } })
    const result = (await (await handle(request('POST', rpc('tools/call', { name: 'get_task', arguments: { task_id: id } }), token))).json()).result
    assert(result.isError && !result.structuredContent)
    if (code === 'PT403') assert(result.content[0].text.includes('Autoriza la lectura'))
    if (code === 'PT404') assert(result.content[0].text === 'Tarea no disponible o sin acceso.')
    assert(!JSON.stringify(result).includes('internal'))
  }
  assert(signs === 0)
})

Deno.test('get_task preserves empty relations and reports signing failures without leaking internal errors', async () => {
  const failed = await addDownloads(raw, config.supabaseUrl, () => Promise.reject(new Error('private detail')))
  assert(failed.attachments.items[0].download_url === null && failed.attachments.items[0].expires_at === null)
  assert(!!failed.attachments.items[0].download_error && !JSON.stringify(failed).includes('private detail'))
  const empty = await addDownloads({ ...raw, assignees: [], comments: { total: 0, offset: 0, next_offset: null, items: [] },
    attachments: { total: 0, offset: 0, next_offset: null, items: [] } }, config.supabaseUrl, async () => { throw new Error('must not sign') })
  assert(empty.assignees.length === 0 && empty.comments.items.length === 0 && empty.attachments.items.length === 0)
})

Deno.test('privileged signer cannot follow metadata to other hosts, buckets, tasks, traversal or legacy paths', () => {
  const base = 'https://example.test/storage/v1/object/public/task-attachments/'
  assert(attachmentPath(`${base}${id}/file.pdf`, config.supabaseUrl, id) === `${id}/file.pdf`)
  for (const url of [`${base}${clientId}/file.pdf`, `${base}legacy.pdf`, `${base}${id}/%2e%2e/file.pdf`,
    `${base}${id}/%2Fother.pdf`, `${base}${id}/%252e%252e%252fsecret.pdf`, `${base}${id}/file.pdf?x=1`, `${base}${id}/%00.pdf`,
    `https://evil.test/storage/v1/object/public/task-attachments/${id}/file.pdf`,
    `https://example.test/storage/v1/object/public/avatars/${id}/file.pdf`]) {
    assert(attachmentPath(url, config.supabaseUrl, id) === null)
  }
})

Deno.test('get_task rejects a mismatched task payload and revalidates session before any task call', async () => {
  let reads = 0
  const deps = { verify: verifier, identify: async () => identity,
    getTask: async () => { reads++; return { ...raw, task: { ...raw.task, id: clientId } } },
    signAttachment: async () => { throw new Error('must not sign') } }
  const token = await sign()
  const result = (await (await createHandler(config, deps)(request('POST', rpc('tools/call', { name: 'get_task', arguments: { task_id: id } }), token))).json()).result
  assert(result.isError && reads === 1)
  const denied = await createHandler(config, { ...deps, identify: () => Promise.reject(new AccessError(401)) })(request('POST', rpc('tools/call', { name: 'get_task', arguments: { task_id: id } }), token))
  assert(denied.status === 401 && reads === 1)
})
