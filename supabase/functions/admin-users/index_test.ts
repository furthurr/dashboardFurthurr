import { createHandler } from './index.ts'
import { parseAction } from './validation.ts'
import type { createClient } from 'npm:@supabase/supabase-js@2.105.1'

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message)
}
const actorId = '00000000-0000-0000-0000-000000000001'
const otherId = '00000000-0000-0000-0000-000000000002'
function fixture(role = 'admin', active = true, valid = true, failures: { create?: boolean; profile?: boolean; cleanup?: boolean; list?: boolean } = {}) {
  const calls: Record<string, unknown>[] = []
  const projections: string[] = []
  let reads = 0
  const client = {
    auth: {
      getUser: () => Promise.resolve({ data: { user: valid ? { id: actorId } : null }, error: null }),
      admin: {
        createUser: (body: Record<string, unknown>) => { calls.push(body); return Promise.resolve({ data: { user: { id: otherId } }, error: failures.create ? {} : null }) },
        deleteUser: (id: string) => { calls.push({ deleted: id }); return Promise.resolve({ error: failures.cleanup ? {} : null }) },
        updateUserById: (id: string, body: Record<string, unknown>) => { calls.push({ id, ...body }); return Promise.resolve({ error: null }) },
      },
    },
    from: () => ({
      select: (projection: string) => {
        projections.push(projection)
        const order = () => ({ order, range: (start: number, end: number) => {
          calls.push({ start, end })
          return Promise.resolve({ data: [{ id: otherId, avatar_url: 'https://example.test/avatar' }], count: 51, error: failures.list ? {} : null })
        } })
        return { eq: () => ({ single: () => Promise.resolve({ data: { role, is_active: active }, error: null }) }), order }
      },
      update: (body: Record<string, unknown>) => {
        calls.push(body)
        return { eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: otherId }, error: failures.profile ? {} : null }) }) }) }
      },
    }),
  }
  const makeClient = (() => { reads++; return client }) as unknown as typeof createClient
  const handle = createHandler(makeClient)
  const send = (body: unknown, token = true) => handle(new Request('https://example.test/admin-users', {
    method: 'POST', headers: token ? { Authorization: 'Bearer test' } : {}, body: JSON.stringify(body),
  }))
  return { send, calls, projections, reads: () => reads, handle }
}

Deno.test('rejects missing/invalid tokens, non-admin and inactive admin', async () => {
  const missing = fixture()
  assert((await missing.send({}, false)).status === 401)
  assert(missing.reads() === 0)
  assert((await fixture('admin', true, false).send({})).status === 401)
  for (const [role, active] of [['usuario', true], ['invitado', true], ['admin', false]] as const) {
    const f = fixture(role, active)
    assert((await f.send({ action: 'create' })).status === 403)
    assert(f.calls.length === 0)
  }
})
Deno.test('creates confirmed accounts and forces usuario/active ignoring caller role', async () => {
  const f = fixture()
  const response = await f.send({ action: 'create', fullName: ' Persona ', email: 'PERSON@example.test', password: 'test-password', role: 'admin', is_active: false })
  assert(response.status === 200)
  assert(f.calls[0].email_confirm === true)
  assert(f.calls[0].email === 'person@example.test')
  assert(f.calls[1].role === 'usuario' && f.calls[1].is_active === true)
})
Deno.test('sets passwords and state; rejects self-deactivation', async () => {
  const f = fixture()
  assert((await f.send({ action: 'password', userId: otherId, password: 'test-password' })).status === 200)
  assert(f.calls[0].password === 'test-password')
  assert((await f.send({ action: 'set-active', userId: actorId, active: false })).status === 400)
  assert(f.calls.length === 1)
  assert((await f.send({ action: 'set-active', userId: otherId, active: false })).status === 200)
  assert(f.calls[1].is_active === false)
  assert((await f.send({ action: 'set-active', userId: otherId, active: true })).status === 200)
  assert(f.calls[2].is_active === true)
})
Deno.test('validates action payloads before privileged operations', () => {
  for (const body of [null, {}, { action: 'list', page: -1 }, { action: 'list', page: 1.2 },
    { action: 'create', email: 'invalid', password: 'test-password', fullName: 'Persona' },
    { action: 'password', userId: otherId, password: 'short' },
    { action: 'set-active', userId: otherId, active: 'false' }]) {
    let rejected = false
    try { parseAction(body) } catch { rejected = true }
    assert(rejected)
  }
  assert(parseAction({ action: 'list' }).action === 'list')
})

