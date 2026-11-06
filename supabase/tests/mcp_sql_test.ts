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
  const unifiedMarker = '-- MCP unified consent bootstrap: equivalent to 202610300002_mcp_unified_consent.sql.'
  const readonlyMarker = '-- Read-only inactive boards (202611060001). Deletion requires board-delete Edge.'
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
      await sql(mode, mode === 'bootstrap' ? schema.slice(0, schema.indexOf(unifiedMarker)) : schema.slice(0, schema.indexOf(marker)))
      if (mode === 'incremental') {
        for (const migration of ['202610280002_mcp_identity', '202610280003_mcp_task_read', '202610290001_mcp_workflow', '202610300001_mcp_automation']) {
          await sql(mode, await read(`supabase/migrations/${migration}.sql`))
        }
      }
      await sql(mode, mode === 'bootstrap' ? schema.slice(schema.indexOf(readonlyMarker))
        : await read('supabase/migrations/202611060001_inactive_board_readonly.sql'))
      // user_access.sql expects a pre-existing administrator. This seed exists
      // only in the disposable test database; the probes themselves ROLLBACK.
      await sql(mode, `insert into auth.users(id,email,raw_user_meta_data)
        values('00000000-0000-0000-0000-000000000001','admin@example.test','{}');
        update public.profiles set role='admin' where id='00000000-0000-0000-0000-000000000001';`)
      for (const probe of ['mcp_identity', 'mcp_task_read', 'mcp_workflow', 'mcp_automation', 'boards', 'task_assignments', 'user_access', 'inactive_board_readonly', 'board_assignment_access']) {
        await sql(mode, await read(`supabase/tests/${probe}.sql`))
        console.log(`PASS ${mode}: ${probe}`)
      }
      await sql(mode, await read('supabase/tests/support/mcp_unified_seed.sql'))
      await sql(mode, mode === 'bootstrap' ? schema.slice(schema.indexOf(unifiedMarker), schema.indexOf(readonlyMarker))
        : await read('supabase/migrations/202610300002_mcp_unified_consent.sql'))
      await sql(mode, await read('supabase/tests/mcp_unified_consent.sql'))
      console.log(`PASS ${mode}: unified consent migration, grants, automatic workflow and revocation`)
      for (const probe of ['boards','task_assignments','user_access','inactive_board_readonly']) {
        await sql(mode, await read(`supabase/tests/${probe}.sql`))
        console.log(`PASS ${mode}: post-unification ${probe}`)
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
          select id,user_id,client_id,granted_at,array['read_tasks','read_attachments','start_task','comment_task','review_task']
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
      // Repeat with the automatic mode: no synthetic human flags and the same
      // version/idempotency guarantees as the compatible manual workflow.
      await sql(mode, `
        update public.tasks set status='backlog' where id='${task}';
        delete from public.comments where task_id='${task}';`)
      const autoVersion = (await sql(mode, `select updated_at from public.tasks where id='${task}';`)).split('\n').map(line => line.trim()).find(line => /^2026-/.test(line))
      if (!autoVersion) throw new Error('Missing automatic concurrency version')
      const autoStarts = await Promise.allSettled([call('start_task', crypto.randomUUID(), autoVersion, { authorization_mode: 'automatic', context_summary: 'Studied scope' }),
        call('start_task', crypto.randomUUID(), autoVersion, { authorization_mode: 'automatic', context_summary: 'Studied scope' })])
      if (autoStarts.filter(result => result.status === 'fulfilled').length !== 1) throw new Error('Automatic concurrent starts bypassed version check')
      const resultVersion = (await sql(mode, `select updated_at from public.tasks where id='${task}';`)).split('\n').map(line => line.trim()).find(line => /^2026-/.test(line))
      if (!resultVersion) throw new Error('Missing automatic result version')
      const autoRequest = crypto.randomUUID(), autoPayload = { ...payload, authorization_mode: 'automatic' }
      await Promise.all([call('comment_task', autoRequest, resultVersion, autoPayload), call('comment_task', autoRequest, resultVersion, autoPayload)])
      await sql(mode, `do $$ begin if (select count(*) from public.comments where task_id='${task}') <> 1
        then raise exception 'Automatic concurrent retry duplicated result'; end if; end $$;`)
      console.log(`PASS ${mode}: automatic concurrent version conflict and idempotent result`)
      for (const target of ['connection', 'session']) {
        const label = `unified-revoke-${target}`
        const revoke = target === 'connection'
          ? `update auth.oauth_consents set revoked_at=clock_timestamp() where id='${consent}'`
          : `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id='${session}'`
        const withdrawal = sql(mode, `set application_name='${label}'; begin;
          ${revoke}; select pg_sleep(1); commit;`)
        let observed = false
        for (let attempt = 0; attempt < 30; attempt++) {
          const ready = await sql(mode, `select exists(select 1 from pg_stat_activity
            where application_name='${label}' and wait_event='PgSleep') as ready;`)
          if (/\bt\b/.test(ready)) { observed = true; break }
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        if (!observed) { await withdrawal; throw new Error('Did not observe concurrent opt-out transaction') }
        const results = await Promise.allSettled([withdrawal,
          call('start_task', crypto.randomUUID(), resultVersion, { authorization_mode: 'automatic', context_summary: 'Revoked scope' })])
        if (results[0].status !== 'fulfilled' || results[1].status !== 'rejected'
          || !/revoked|consent required|OAuth grant required/i.test(String(results[1].reason))) throw new Error(`Concurrent revocation failed closed check: ${String(results[1].status === 'rejected' ? results[1].reason : 'succeeded')}`)
        if (target === 'connection') await sql(mode, `update auth.oauth_consents set revoked_at=null where id='${consent}';
          insert into public.mcp_workflow_permissions(consent_id,profile_id,client_id,consent_granted_at,permissions)
          select id,user_id,client_id,granted_at,array['read_tasks','read_attachments','start_task','comment_task','review_task'] from auth.oauth_consents where id='${consent}';`)
      }
      console.log(`PASS ${mode}: concurrent connection and session revocation block automatic mutations`)
      // Inactive-board guards must serialize with lifecycle updates, not just
      // pass single-session RLS tests with a previously read is_active flag.
      const lockedBoard = crypto.randomUUID()
      const adminClaims = JSON.stringify({ sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated' })
      const portal = `select set_config('request.jwt.claims','${adminClaims}',false); set role authenticated;`
      await sql(mode, `insert into public.boards(id,name) values('${lockedBoard}','Readonly concurrency fixture');`)
      const awaitSleeping = async (label: string) => {
        for (let attempt = 0; attempt < 40; attempt++) {
          const ready = await sql(mode, `select exists(select 1 from pg_stat_activity where application_name='${label}' and wait_event='PgSleep');`)
          if (/\bt\b/.test(ready)) return
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        throw new Error(`Did not observe ${label}`)
      }
      const disabling = sql(mode, `set application_name='readonly-disable'; begin; ${portal}
        select public.set_board_active('${lockedBoard}',false); select pg_sleep(1); commit;`)
      await awaitSleeping('readonly-disable')
      const afterDisable = await Promise.allSettled([disabling, sql(mode, `${portal}
        select public.create_task_with_assignees('${lockedBoard}','Must fail',null,'backlog','normal','{}');`)])
      if (afterDisable[0].status !== 'fulfilled' || afterDisable[1].status !== 'rejected'
        || !String(afterDisable[1].reason).includes('Board is not writable')) throw new Error('Concurrent disable failed closed check')
      await sql(mode, `update public.boards set is_active=true where id='${lockedBoard}';`)
      const creating = sql(mode, `set application_name='readonly-create'; begin; ${portal}
        select public.create_task_with_assignees('${lockedBoard}','Created while active',null,'backlog','normal','{}'); select pg_sleep(1); commit;`)
      await awaitSleeping('readonly-create')
      await Promise.all([creating, sql(mode, `${portal} select public.set_board_active('${lockedBoard}',false);`)])
      await sql(mode, `do $$ begin
        if (select is_active from public.boards where id='${lockedBoard}')
          or (select count(*) from public.tasks where board_id='${lockedBoard}') <> 1
        then raise exception 'Lifecycle/write serialization lost data'; end if;
      end $$;`)
      console.log(`PASS ${mode}: concurrent creation/deactivation serialize in both orders`)
    }
  } finally { await docker(['stop', name]) }
})
