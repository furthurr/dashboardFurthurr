-- Disposable fixtures only; run after the MCP task-read migration. Always rollback.
begin;
insert into public.mcp_oauth_configuration(singleton, resource_url) values(true, 'https://example.test/functions/v1/mcp')
  on conflict(singleton) do update set resource_url = excluded.resource_url;
select set_config('test.user', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
select set_config('test.client', gen_random_uuid()::text, true);
select set_config('test.session', gen_random_uuid()::text, true);
select set_config('test.board', gen_random_uuid()::text, true);
select set_config('test.hidden_board', gen_random_uuid()::text, true);
select set_config('test.task', gen_random_uuid()::text, true);
select set_config('test.hidden_task', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data) values
  (current_setting('test.user')::uuid, 'reader@example.test', '{"full_name":"Reader"}'),
  (current_setting('test.other')::uuid, 'other@example.test', '{"full_name":"Other"}');
update public.profiles set role = 'usuario' where id in (current_setting('test.user')::uuid, current_setting('test.other')::uuid);
insert into auth.oauth_clients(id, client_name, redirect_uris, grant_types, client_type, token_endpoint_auth_method, registration_type, client_secret_hash, created_at, updated_at)
  values(current_setting('test.client')::uuid, 'Task read fixture', 'https://example.test/callback', 'authorization_code,refresh_token', 'public', 'none', 'manual', '', now(), now());
insert into auth.sessions(id, user_id, oauth_client_id) values(current_setting('test.session')::uuid, current_setting('test.user')::uuid, current_setting('test.client')::uuid);
insert into public.boards(id, name) values
  (current_setting('test.board')::uuid, 'MCP task fixture'),
  (current_setting('test.hidden_board')::uuid, 'MCP hidden fixture');
insert into public.board_members(board_id, profile_id) values(current_setting('test.board')::uuid, current_setting('test.user')::uuid);
insert into public.tasks(id, board_id, title, description, status, priority, special_notes, created_by) values
  (current_setting('test.task')::uuid, current_setting('test.board')::uuid, 'Task fixture', 'Description', 'haciendo', 'alta', 'Notes', current_setting('test.user')::uuid),
  (current_setting('test.hidden_task')::uuid, current_setting('test.hidden_board')::uuid, 'Hidden', null, 'backlog', 'normal', null, current_setting('test.other')::uuid);
-- Assignment alone MUST NOT grant access to the hidden board.
insert into public.task_assignees(task_id, profile_id) values
  (current_setting('test.task')::uuid, current_setting('test.other')::uuid),
  (current_setting('test.hidden_task')::uuid, current_setting('test.user')::uuid);
insert into public.comments(task_id, author_id, body) values
  (current_setting('test.task')::uuid, current_setting('test.user')::uuid, 'First'),
  (current_setting('test.task')::uuid, current_setting('test.other')::uuid, 'Second'),
  (current_setting('test.hidden_task')::uuid, current_setting('test.other')::uuid, 'Hidden comment');
insert into public.task_attachments(task_id, uploaded_by, file_name, file_url, file_size, mime_type)
  select current_setting('test.task')::uuid, current_setting('test.user')::uuid, 'file-' || n || '.pdf',
    'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('test.task') || '/' || n || '.pdf', 123, 'application/pdf'
  from generate_series(1, 2) n;
select set_config('test.claims', jsonb_build_object('sub', current_setting('test.user'), 'role', 'mcp_identity',
  'aud', 'https://example.test/functions/v1/mcp', 'client_id', current_setting('test.client'), 'session_id', current_setting('test.session'))::text, true);
select set_config('request.jwt.claims', current_setting('test.claims'), true);
set local role mcp_identity;
do $$ begin
  perform public.mcp_whoami();
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Old connection gained task access'; exception when sqlstate 'PT403' then null; end;
  begin perform public.mcp_set_task_read_access(current_setting('test.client')::uuid, true); raise exception 'MCP self-authorized'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- No cross-user approval; only a live portal account can approve its own sessions.
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.other'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin perform public.mcp_set_task_read_access(current_setting('test.client')::uuid, true); raise exception 'Cross-user approval'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.mcp_set_task_read_access(current_setting('test.client')::uuid, true);
do $$ begin
  if public.mcp_list_task_read_access() -> 0 ->> 'enabled' <> 'true' then raise exception 'Consent not listed'; end if;
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Portal invoked MCP query'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', current_setting('test.claims'), true);
set local role mcp_identity;
do $$ declare result jsonb; first_comment text; resource text; operation text; begin
  result := public.mcp_get_task(current_setting('test.task')::uuid, 0, 0, 1);
  if result -> 'task' ->> 'title' <> 'Task fixture' or result -> 'task' ->> 'status' <> 'haciendo'
    or result -> 'task' ->> 'description' <> 'Description' or result -> 'task' ->> 'special_notes' <> 'Notes'
    or jsonb_array_length(result -> 'assignees') <> 1 then raise exception 'Incomplete task'; end if;
  if result -> 'comments' ->> 'total' <> '2' or result -> 'comments' ->> 'next_offset' <> '1'
    or jsonb_array_length(result -> 'comments' -> 'items') <> 1
    or result -> 'attachments' ->> 'total' <> '2' or result -> 'attachments' ->> 'next_offset' <> '1' then raise exception 'Bad pagination'; end if;
  if result::text like '%email%' then raise exception 'Unnecessary email exposure'; end if;
  first_comment := result -> 'comments' -> 'items' -> 0 ->> 'id';
  result := public.mcp_get_task(current_setting('test.task')::uuid, 1, 1, 1);
  if result -> 'comments' -> 'items' -> 0 ->> 'id' = first_comment
    or result -> 'comments' -> 'next_offset' <> 'null'::jsonb or result -> 'attachments' -> 'next_offset' <> 'null'::jsonb then raise exception 'Bad continuation'; end if;
  result := public.mcp_get_task(current_setting('test.task')::uuid, 100, 100, 1);
  if result -> 'comments' -> 'items' <> '[]'::jsonb or result -> 'attachments' -> 'items' <> '[]'::jsonb then raise exception 'Bad empty page'; end if;
  begin perform public.mcp_get_task(current_setting('test.hidden_task')::uuid); raise exception 'Assignment leaked hidden board'; exception when sqlstate 'PT404' then null; end;
  begin perform public.mcp_get_task(gen_random_uuid()); raise exception 'Missing task accepted'; exception when sqlstate 'PT404' then null; end;
  begin perform public.mcp_get_task(current_setting('test.task')::uuid, -1); raise exception 'Negative offset accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_get_task(current_setting('test.task')::uuid, 0, 0, 101); raise exception 'Huge page accepted'; exception when invalid_parameter_value then null; end;
  foreach resource in array array['tasks','comments','profiles','boards','task_assignees','task_attachments','mcp_task_read_permissions'] loop
    foreach operation in array array['select','insert','update','delete'] loop
      if has_table_privilege(current_user, 'public.' || resource, operation) then raise exception 'Unexpected % grant on %', operation, resource; end if;
    end loop;
  end loop;
  begin perform public.move_task_to_board(current_setting('test.task')::uuid, current_setting('test.hidden_board')::uuid); raise exception 'MCP can modify task'; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Deactivation, membership removal and role checks apply immediately.
