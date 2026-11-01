-- Runs after unified migration against disposable fixtures; rollback new work.
begin;
do $$ begin
  if (select count(*) from public.mcp_workflow_permissions where profile_id='10000000-0000-0000-0000-000000000001'
    and cardinality(permissions)=5) <> 4 then raise exception 'Existing application grants not upgraded precisely'; end if;
  if exists(select 1 from public.mcp_workflow_permissions where client_id='20000000-0000-0000-0000-000000000003') then
    raise exception 'Identity-only consent became application consent'; end if;
  if has_function_privilege('authenticated','public.mcp_revoke_workflow_permission(uuid,text)','execute')
    or has_function_privilege('authenticated','public.mcp_set_automation_consent(uuid,boolean)','execute')
    or has_function_privilege('authenticated','public.mcp_set_task_automation(uuid,boolean)','execute')
    or has_function_privilege('authenticated','public.mcp_set_task_read_access(uuid,boolean)','execute')
    or has_function_privilege('mcp_identity','public.mcp_authorize_workflow(text)','execute') then
    raise exception 'Legacy controls or MCP self-authorization still callable'; end if;
end $$;
insert into public.mcp_oauth_configuration values(true,'https://example.test/functions/v1/mcp')
  on conflict(singleton) do update set resource_url=excluded.resource_url;
select set_config('test.user','10000000-0000-0000-0000-000000000001',true);
select set_config('test.client','20000000-0000-0000-0000-000000000003',true);
select set_config('test.session',gen_random_uuid()::text,true);
select set_config('test.board',gen_random_uuid()::text,true);
select set_config('test.task',gen_random_uuid()::text,true);
select set_config('test.attachment',gen_random_uuid()::text,true);
update public.profiles set role='usuario' where id=current_setting('test.user')::uuid;
insert into auth.sessions(id,user_id,oauth_client_id) values(current_setting('test.session')::uuid,current_setting('test.user')::uuid,current_setting('test.client')::uuid);
insert into auth.oauth_authorizations(authorization_id,user_id,client_id,status)
  values('unified-fixture',current_setting('test.user')::uuid,current_setting('test.client')::uuid,'approved');
insert into public.boards(id,name) values(current_setting('test.board')::uuid,'Unified fixture');
insert into public.board_members(board_id,profile_id) values(current_setting('test.board')::uuid,current_setting('test.user')::uuid);
insert into public.tasks(id,board_id,title,status) values(current_setting('test.task')::uuid,current_setting('test.board')::uuid,'Unified fixture','backlog');
insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
insert into public.task_attachments(id,task_id,uploaded_by,file_name,file_url,file_size,mime_type)
values(current_setting('test.attachment')::uuid,current_setting('test.task')::uuid,current_setting('test.user')::uuid,
  'notes.txt','https://example.test/storage/v1/object/public/task-attachments/'||current_setting('test.task')||'/notes.txt',12,'text/plain');
select set_config('test.portal',jsonb_build_object('sub',current_setting('test.user'),'role','authenticated')::text,true);
select set_config('test.claims',jsonb_build_object('sub',current_setting('test.user'),'role','mcp_identity','aud','https://example.test/functions/v1/mcp',
  'client_id',current_setting('test.client'),'session_id',current_setting('test.session'))::text,true);
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ begin
  perform public.mcp_whoami();
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Identity-only can read'; exception when sqlstate 'PT403' then null; end;
  begin perform public.mcp_get_attachment(current_setting('test.task')::uuid,current_setting('test.attachment')::uuid); raise exception 'Identity-only can read attachment'; exception when sqlstate 'PT403' then null; end;
  begin perform public.mcp_work_task(current_setting('test.task')::uuid,'start_task',gen_random_uuid(),now(),'{"user_approved":true,"context_summary":"Scope"}');
    raise exception 'Human approval bypassed missing app consent'; exception when sqlstate 'PT403' then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
do $$ begin
  if (select count(*) from jsonb_array_elements(public.mcp_list_workflow_access()) x where x->>'automatic_advance'='true') <> 4 then
    raise exception 'Effective existing grants include stale or identity-only connections'; end if;
  if public.mcp_workflow_authorization_details('unified-fixture')->>'authorized' <> 'false' then raise exception 'Identity autoapproval authorized app'; end if;
