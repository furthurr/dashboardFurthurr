import { createHandler } from './index.ts'
import type { createClient } from 'npm:@supabase/supabase-js@2.105.1'

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed') }
const boardId = '00000000-0000-0000-0000-000000000001'
const actorId = '00000000-0000-0000-0000-000000000002'
function fixture(options: { role?: string; active?: boolean; valid?: boolean; prepare?: string; storage?: boolean; finish?: boolean; paths?: unknown } = {}) {
  const calls: { name: string; value?: unknown }[] = []
  const client = {
    auth: { getUser: async () => ({ data: { user: options.valid === false ? null : { id: actorId } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: options.role ?? 'admin', is_active: options.active ?? true }, error: null }) }) }) }),
    rpc: async (name: string, value: unknown) => {
      calls.push({ name, value })
      if (name === 'prepare_board_deletion') return { data: options.paths ?? ['task/file.png'], error: options.prepare ? { code: options.prepare } : null }
      return { error: options.finish ? {} : null }
    },
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => {
      calls.push({ name: bucket, value: paths }); return { error: options.storage ? {} : null }
    } }) },
  }
  const handle = createHandler((() => client) as unknown as typeof createClient)
  const send = (body: unknown = { boardId }, claims: Record<string, unknown> | null = { role: 'authenticated' }) => handle(new Request('https://example.test/board-delete', {
    method: 'POST', headers: claims ? { Authorization: `Bearer fixture.${btoa(JSON.stringify(claims))}.fixture` } : {}, body: JSON.stringify(body),
  }))
  return { calls, handle, send }
}
Deno.test('board-delete rejects missing/invalid/OAuth/non-admin/inactive sessions before RPC', async () => {
  const missing = fixture(); assert((await missing.send({}, null)).status === 401)
  assert((await fixture({ valid: false }).send()).status === 401)
  for (const options of [{ role: 'usuario' }, { role: 'invitado' }, { active: false }]) {
    const f = fixture(options); assert((await f.send()).status === 403); assert(f.calls.length === 0)
  }
  for (const claims of [{ role: 'mcp_identity', client_id: boardId }, { role: 'authenticated', client_id: boardId }]) {
    const f = fixture(); assert((await f.send({ boardId }, claims)).status === 403); assert(f.calls.length === 0)
  }
})
Deno.test('board-delete validates input and methods', async () => {
  const f = fixture()
  for (const body of [null, {}, { boardId: 'bad', paths: ['injected'] }]) assert((await f.send(body)).status === 400)
  assert((await f.handle(new Request('https://example.test'))).status === 405)
  assert((await f.handle(new Request('https://example.test', { method: 'OPTIONS' }))).status === 200)
  assert(f.calls.length === 0)
})
Deno.test('board-delete prepares before server-only batched cleanup, then finishes with verified actor', async () => {
  const paths = Array.from({ length: 201 }, (_, i) => `task/${i}.png`)
  const f = fixture({ paths })
  assert((await f.send({ boardId, paths: ['injected'], actorId: 'spoofed' })).status === 200)
  assert(f.calls[0].name === 'prepare_board_deletion')
  assert(JSON.stringify(f.calls[0].value) === JSON.stringify({ p_board_id: boardId, p_actor_id: actorId }))
  assert(f.calls.filter((c) => c.name === 'task-attachments').length === 3)
  assert((f.calls[1].value as string[]).length === 100)
  assert(f.calls[4].name === 'finish_board_deletion')
})
Deno.test('board-delete refuses active/missing/unauthorized boards before Storage', async () => {
  for (const [prepare, status] of [['55000', 409], ['P0002', 404], ['42501', 403], ['unknown', 500]] as const) {
    const f = fixture({ prepare }); assert((await f.send()).status === status); assert(f.calls.length === 1)
  }
})
Deno.test('board-delete retains retryable state on cleanup failure and never finishes', async () => {
  const f = fixture({ storage: true })
  const response = await f.send()
  assert(response.status === 503); assert((await response.text()).includes('Reintenta'))
  assert(!f.calls.some((c) => c.name === 'finish_board_deletion'))
})
Deno.test('board-delete reports finalization failure, handles empty board and invalid manifest', async () => {
  assert((await fixture({ finish: true }).send()).status === 503)
  const empty = fixture({ paths: [] }); assert((await empty.send()).status === 200)
  assert(empty.calls.length === 2)
  const bad = fixture({ paths: [''] }); assert((await bad.send()).status === 500); assert(bad.calls.length === 1)
})
