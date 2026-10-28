// Isolated PostgreSQL integration tests. No production connection or secrets.
// Requires Docker and a cached/pullable postgres:16-alpine image.
const root = new URL('../../', import.meta.url)
const read = (path: string) => Deno.readTextFile(new URL(path, root))

Deno.test('MCP SQL isolation and portal regressions: incremental + fresh bootstrap', async () => {
  const name = `furthurr-mcp-test-${crypto.randomUUID()}`
  async function docker(args: string[], input?: string) {
    const child = new Deno.Command('docker', { args, stdin: input ? 'piped' : 'null', stdout: 'piped', stderr: 'piped' }).spawn()
    if (input) {
      const writer = child.stdin.getWriter()
      await writer.write(new TextEncoder().encode(input))
      await writer.close()
    }
    const result = await child.output()
    if (!result.success) throw new Error(new TextDecoder().decode(result.stderr))
    return new TextDecoder().decode(result.stdout)
  }
  const sql = (database: string, input: string) => docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-d', database, '-q', '-v', 'ON_ERROR_STOP=1'], input)
  const schema = await read('supabase-schema.sql')
  const marker = '-- MCP identity-only bootstrap.'
  if (!schema.includes(marker)) throw new Error('Missing bootstrap boundary')
  await docker(['run', '--rm', '--network', 'none', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-d', 'postgres:16-alpine'])
  try {
    let ready = false
    for (let attempt = 0; attempt < 40; attempt++) {
      // The entrypoint's temporary init server only listens on the Unix socket.
      try { await docker(['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); ready = true; break }
      catch { await new Promise(resolve => setTimeout(resolve, 250)) }
    }
    if (!ready) throw new Error('Test PostgreSQL did not become ready')
    for (const mode of ['incremental', 'bootstrap']) {
      await docker(['exec', name, 'createdb', '-U', 'postgres', mode])
      await sql(mode, await read('supabase/tests/support/mcp_harness.sql'))
      await sql(mode, mode === 'bootstrap' ? schema : schema.slice(0, schema.indexOf(marker)))
      if (mode === 'incremental') await sql(mode, await read('supabase/migrations/202610280002_mcp_identity.sql'))
      // user_access.sql expects a pre-existing administrator. This seed exists
      // only in the disposable test database; the probes themselves ROLLBACK.
      await sql(mode, `insert into auth.users(id,email,raw_user_meta_data)
        values('00000000-0000-0000-0000-000000000001','admin@example.test','{}');
        update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000001';`)
      for (const probe of ['mcp_identity', 'boards', 'task_assignments', 'user_access']) {
        await sql(mode, await read(`supabase/tests/${probe}.sql`))
        console.log(`PASS ${mode}: ${probe}`)
      }
    }
  } finally { await docker(['stop', name]) }
})
