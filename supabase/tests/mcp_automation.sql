-- Local/rollback integration of the independent opt-ins and honest audit trail.
begin;
insert into public.mcp_oauth_configuration values(true,'https://example.test/functions/v1/mcp')
  on conflict(singleton) do update set resource_url=excluded.resource_url;
select set_config('test.user',gen_random_uuid()::text,true);
select set_config('test.client',gen_random_uuid()::text,true);
select set_config('test.session',gen_random_uuid()::text,true);
select set_config('test.task',gen_random_uuid()::text,true);
select set_config('test.board',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('test.user')::uuid,'automation@example.test');
update public.profiles set role='usuario' where id=current_setting('test.user')::uuid;
insert into auth.oauth_clients(id,client_name) values(current_setting('test.client')::uuid,'Automation fixture');
insert into auth.sessions(id,user_id,oauth_client_id) values(current_setting('test.session')::uuid,current_setting('test.user')::uuid,current_setting('test.client')::uuid);
insert into auth.oauth_consents(user_id,client_id) values(current_setting('test.user')::uuid,current_setting('test.client')::uuid);
insert into public.mcp_workflow_permissions(consent_id,profile_id,client_id,consent_granted_at,permissions)
  select id,user_id,client_id,granted_at,array['read_tasks','read_attachments','start_task','comment_task','review_task']
  from auth.oauth_consents where client_id=current_setting('test.client')::uuid;
insert into public.boards(id,name) values(current_setting('test.board')::uuid,'Automation fixture');
insert into public.board_members(board_id,profile_id) values(current_setting('test.board')::uuid,current_setting('test.user')::uuid);
insert into public.tasks(id,board_id,title,status) values(current_setting('test.task')::uuid,current_setting('test.board')::uuid,'Automation fixture','backlog');
insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
select set_config('test.portal',jsonb_build_object('sub',current_setting('test.user'),'role','authenticated')::text,true);
select set_config('test.claims',jsonb_build_object('sub',current_setting('test.user'),'role','mcp_identity',
  'aud','https://example.test/functions/v1/mcp','client_id',current_setting('test.client'),'session_id',current_setting('test.session'))::text,true);
create function pg_temp.probe_auto(p_allowed boolean) returns void language plpgsql as $$
declare t uuid:=current_setting('test.task')::uuid; v timestamptz; r jsonb;
begin
  v:=(public.mcp_get_task(t)->'task'->>'updated_at')::timestamptz;
  if (public.mcp_get_task(t)->>'automatic_advance')::boolean is distinct from p_allowed then raise exception 'Incorrect effective automation'; end if;
  begin
    r:=public.mcp_work_task(t,'start_task',gen_random_uuid(),v,'{"authorization_mode":"automatic","context_summary":"Scope studied"}');
    if not p_allowed then raise exception 'Unauthorized automatic start'; end if;
  exception when sqlstate 'PT403' then if p_allowed then raise; end if; end;
end $$;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
do $$ begin
  if public.mcp_get_task_automation(current_setting('test.task')::uuid) then raise exception 'Task defaults enabled'; end if;
  if public.mcp_list_workflow_access()->0->>'automatic_advance' <> 'false' then raise exception 'Old grant widened'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(false);
do $$ begin
  begin perform public.mcp_set_task_automation(current_setting('test.task')::uuid,true); raise exception 'MCP self-enabled'; exception when insufficient_privilege then null; end;
  begin perform public.mcp_set_automation_consent(current_setting('test.client')::uuid,true); raise exception 'MCP self-consented'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_task_automation(current_setting('test.task')::uuid,true);
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(false); -- task only
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_task_automation(current_setting('test.task')::uuid,false);
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,true);
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(false); -- connection only
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_task_automation(current_setting('test.task')::uuid,true);
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(true);
do $$ declare t uuid:=current_setting('test.task')::uuid; v timestamptz; r jsonb; req uuid:=gen_random_uuid(); args jsonb;
begin
  v:=(public.mcp_get_task(t)->'task'->>'updated_at')::timestamptz;
  begin perform public.mcp_work_task(t,'start_task',gen_random_uuid(),v,'{"authorization_mode":"automatic","user_approved":true,"context_summary":"Scope"}'); raise exception 'Synthetic approval accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_work_task(t,'start_task',gen_random_uuid(),v-interval '1 second','{"authorization_mode":"automatic","context_summary":"Scope"}'); raise exception 'Stale automatic start'; exception when sqlstate 'PT428' then null; end;
  begin perform public.mcp_work_task(t,'review_task',gen_random_uuid(),v,jsonb_build_object('authorization_mode','automatic','work_completed',true,'comment_id',gen_random_uuid())); raise exception 'Review without result'; exception when invalid_parameter_value then null; end;
  begin perform public.mcp_work_task(t,'comment_task',gen_random_uuid(),v,'{"authorization_mode":"automatic","summary":"Incomplete"}'); raise exception 'Incomplete result'; exception when invalid_parameter_value then null; end;
  args:='{"authorization_mode":"automatic","summary":"Done","changes":"Implementation","clarifications":"None","validation":"Not executed: unavailable","observations":"No remaining scope"}';
  r:=public.mcp_work_task(t,'comment_task',req,v,args);
  if public.mcp_work_task(t,'comment_task',req,v,args)->>'replayed' <> 'true' then raise exception 'Automatic result not idempotent'; end if;
  begin perform public.mcp_work_task(t,'comment_task',req,v,args||'{"summary":"Different"}'); raise exception 'Changed retry accepted'; exception when sqlstate 'PT422' then null; end;
  perform set_config('test.comment',r->>'comment_id',true);
  perform set_config('test.version',r->>'updated_at',true);
  begin perform public.mcp_work_task(t,'review_task',gen_random_uuid(),v,jsonb_build_object('authorization_mode','automatic','work_completed',false,'comment_id',r->>'comment_id')); raise exception 'Incomplete work reviewed'; exception when invalid_parameter_value then null; end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.mcp_task_operations where task_id=current_setting('test.task')::uuid
    and (payload ? 'user_approved' or payload ? 'user_validated' or result->>'authorization_mode' <> 'automatic')) then raise exception 'False human audit'; end if;
  if (select count(*) from public.comments where task_id=current_setting('test.task')::uuid) <> 1
    or not exists(select 1 from public.comments where id=current_setting('test.comment')::uuid and body like '%sin aceptación humana adicional%') then raise exception 'Incorrect result trace'; end if;
