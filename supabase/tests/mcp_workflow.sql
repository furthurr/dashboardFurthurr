-- Disposable fixtures; no service credentials. Always rollback.
begin;
insert into public.mcp_oauth_configuration values(true, 'https://example.test/functions/v1/mcp')
  on conflict(singleton) do update set resource_url = excluded.resource_url;
select set_config('test.user', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
select set_config('test.client', gen_random_uuid()::text, true);
select set_config('test.session', gen_random_uuid()::text, true);
select set_config('test.board', gen_random_uuid()::text, true);
select set_config('test.task', gen_random_uuid()::text, true);
select set_config('test.attachment', gen_random_uuid()::text, true);
insert into auth.users(id,email,raw_user_meta_data) values
  (current_setting('test.user')::uuid,'workflow@example.test','{"full_name":"Worker"}'),
  (current_setting('test.other')::uuid,'other@example.test','{}');
update public.profiles set role = 'usuario' where id = current_setting('test.user')::uuid;
insert into auth.oauth_clients(id,client_name,redirect_uris,grant_types,client_type,token_endpoint_auth_method,registration_type,client_secret_hash)
  values(current_setting('test.client')::uuid,'Workflow fixture','https://example.test/callback','authorization_code,refresh_token','public','none','manual','');
insert into auth.sessions(id,user_id,oauth_client_id) values(current_setting('test.session')::uuid,current_setting('test.user')::uuid,current_setting('test.client')::uuid);
insert into auth.oauth_consents(user_id,client_id) values(current_setting('test.user')::uuid,current_setting('test.client')::uuid);
insert into auth.oauth_authorizations(authorization_id,user_id,client_id,status)
  values('workflow-fixture',current_setting('test.user')::uuid,current_setting('test.client')::uuid,'pending');
insert into public.boards(id,name) values(current_setting('test.board')::uuid,'Workflow fixture');
insert into public.board_members(board_id,profile_id) values(current_setting('test.board')::uuid,current_setting('test.user')::uuid);
insert into public.tasks(id,board_id,title,status,created_by)
  values(current_setting('test.task')::uuid,current_setting('test.board')::uuid,'Workflow fixture','backlog',current_setting('test.user')::uuid);
insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
insert into public.task_attachments(id,task_id,uploaded_by,file_name,file_url,file_size,mime_type)
  values(current_setting('test.attachment')::uuid,current_setting('test.task')::uuid,current_setting('test.user')::uuid,'notes.txt',
    'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('test.task') || '/notes.txt',12,'text/plain');
select set_config('test.claims',jsonb_build_object('sub',current_setting('test.user'),'role','mcp_identity',
  'aud','https://example.test/functions/v1/mcp','client_id',current_setting('test.client'),'session_id',current_setting('test.session'))::text,true);
select set_config('test.portal',jsonb_build_object('sub',current_setting('test.user'),'role','authenticated')::text,true);
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
do $$ begin
  begin perform public.mcp_authorize_workflow('workflow-fixture'); raise exception 'Pending request authorized'; exception when insufficient_privilege then null; end;
end $$;
reset role;
update auth.oauth_authorizations set status = 'approved' where authorization_id = 'workflow-fixture';
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin
  begin perform public.mcp_authorize_workflow('workflow-fixture'); raise exception 'Cross-user authorization'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
do $$ begin
  if public.mcp_workflow_authorization_details('workflow-fixture')->>'authorized' <> 'false' then raise exception 'Old connection widened'; end if;
end $$;
select public.mcp_authorize_workflow('workflow-fixture');
do $$ begin
  if public.mcp_workflow_authorization_details('workflow-fixture')->>'authorized' <> 'true' then raise exception 'New authorization not reflected'; end if;
  if jsonb_array_length(public.mcp_list_workflow_access()->0->'permissions') <> 5 then raise exception 'Incomplete joint consent'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare t uuid := current_setting('test.task')::uuid; version timestamptz; receipt jsonb; request uuid := gen_random_uuid(); begin
  version := (public.mcp_get_task(t)->'task'->>'updated_at')::timestamptz;
  if public.mcp_get_attachment(t,current_setting('test.attachment')::uuid)->>'file_name' <> 'notes.txt' then raise exception 'Missing attachment'; end if;
  begin perform public.mcp_get_attachment(t,gen_random_uuid()); raise exception 'Other attachment visible'; exception when sqlstate 'PT404' then null; end;
  begin perform public.mcp_authorize_workflow('workflow-fixture'); raise exception 'MCP self-authorized'; exception when insufficient_privilege then null; end;
  begin perform public.mcp_work_task(t,'finalizadas',request,version,'{}'); raise exception 'MCP finalized'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_work_task(t,'start_task',request,version,'{"user_approved":false,"context_summary":"Scope"}'); raise exception 'No approval accepted'; exception when invalid_parameter_value then null; end;
  receipt := public.mcp_work_task(t,'start_task',request,version,'{"user_approved":true,"context_summary":"Scope agreed"}');
  if receipt->>'status' <> 'haciendo' then raise exception 'Did not start'; end if;
  if public.mcp_work_task(t,'start_task',request,version,'{"user_approved":true,"context_summary":"Scope agreed"}')->>'replayed' <> 'true' then raise exception 'Not idempotent'; end if;
  begin perform public.mcp_work_task(t,'start_task',request,version,'{"user_approved":true,"context_summary":"Different"}'); raise exception 'ID reused'; exception when sqlstate 'PT422' then null; end;
  version := (receipt->>'updated_at')::timestamptz;
  begin perform public.mcp_work_task(t,'review_task',gen_random_uuid(),version,'{"user_validated":true}'); raise exception 'Review without comment'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_work_task(t,'comment_task',gen_random_uuid(),version - interval '1 second','{}'); raise exception 'Stale update'; exception when sqlstate 'PT428' then null; end;
  request := gen_random_uuid();
  receipt := public.mcp_work_task(t,'comment_task',request,version,
    '{"summary":"Completed","changes":"Implementation","clarifications":"Agreed detail","validation":"Tests passed","observations":"Pending user validation"}');
  perform public.mcp_work_task(t,'comment_task',request,version,
    '{"summary":"Completed","changes":"Implementation","clarifications":"Agreed detail","validation":"Tests passed","observations":"Pending user validation"}');
  perform set_config('test.comment',receipt->>'comment_id',true);
  perform set_config('test.version',version::text,true);
end $$;
reset role;
do $$ begin
  if (select count(*) from public.comments where task_id = current_setting('test.task')::uuid) <> 1 then raise exception 'Duplicate comments'; end if;
  if not exists(select 1 from public.comments where id = current_setting('test.comment')::uuid and body like '%Cliente registrado%' and body like '%Agreed detail%') then raise exception 'Incomplete trace'; end if;
end $$;
-- Revoking one permission preserves identity and other permissions, and takes effect now.
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_revoke_workflow_permission(current_setting('test.client')::uuid,'review_task');
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ begin
  perform public.mcp_whoami(); perform public.mcp_get_task(current_setting('test.task')::uuid);
  begin perform public.mcp_work_task(current_setting('test.task')::uuid,'review_task',gen_random_uuid(),current_setting('test.version')::timestamptz,
    jsonb_build_object('user_validated',true,'comment_id',current_setting('test.comment'))); raise exception 'Revoked review still works'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_authorize_workflow('workflow-fixture');
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare request uuid := gen_random_uuid(); args jsonb := jsonb_build_object('user_validated',true,'comment_id',current_setting('test.comment')); begin
  if public.mcp_work_task(current_setting('test.task')::uuid,'review_task',request,current_setting('test.version')::timestamptz,args)->>'status' <> 'en_revision' then raise exception 'Not in review'; end if;
  if public.mcp_work_task(current_setting('test.task')::uuid,'review_task',request,current_setting('test.version')::timestamptz,args)->>'replayed' <> 'true' then raise exception 'Review retry failed'; end if;
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Review readable'; exception when sqlstate 'PT409' then null; end;
  begin perform public.mcp_get_attachment(current_setting('test.task')::uuid,current_setting('test.attachment')::uuid); raise exception 'Review attachment readable'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
-- All roles require assignment; all five stages are checked.
do $$ declare stage public.task_status; role_name public.user_role; begin
  foreach role_name in array array['usuario','invitado','admin']::public.user_role[] loop
    update public.profiles set role = role_name where id = current_setting('test.user')::uuid;
    foreach stage in array array['backlog','por_hacer','haciendo','en_revision','finalizadas']::public.task_status[] loop
      update public.tasks set status = stage where id = current_setting('test.task')::uuid;
      if stage in ('backlog','por_hacer','haciendo') then perform public.mcp_get_task(current_setting('test.task')::uuid);
      else
        begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Blocked stage readable'; exception when sqlstate 'PT409' then null; end;
        begin perform public.mcp_work_task(current_setting('test.task')::uuid,'start_task',gen_random_uuid(),now(),
          '{"user_approved":true,"context_summary":"Do not reopen"}'); raise exception 'Blocked stage reopened'; exception when sqlstate 'PT409' then null; end;
      end if;
    end loop;
    delete from public.task_assignees where task_id = current_setting('test.task')::uuid;
    begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Unassigned role readable'; exception when sqlstate 'PT412' then null; end;
    begin perform public.mcp_get_attachment(current_setting('test.task')::uuid,current_setting('test.attachment')::uuid); raise exception 'Unassigned attachment readable'; exception when sqlstate 'PT412' then null; end;
    begin perform public.mcp_work_task(current_setting('test.task')::uuid,'start_task',gen_random_uuid(),now(),
      '{"user_approved":true,"context_summary":"Unassigned"}'); raise exception 'Unassigned mutation allowed'; exception when sqlstate 'PT412' then null; end;
    insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
  end loop;
end $$;
update public.tasks set status = 'por_hacer' where id = current_setting('test.task')::uuid;
set local role mcp_identity;
do $$ declare t uuid := current_setting('test.task')::uuid; receipt jsonb; begin
  receipt := public.mcp_work_task(t,'start_task',gen_random_uuid(),(public.mcp_get_task(t)->'task'->>'updated_at')::timestamptz,
    '{"user_approved":true,"context_summary":"Start from por_hacer"}');
  if receipt->>'status' <> 'haciendo' then raise exception 'Por hacer not started'; end if;
  if public.mcp_work_task(t,'start_task',gen_random_uuid(),(receipt->>'updated_at')::timestamptz,
    '{"user_approved":true,"context_summary":"Continue haciendo"}')->>'updated_at' <> receipt->>'updated_at' then raise exception 'Haciendo changed unnecessarily'; end if;
end $$;
reset role;
-- Attachment permission can be withdrawn without withdrawing task context.
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_revoke_workflow_permission(current_setting('test.client')::uuid,'read_attachments');
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare context jsonb; begin
  context := public.mcp_get_task(current_setting('test.task')::uuid);
  if context->'attachments'->'items'->0->>'file_url' <> '' then raise exception 'Attachment link still exposed'; end if;
  begin perform public.mcp_get_attachment(current_setting('test.task')::uuid,current_setting('test.attachment')::uuid); raise exception 'Revoked attachment works'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
update public.tasks set status = 'haciendo' where id = current_setting('test.task')::uuid;
-- A renewed Auth consent must not inherit an older application's permissions.
update auth.oauth_consents set granted_at = granted_at + interval '1 second' where client_id = current_setting('test.client')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'New grant inherited permissions'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
update auth.oauth_consents set granted_at = granted_at - interval '1 second' where client_id = current_setting('test.client')::uuid;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_revoke_workflow_permission(current_setting('test.client')::uuid,'all');
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare resource text; begin
  perform public.mcp_whoami();
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Revoked read works'; exception when sqlstate 'PT403' then null; end;
  foreach resource in array array['mcp_workflow_permissions','mcp_task_operations','tasks','comments'] loop
    if has_table_privilege(current_user,'public.'||resource,'select,insert,update,delete') then raise exception 'Direct table grant'; end if;
  end loop;
end $$;
reset role;
select 'PASS: MCP joint consent, text metadata, assignment/all roles/stages, start, result, review, retries, concurrent version, revocation and isolation' as verification;
rollback;