end $$;
select public.mcp_authorize_workflow('unified-fixture');
do $$ begin
  if public.mcp_workflow_authorization_details('unified-fixture')->>'authorized' <> 'true' then raise exception 'Accepted app not authorized'; end if;
  if not exists(select 1 from jsonb_array_elements(public.mcp_list_workflow_access()) x where x->>'client_id'=current_setting('test.client')
    and jsonb_array_length(x->'permissions')=5 and x->>'automatic_advance'='true') then raise exception 'Bundle not effective'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare t uuid:=current_setting('test.task')::uuid; v timestamptz; r jsonb; req uuid:=gen_random_uuid(); args jsonb;
begin
  if public.mcp_get_task(t)->>'automatic_advance' <> 'true' then raise exception 'Task opt-in still required'; end if;
  if public.mcp_get_attachment(t,current_setting('test.attachment')::uuid)->>'file_name' <> 'notes.txt' then raise exception 'New bundle lacks attachments'; end if;
  v:=(public.mcp_get_task(t)->'task'->>'updated_at')::timestamptz;
  begin perform public.mcp_work_task(t,'start_task',gen_random_uuid(),v,'{"authorization_mode":"automatic","user_approved":true,"context_summary":"Scope"}'); raise exception 'Synthetic approval'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_work_task(t,'start_task',gen_random_uuid(),v-interval '1 second','{"authorization_mode":"automatic","context_summary":"Scope"}'); raise exception 'Stale start'; exception when sqlstate 'PT428' then null; end;
  r:=public.mcp_work_task(t,'start_task',req,v,'{"authorization_mode":"automatic","context_summary":"All context studied"}');
  if r->>'status' <> 'haciendo' or r->>'authorization_mode' <> 'automatic' then raise exception 'Automatic start failed'; end if;
  v:=(r->>'updated_at')::timestamptz;
  begin perform public.mcp_work_task(t,'review_task',gen_random_uuid(),v,jsonb_build_object('authorization_mode','automatic','work_completed',true,'comment_id',gen_random_uuid())); raise exception 'Review without current result'; exception when invalid_parameter_value then null; end;
  req:=gen_random_uuid();
  args:='{"authorization_mode":"automatic","summary":"Done","changes":"Changed","clarifications":"None","validation":"Checked","observations":"None"}';
  r:=public.mcp_work_task(t,'comment_task',req,v,args);
  if public.mcp_work_task(t,'comment_task',req,v,args)->>'replayed' <> 'true' then raise exception 'Result not idempotent'; end if;
  begin perform public.mcp_work_task(t,'comment_task',req,v,args||'{"summary":"Different"}'); raise exception 'ID reuse'; exception when sqlstate 'PT422' then null; end;
  begin perform public.mcp_work_task(t,'review_task',gen_random_uuid(),v,jsonb_build_object('authorization_mode','automatic','work_completed',false,'comment_id',r->>'comment_id')); raise exception 'Incomplete work reviewed'; exception when invalid_parameter_value then null; end;
  perform set_config('test.comment',r->>'comment_id',true);
  perform set_config('test.version',r->>'updated_at',true);
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.mcp_task_operations where task_id=current_setting('test.task')::uuid and (payload ? 'user_approved' or payload ? 'user_validated'))
    or not exists(select 1 from public.comments where id=current_setting('test.comment')::uuid and body like '%conexión autorizada; sin aceptación humana adicional%') then raise exception 'Dishonest audit'; end if;
end $$;
-- Live access restrictions still hold without a task opt-in.
delete from public.task_assignees where task_id=current_setting('test.task')::uuid;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Unassigned read'; exception when sqlstate 'PT412' then null; end;
end $$;
insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
delete from public.board_members where board_id=current_setting('test.board')::uuid;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Board bypass'; exception when sqlstate 'PT404' then null; end;
end $$;
insert into public.board_members(board_id,profile_id) values(current_setting('test.board')::uuid,current_setting('test.user')::uuid);
-- Every role still requires assignment, an accessible board and an allowed stage.
do $$ declare stage public.task_status; role_name public.user_role; begin
  foreach role_name in array array['usuario','invitado','admin']::public.user_role[] loop
    update public.profiles set role=role_name where id=current_setting('test.user')::uuid;
    foreach stage in array array['backlog','por_hacer','haciendo','en_revision','finalizadas']::public.task_status[] loop
      update public.tasks set status=stage where id=current_setting('test.task')::uuid;
      if stage in ('backlog','por_hacer','haciendo') then
        if public.mcp_get_task(current_setting('test.task')::uuid)->>'automatic_advance' <> 'true' then raise exception 'Role lost bundle'; end if;
      else
        begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Blocked stage readable'; exception when sqlstate 'PT409' then null; end;
      end if;
    end loop;
    delete from public.task_assignees where task_id=current_setting('test.task')::uuid;
    begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Unassigned role reads'; exception when sqlstate 'PT412' then null; end;
    insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
  end loop;
