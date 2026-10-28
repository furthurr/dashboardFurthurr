-- Run with a privileged test connection after 202610280002. All fixtures roll back.
begin;
insert into public.mcp_oauth_configuration(singleton, resource_url) values(true, 'https://example.test/functions/v1/mcp')
  on conflict(singleton) do update set resource_url = excluded.resource_url;
select set_config('test.mcp_user', gen_random_uuid()::text, true);
select set_config('test.mcp_client', gen_random_uuid()::text, true);
select set_config('test.mcp_session', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values(current_setting('test.mcp_user')::uuid, 'mcp-fixture@example.test', '{"full_name":"MCP fixture"}');
update public.profiles set role = 'admin' where id = current_setting('test.mcp_user')::uuid;

-- Use a real OAuth client fixture on Supabase (auth.sessions has an FK there).
-- The plain-Postgres harness intentionally has no oauth_clients table.
do $$ begin
  if to_regclass('auth.oauth_clients') is not null then
    execute 'insert into auth.oauth_clients(id, client_name, redirect_uris, grant_types, client_type, token_endpoint_auth_method, registration_type, client_secret_hash, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, ''manual'', '''', now(), now())'
      using current_setting('test.mcp_client')::uuid, 'MCP fixture', 'https://example.test/callback', 'authorization_code,refresh_token', 'public', 'none';
  end if;
end $$;
insert into auth.sessions(id, user_id, oauth_client_id) values(current_setting('test.mcp_session')::uuid, current_setting('test.mcp_user')::uuid, current_setting('test.mcp_client')::uuid);

do $$ declare original jsonb; changed jsonb; begin
  original := jsonb_build_object('sub', current_setting('test.mcp_user'), 'role', 'authenticated', 'aud', 'authenticated');
  if public.mcp_access_token_hook(jsonb_build_object('user_id', current_setting('test.mcp_user'), 'claims', original)) -> 'claims' <> original then
    raise exception 'Portal claims changed';
  end if;
  changed := public.mcp_access_token_hook(jsonb_build_object('user_id', current_setting('test.mcp_user'), 'client_id', current_setting('test.mcp_client'), 'claims', original)) -> 'claims';
  if changed ->> 'role' <> 'mcp_identity' or changed ->> 'aud' <> 'https://example.test/functions/v1/mcp'
    or changed ->> 'client_id' <> current_setting('test.mcp_client') then raise exception 'OAuth claims not isolated'; end if;
  changed := public.mcp_access_token_hook(jsonb_build_object('user_id', current_setting('test.mcp_user'),
    'claims', original || jsonb_build_object('client_id', current_setting('test.mcp_client')))) -> 'claims';
  if changed ->> 'role' <> 'mcp_identity' then raise exception 'OAuth refresh claims not isolated'; end if;
end $$;

select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.mcp_user'), 'role', 'mcp_identity',
  'aud', 'https://example.test/functions/v1/mcp', 'client_id', current_setting('test.mcp_client'), 'session_id', current_setting('test.mcp_session'))::text, true);
set local role mcp_identity;
do $$ declare resource text; operation text; statement text; column_name text; begin
  if public.mcp_whoami() ->> 'id' <> current_setting('test.mcp_user') then raise exception 'Wrong identity'; end if;
  foreach resource in array array['public.profiles','public.boards','public.board_members','public.tasks','public.task_assignees','public.comments','public.task_attachments','public.tasks_with_stats','public.tasks_with_assignees','storage.objects','public.mcp_oauth_configuration'] loop
    if resource = 'storage.objects' then
      begin execute 'select * from storage.objects'; raise exception 'MCP can access storage'; exception when insufficient_privilege then null; end;
      continue;
    end if;
    select attname into column_name from pg_attribute where attrelid = resource::regclass and attnum > 0 and not attisdropped order by attnum limit 1;
    foreach operation in array array['select','insert','update','delete'] loop
      if has_table_privilege(current_user, resource, operation) or
        (operation in ('select','insert','update') and has_any_column_privilege(current_user, resource, operation)) then
        raise exception 'Unexpected % grant on %', operation, resource;
      end if;
      -- Aggregate views reject writes before checking privileges; inspect grants above.
      if resource in ('public.tasks_with_stats','public.tasks_with_assignees') and operation <> 'select' then continue; end if;
      statement := case operation when 'select' then 'select * from ' || resource
        when 'insert' then 'insert into ' || resource || ' default values'
        when 'update' then format('update %s set %I = %I where false', resource, column_name, column_name)
        else 'delete from ' || resource end;
      begin
        execute statement;
        raise exception 'MCP unexpectedly allowed % on %', operation, resource;
      exception when insufficient_privilege then null; end;
    end loop;
  end loop;
  begin perform public.list_boards_with_pending_counts(); raise exception 'MCP can invoke business RPC'; exception when insufficient_privilege then null; end;
  begin perform public.rename_board(gen_random_uuid(), 'forbidden'); raise exception 'MCP can invoke write RPC'; exception when insufficient_privilege then null; end;
  begin perform public.mcp_access_token_hook('{}'); raise exception 'MCP can invoke token hook'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- A wrong audience/client/session must not return an identity.
select set_config('test.mcp_claims', current_setting('request.jwt.claims'), true);
select set_config('request.jwt.claims', jsonb_set(current_setting('test.mcp_claims')::jsonb, '{aud}', '"authenticated"')::text, true);
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_whoami(); raise exception 'Wrong audience accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_set(current_setting('test.mcp_claims')::jsonb, '{client_id}', to_jsonb(gen_random_uuid()::text))::text, true);
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_whoami(); raise exception 'Wrong client accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', current_setting('test.mcp_claims'), true);
update auth.sessions set not_after = now() - interval '1 second' where id = current_setting('test.mcp_session')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_whoami(); raise exception 'Expired session accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
update auth.sessions set not_after = null where id = current_setting('test.mcp_session')::uuid;

-- Disable the profile: existing MCP tokens lose access immediately.
update public.profiles set is_active = false where id = current_setting('test.mcp_user')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_whoami(); raise exception 'Inactive account accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    perform public.mcp_access_token_hook(jsonb_build_object('user_id', current_setting('test.mcp_user'), 'client_id', current_setting('test.mcp_client'), 'claims', '{}'));
    raise exception 'Inactive account received OAuth token';
  exception when insufficient_privilege then null; end;
end $$;
update public.profiles set is_active = true where id = current_setting('test.mcp_user')::uuid;
delete from auth.sessions where id = current_setting('test.mcp_session')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_whoami(); raise exception 'Revoked session accepted'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;

-- Ordinary portal sessions retain access to their own profile/business RPCs.
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.mcp_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.profiles where id = auth.uid()) then raise exception 'Portal profile unavailable'; end if;
  perform public.list_boards_with_pending_counts();
  begin perform public.mcp_whoami(); raise exception 'Portal token accepted by MCP RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin raise notice 'PASS: MCP claims, identity, grants, isolation, inactive account, revocation and portal regression'; end $$;
rollback;
