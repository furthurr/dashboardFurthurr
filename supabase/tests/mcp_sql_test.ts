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
      if (mode === 'incremental') {
        for (const migration of ['202610280002_mcp_identity', '202610280003_mcp_task_read', '202610290001_mcp_workflow']) {
          await sql(mode, await read(`supabase/migrations/${migration}.sql`))
        }
      }
      // user_access.sql expects a pre-existing administrator. This seed exists
      // only in the disposable test database; the probes themselves ROLLBACK.
      await sql(mode, `insert into auth.users(id,email,raw_user_meta_data)
        values('00000000-0000-0000-0000-000000000001','admin@example.test','{}');
        update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000001';`)
      for (const probe of ['mcp_identity', 'mcp_task_read', 'mcp_workflow', 'boards', 'task_assignments', 'user_access']) {
        await sql(mode, await read(`supabase/tests/${probe}.sql`))
        console.log(`PASS ${mode}: ${probe}`)
      }
      // Real independent transactions: two concurrent starts must not overwrite
      // each other; two retries of a result must publish exactly one comment.
      const user = crypto.randomUUID(), client = crypto.randomUUID(), session = crypto.randomUUID()
      const board = crypto.randomUUID(), task = crypto.randomUUID(), consent = crypto.randomUUID()
      await sql(mode, `
        insert into public.mcp_oauth_configuration values(true,'https://example.test/functions/v1/mcp')
          on conflict(singleton) do update set resource_url=excluded.resource_url;
        insert into auth.users(id,email) values('${user}','concurrent@example.test');
        update public.profiles set role='usuario' where id='${user}';
        insert into auth.oauth_clients(id,client_name) values('${client}','Concurrency fixture');
        insert into auth.sessions(id,user_id,oauth_client_id) values('${session}','${user}','${client}');
        insert into auth.oauth_consents(id,user_id,client_id) values('${consent}','${user}','${client}');
        insert into public.mcp_workflow_permissions(consent_id,profile_id,client_id,consent_granted_at,permissions)
          select id,user_id,client_id,granted_at,array['read_tasks','start_task','comment_task','review_task']
          from auth.oauth_consents where id='${consent}';
        insert into public.boards(id,name) values('${board}','Concurrency fixture');
        insert into public.board_members(board_id,profile_id) values('${board}','${user}');
        insert into public.tasks(id,board_id,title,status,updated_at) values('${task}','${board}','Concurrent','backlog','2026-01-01T00:00:00Z');
        insert into public.task_assignees(task_id,profile_id) values('${task}','${user}');`)
      const claims = JSON.stringify({ sub: user, role: 'mcp_identity', client_id: client, session_id: session,
        aud: 'https://example.test/functions/v1/mcp' })
      const call = (action: string, request: string, version: string, payload: unknown) => sql(mode, `
        select set_config('request.jwt.claims','${claims}',false);
        set role mcp_identity;
        select public.mcp_work_task('${task}','${action}','${request}','${version}','${JSON.stringify(payload)}');`)
      const starts = await Promise.allSettled([call('start_task', crypto.randomUUID(), '2026-01-01T00:00:00Z', { user_approved: true, context_summary: 'Agreed scope' }),
        call('start_task', crypto.randomUUID(), '2026-01-01T00:00:00Z', { user_approved: true, context_summary: 'Agreed scope' })])
      if (starts.filter(result => result.status === 'fulfilled').length !== 1) {
        throw new Error(`Concurrent stale starts both succeeded or both failed: ${starts.map(result => result.status === 'rejected' ? String(result.reason) : 'success').join('; ')}`)
      }
      const version = (await sql(mode, `select updated_at from public.tasks where id='${task}';`)).split('\n').map(line => line.trim()).find(line => /^2026-/.test(line))
      if (!version) throw new Error('Missing concurrency version')
      const request = crypto.randomUUID()
      const payload = { summary: 'Done', changes: 'Changed', clarifications: 'None', validation: 'Checked', observations: 'None' }
      await Promise.all([call('comment_task', request, version, payload), call('comment_task', request, version, payload)])
      const count = await sql(mode, `do $$ begin if (select count(*) from public.comments where task_id='${task}') <> 1
        then raise exception 'Concurrent retry duplicated comment'; end if; end $$;`)
      if (count.includes('ERROR')) throw new Error('Concurrent retry failed')
      console.log(`PASS ${mode}: concurrent version conflict and idempotent result`)
    }
  } finally { await docker(['stop', name]) }
})