Deno.test('paginates profile projection and reports listing errors', async () => {
  const f = fixture()
  const response = await f.send({ action: 'list', page: 2 })
  assert(response.status === 200)
  const body = await response.json()
  assert(body.total === 51 && body.pageSize === 50)
  assert(body.users[0].avatar_url === 'https://example.test/avatar')
  assert(f.projections.includes('id, full_name, email, avatar_url, role, is_active'))
  assert(f.calls[0].start === 50 && f.calls[0].end === 99)
  assert((await fixture('admin', true, true, { list: true }).send({ action: 'list' })).status === 500)
})
Deno.test('compensates profile failures; reports incomplete cleanup without secrets', async () => {
  for (const cleanup of [false, true]) {
    const f = fixture('admin', true, true, { profile: true, cleanup })
    const response = await f.send({ action: 'create', fullName: 'Persona', email: 'person@example.test', password: 'test-password' })
    assert(response.status === 500)
    assert(f.calls[2].deleted === otherId)
    const text = await response.text()
    assert(!text.includes('test-password'))
    assert(text.includes(cleanup ? 'Alta incompleta' : 'La cuenta no se ha creado'))
  }
})
Deno.test('handles CORS and method restrictions without creating a client', async () => {
  const f = fixture()
  assert((await f.handle(new Request('https://example.test', { method: 'OPTIONS' }))).status === 200)
  assert((await f.handle(new Request('https://example.test'))).status === 405)
  assert(f.reads() === 0)
})

Deno.test('rename updates only full_name, trims whitespace and reports missing profile', async () => {
  const f = fixture()
  const payload = { action: 'rename', userId: otherId, fullName: '  Nombre editado  ', role: 'admin', email: 'other@example.test', is_active: false }
  assert((await f.send(payload)).status === 200)
  assert(f.calls.length === 1)
  assert(JSON.stringify(f.calls[0]) === JSON.stringify({ full_name: 'Nombre editado' }))
  assert((await fixture('admin', true, true, { profile: true }).send(payload)).status === 400)
})
Deno.test('rename rejects unauthorized actors and invalid names or identifiers', async () => {
  const payload = { action: 'rename', userId: otherId, fullName: 'Nuevo nombre' }
  for (const [role, active] of [['usuario', true], ['invitado', true], ['admin', false]] as const) {
    const f = fixture(role, active)
    assert((await f.send(payload)).status === 403)
    assert(f.calls.length === 0)
  }
  for (const fullName of ['', '   ', 'x'.repeat(121), null, 123]) {
    const f = fixture()
    assert((await f.send({ ...payload, fullName })).status === 400)
    assert(f.calls.length === 0)
  }
  assert((await fixture().send({ ...payload, userId: 'invalid' })).status === 400)
  assert((await fixture().send({ ...payload, userId: actorId })).status === 200)
})

Deno.test('promotes a profile to admin without changing its state or other fields', async () => {
  const f = fixture()
  const response = await f.send({ action: 'promote-admin', userId: otherId, role: 'usuario', is_active: false })
  assert(response.status === 200)
  assert(f.calls.length === 1)
  assert(JSON.stringify(f.calls[0]) === JSON.stringify({ role: 'admin' }))
  assert((await fixture('admin', true, true, { profile: true }).send({ action: 'promote-admin', userId: otherId })).status === 400)
})

Deno.test('promotion requires an active admin and a valid target identifier', async () => {
  for (const [role, active] of [['usuario', true], ['invitado', true], ['admin', false]] as const) {
    const f = fixture(role, active)
    assert((await f.send({ action: 'promote-admin', userId: otherId })).status === 403)
    assert(f.calls.length === 0)
  }
  assert((await fixture().send({ action: 'promote-admin', userId: 'invalid' })).status === 400)
})