update public.boards set is_active = false where id = current_setting('test.board')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Inactive board visible'; exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
update public.profiles set role = 'admin' where id = current_setting('test.user')::uuid;
set local role mcp_identity;
do $$ begin
  if public.mcp_get_task(current_setting('test.task')::uuid) is null then raise exception 'Admin cannot read inactive board'; end if;
end $$;
reset role;
update public.profiles set role = 'usuario' where id = current_setting('test.user')::uuid;
update public.boards set is_active = true where id = current_setting('test.board')::uuid;
delete from public.board_members where board_id = current_setting('test.board')::uuid and profile_id = current_setting('test.user')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Removed membership retained access'; exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
insert into public.board_members(board_id, profile_id) values(current_setting('test.board')::uuid, current_setting('test.user')::uuid);
update public.profiles set is_active = false where id = current_setting('test.user')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Inactive account retained access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set is_active = true where id = current_setting('test.user')::uuid;

update auth.sessions set not_after = now() - interval '1 second' where id = current_setting('test.session')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Expired session retained task access'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
update auth.sessions set not_after = null where id = current_setting('test.session')::uuid;

-- Empty relations are arrays, not null; one missing relation never hides the task.
delete from public.comments where task_id = current_setting('test.task')::uuid;
delete from public.task_attachments where task_id = current_setting('test.task')::uuid;
delete from public.task_assignees where task_id = current_setting('test.task')::uuid;
set local role mcp_identity;
do $$ declare result jsonb; begin
  result := public.mcp_get_task(current_setting('test.task')::uuid);
  if result -> 'assignees' <> '[]'::jsonb or result -> 'comments' -> 'items' <> '[]'::jsonb
    or result -> 'attachments' -> 'items' <> '[]'::jsonb or result -> 'comments' ->> 'total' <> '0'
    or result -> 'attachments' ->> 'total' <> '0' then raise exception 'Empty relations not preserved'; end if;
end $$;
reset role;

-- Retiring read access does not revoke whoami. Reconnecting cannot inherit consent.
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.mcp_set_task_read_access(current_setting('test.client')::uuid, false);
reset role;
select set_config('request.jwt.claims', current_setting('test.claims'), true);
set local role mcp_identity;
do $$ begin
  perform public.mcp_whoami();
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Retired permission retained access'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('test.user'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.mcp_set_task_read_access(current_setting('test.client')::uuid, true);
reset role;
select set_config('test.new_session', gen_random_uuid()::text, true);
insert into auth.sessions(id, user_id, oauth_client_id) values(current_setting('test.new_session')::uuid, current_setting('test.user')::uuid, current_setting('test.client')::uuid);
set local role authenticated;
do $$ declare access jsonb; begin
  access := public.mcp_list_task_read_access() -> 0;
  if access ->> 'enabled' <> 'true' or access ->> 'needs_authorization' <> 'true' then raise exception 'Partial consent state hidden'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', jsonb_set(current_setting('test.claims')::jsonb, '{session_id}', to_jsonb(current_setting('test.new_session')))::text, true);
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'New session inherited consent'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
delete from auth.sessions where id = current_setting('test.session')::uuid;
do $$ begin
  if exists(select 1 from public.mcp_task_read_permissions where session_id = current_setting('test.session')::uuid) then raise exception 'Revocation did not cascade'; end if;
end $$;
select set_config('request.jwt.claims', current_setting('test.claims'), true);
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Revoked session retained task access'; exception when invalid_authorization_specification then null; end;
end $$;
reset role;
do $$ begin raise notice 'PASS: MCP task data, pagination, explicit consent, isolation, membership, inactive board/account and session revocation'; end $$;
rollback;