end $$;
update public.profiles set role='usuario' where id=current_setting('test.user')::uuid;
update public.tasks set status='haciendo' where id=current_setting('test.task')::uuid;
update public.boards set is_active=false where id=current_setting('test.board')::uuid;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Inactive board reads'; exception when sqlstate 'PT404' then null; end;
end $$;
update public.boards set is_active=true where id=current_setting('test.board')::uuid;
update public.profiles set is_active=false where id=current_setting('test.user')::uuid;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Inactive account reads'; exception when insufficient_privilege then null; end;
end $$;
update public.profiles set is_active=true where id=current_setting('test.user')::uuid;
update auth.sessions set not_after=now()-interval '1 second' where id=current_setting('test.session')::uuid;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Expired session reads'; exception when invalid_authorization_specification then null; end;
end $$;
update auth.sessions set not_after=null where id=current_setting('test.session')::uuid;
-- Result must match the current task version, not just exist.
alter table public.tasks disable trigger set_tasks_updated_at;
update public.tasks set title='Changed after result',updated_at=updated_at+interval '1 second' where id=current_setting('test.task')::uuid;
alter table public.tasks enable trigger set_tasks_updated_at;
do $$ begin
  begin perform public.mcp_work_task(current_setting('test.task')::uuid,'review_task',gen_random_uuid(),
    (public.mcp_get_task(current_setting('test.task')::uuid)->'task'->>'updated_at')::timestamptz,
    jsonb_build_object('authorization_mode','automatic','work_completed',true,'comment_id',current_setting('test.comment')));
    raise exception 'Stale result accepted'; exception when invalid_parameter_value then null; end;
end $$;
-- Restore result version solely to exercise successful review and retry.
alter table public.tasks disable trigger set_tasks_updated_at;
update public.tasks set updated_at=current_setting('test.version')::timestamptz where id=current_setting('test.task')::uuid;
alter table public.tasks enable trigger set_tasks_updated_at;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare t uuid:=current_setting('test.task')::uuid; req uuid:=gen_random_uuid(); args jsonb; r jsonb;
begin
  args:=jsonb_build_object('authorization_mode','automatic','work_completed',true,'comment_id',current_setting('test.comment'));
  r:=public.mcp_work_task(t,'review_task',req,current_setting('test.version')::timestamptz,args);
  if r->>'status' <> 'en_revision' then raise exception 'Review failed'; end if;
  if public.mcp_work_task(t,'review_task',req,current_setting('test.version')::timestamptz,args)->>'replayed' <> 'true' then raise exception 'Review retry failed'; end if;
  begin perform public.mcp_get_task(t); raise exception 'Review readable'; exception when sqlstate 'PT409' then null; end;
  begin perform public.mcp_work_task(t,'start_task',gen_random_uuid(),(r->>'updated_at')::timestamptz,'{"authorization_mode":"automatic","context_summary":"Scope"}'); raise exception 'Reopened'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
update auth.oauth_consents set revoked_at=now() where client_id=current_setting('test.client')::uuid;
do $$ begin
  if exists(select 1 from public.mcp_workflow_permissions where client_id=current_setting('test.client')::uuid) then raise exception 'Revoked app consent retained'; end if;
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Revoked connection reads'; exception when sqlstate 'PT403' then null; end;
  begin perform public.mcp_get_attachment(current_setting('test.task')::uuid,current_setting('test.attachment')::uuid); raise exception 'Revoked attachment read'; exception when sqlstate 'PT403' then null; end;
  begin perform public.mcp_work_task(current_setting('test.task')::uuid,'start_task',gen_random_uuid(),now(),'{"authorization_mode":"automatic","context_summary":"Scope"}');
    raise exception 'Revoked connection writes'; exception when sqlstate 'PT403' then null; end;
end $$;
update auth.oauth_consents set revoked_at=null where client_id=current_setting('test.client')::uuid;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
do $$ begin
  if public.mcp_workflow_authorization_details('unified-fixture')->>'authorized' <> 'false' then raise exception 'Reused row inherited app consent'; end if;
end $$;
select public.mcp_authorize_workflow('unified-fixture');
reset role;
update auth.oauth_consents set granted_at=granted_at+interval '1 second' where client_id=current_setting('test.client')::uuid;
do $$ begin
  if exists(select 1 from public.mcp_workflow_permissions where client_id=current_setting('test.client')::uuid) then raise exception 'Renewal kept stale app consent'; end if;
end $$;
rollback;