end $$;
-- Live access remains mandatory with both opt-ins.
delete from public.task_assignees where task_id=current_setting('test.task')::uuid;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Unassigned access'; exception when sqlstate 'PT412' then null; end;
end $$;
reset role;
insert into public.task_assignees(task_id,profile_id) values(current_setting('test.task')::uuid,current_setting('test.user')::uuid);
delete from public.board_members where board_id=current_setting('test.board')::uuid;
set local role mcp_identity;
do $$ begin
  begin perform public.mcp_get_task(current_setting('test.task')::uuid); raise exception 'Board access bypass'; exception when sqlstate 'PT404' then null; end;
end $$;
reset role;
insert into public.board_members(board_id,profile_id) values(current_setting('test.board')::uuid,current_setting('test.user')::uuid);
-- Withdrawal is immediately effective; workflow regrant does not restore automation.
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,false);
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(false);
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,true);
select public.mcp_revoke_workflow_permission(current_setting('test.client')::uuid,'review_task');
reset role;
do $$ begin
  if exists(select 1 from public.mcp_automation_consents where client_id=current_setting('test.client')::uuid) then raise exception 'Workflow withdrawal kept automation'; end if;
end $$;
update public.mcp_workflow_permissions set permissions=array['read_tasks','start_task','comment_task','review_task'] where client_id=current_setting('test.client')::uuid;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,true);
reset role;
update auth.oauth_consents set granted_at=granted_at+interval '1 second' where client_id=current_setting('test.client')::uuid;
do $$ begin
  if exists(select 1 from public.mcp_automation_consents where client_id=current_setting('test.client')::uuid) then raise exception 'Renewal inherited automation'; end if;
end $$;
update public.mcp_workflow_permissions w set consent_granted_at=c.granted_at from auth.oauth_consents c where c.id=w.consent_id and c.client_id=current_setting('test.client')::uuid;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,true);
reset role;
update auth.oauth_consents set revoked_at=now() where client_id=current_setting('test.client')::uuid;
do $$ begin
  if exists(select 1 from public.mcp_automation_consents where client_id=current_setting('test.client')::uuid) then raise exception 'Revocation kept automation'; end if;
end $$;
update auth.oauth_consents set revoked_at=null where client_id=current_setting('test.client')::uuid;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
select pg_temp.probe_auto(false);
reset role;
select set_config('request.jwt.claims',current_setting('test.portal'),true);
set local role authenticated;
select public.mcp_set_automation_consent(current_setting('test.client')::uuid,true);
reset role;
select set_config('request.jwt.claims',current_setting('test.claims'),true);
set local role mcp_identity;
do $$ declare t uuid:=current_setting('test.task')::uuid; req uuid:=gen_random_uuid(); args jsonb; r jsonb;
begin
  args:=jsonb_build_object('authorization_mode','automatic','work_completed',true,'comment_id',current_setting('test.comment'));
  r:=public.mcp_work_task(t,'review_task',req,current_setting('test.version')::timestamptz,args);
  if r->>'status' <> 'en_revision' or r->>'authorization_mode' <> 'automatic' then raise exception 'Automatic review failed'; end if;
  if public.mcp_work_task(t,'review_task',req,current_setting('test.version')::timestamptz,args)->>'replayed' <> 'true' then raise exception 'Review retry failed'; end if;
  begin perform public.mcp_get_task(t); raise exception 'Review still readable'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
rollback;
