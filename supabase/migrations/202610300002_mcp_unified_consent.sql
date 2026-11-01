-- Requires 202610300001. Apply only after checking actual objects and ledger.
-- Application consent, not OAuth identity alone, authorizes the complete bundle.
begin;

-- Expand only existing application grants tied to a live, matching Auth consent.
-- An OAuth consent with no current application grant is deliberately NOT backfilled.
update public.mcp_workflow_permissions w
set permissions = array['read_tasks','read_attachments','start_task','comment_task','review_task']
from auth.oauth_consents c
where c.id = w.consent_id and c.user_id = w.profile_id and c.client_id = w.client_id
  and c.granted_at = w.consent_granted_at and c.revoked_at is null;

-- Legacy session-bound application read consents also represent existing connections.
insert into public.mcp_workflow_permissions(consent_id,profile_id,client_id,consent_granted_at,permissions)
select distinct c.id,c.user_id,c.client_id,c.granted_at,
  array['read_tasks','read_attachments','start_task','comment_task','review_task']
from public.mcp_task_read_permissions r join auth.sessions s
  on s.id = r.session_id and s.user_id = r.profile_id and s.oauth_client_id = r.client_id
join auth.oauth_consents c on c.user_id = r.profile_id and c.client_id = r.client_id
where c.revoked_at is null and (s.not_after is null or s.not_after > now())
  and r.granted_at >= c.granted_at
on conflict(consent_id) do update set consent_granted_at = excluded.consent_granted_at,
  permissions = excluded.permissions, granted_at = now();

-- Remove management entry points, including legacy clients; revocation is OAuth-wide.
revoke all on function public.mcp_revoke_workflow_permission(uuid,text) from authenticated;
revoke all on function public.mcp_set_task_read_access(uuid,boolean) from authenticated;
revoke all on function public.mcp_set_automation_consent(uuid,boolean) from authenticated;
revoke all on function public.mcp_set_task_automation(uuid,boolean) from authenticated;
revoke all on function public.mcp_get_task_automation(uuid) from authenticated;

create or replace function public.mcp_has_workflow_permission(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_permission = any(array['read_tasks','read_attachments','start_task','comment_task','review_task'])
    and exists(select 1 from public.mcp_workflow_permissions w join auth.oauth_consents c on c.id = w.consent_id
      where w.profile_id = auth.uid() and w.client_id = (auth.jwt()->>'client_id')::uuid
        and c.user_id = w.profile_id and c.client_id = w.client_id and c.revoked_at is null
        and c.granted_at = w.consent_granted_at
        and w.permissions @> array['read_tasks','read_attachments','start_task','comment_task','review_task']);
$$;

create or replace function public.mcp_automation_enabled(p_task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.mcp_has_workflow_permission('start_task');
$$;

create or replace function public.mcp_list_workflow_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.jwt()->>'role' is distinct from 'authenticated'
    or coalesce(auth.jwt()->>'client_id','') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('client_id', c.client_id,
    'permissions',case when w.permissions @> array['read_tasks','read_attachments','start_task','comment_task','review_task']
      then w.permissions else '{}'::text[] end,
    'automatic_advance',coalesce(w.permissions @> array['read_tasks','read_attachments','start_task','comment_task','review_task'],false))), '[]'::jsonb)
    from auth.oauth_consents c left join public.mcp_workflow_permissions w
      on w.consent_id = c.id and w.profile_id = c.user_id and w.client_id = c.client_id
        and w.consent_granted_at = c.granted_at
    where c.user_id = auth.uid() and c.revoked_at is null);
end $$;

-- Revoking a connection permanently invalidates application consent, even if Auth
-- later reuses its row. A renewed grant must pass through the consent page again.
create function public.mcp_invalidate_application_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.revoked_at is not null or new.granted_at is distinct from old.granted_at then
    delete from public.mcp_workflow_permissions where consent_id = new.id;
    delete from public.mcp_task_read_permissions where profile_id = new.user_id and client_id = new.client_id;
  end if;
  return new;
end $$;
revoke all on function public.mcp_invalidate_application_consent() from public,anon,authenticated,mcp_identity;
create trigger mcp_application_consent_changed after update on auth.oauth_consents
  for each row execute function public.mcp_invalidate_application_consent();

create or replace function public.mcp_work_task(p_task_id uuid, p_action text, p_request_id uuid,
  p_expected_updated_at timestamptz, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare automatic boolean; mode text; receipt jsonb; previous public.mcp_task_operations;
  client uuid := (auth.jwt()->>'client_id')::uuid; task public.tasks; comment_id uuid; field text; client_name text;
begin
  perform public.mcp_whoami();
  if p_action is null or p_action not in ('start_task','comment_task','review_task') or p_request_id is null
    or p_expected_updated_at is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 80000 then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  perform 1 from auth.oauth_consents where user_id = auth.uid() and client_id = client for share;
  perform 1 from public.mcp_workflow_permissions where profile_id = auth.uid() and client_id = client for share;
  perform 1 from auth.sessions where id = (auth.jwt()->>'session_id')::uuid for share;
  perform 1 from public.tasks where id = p_task_id for update;
  perform 1 from public.task_assignees where task_id = p_task_id and profile_id = auth.uid() for share;
  perform 1 from public.profiles where id = auth.uid() for share;
  perform 1 from public.boards where id = (select board_id from public.tasks where id = p_task_id) for share;
  perform 1 from public.board_members where board_id = (select board_id from public.tasks where id = p_task_id)
    and profile_id = auth.uid() for share;
  if not public.mcp_has_workflow_permission(p_action) then
    raise exception 'Application connection consent required' using errcode = 'PT403';
  end if;
  task := public.mcp_assert_task_access(p_task_id, false);
  automatic := public.mcp_automation_enabled(p_task_id);
  mode := coalesce(p_payload->>'authorization_mode','human');
  if mode not in ('human','automatic')
    or (mode = 'automatic' and (p_payload ? 'user_approved' or p_payload ? 'user_validated'))
    or (mode = 'human' and p_payload ? 'work_completed') then
    raise exception 'Invalid authorization mode' using errcode = '22023';
  end if;
  if p_action = 'review_task' and mode = 'automatic' and p_payload->'work_completed' is distinct from 'true'::jsonb then
    raise exception 'Completed work required' using errcode = '22023';
  end if;
  select * into previous from public.mcp_task_operations where task_id = p_task_id and profile_id = auth.uid()
    and client_id = client and request_id = p_request_id;
  if previous.task_id is not null and (previous.action <> p_action or previous.payload <> p_payload) then
    raise exception 'Request ID reused' using errcode = 'PT422';
  end if;
  if previous.task_id is not null then
    return jsonb_build_object('request_id',p_request_id,'replayed',true,'authorization_mode',mode,'automatic_advance',automatic)
      || case when task.status in ('backlog','por_hacer','haciendo') then jsonb_build_object('comment_id',previous.result->'comment_id') else '{}'::jsonb end;
  end if;
  if task.status not in ('backlog','por_hacer','haciendo') then
    raise exception 'Move manually to haciendo' using errcode = 'PT409';
  end if;
  if task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task changed; reload' using errcode = 'PT428';
  end if;
  if p_action = 'start_task' then
    if (mode = 'human' and p_payload->'user_approved' is distinct from 'true'::jsonb)
      or jsonb_typeof(p_payload->'context_summary') is distinct from 'string'
      or length(p_payload->>'context_summary') > 12000 or nullif(btrim(p_payload->>'context_summary'),'') is null then
      raise exception 'Approval or automation and context required' using errcode = '22023';
    end if;
    if task.status <> 'haciendo' then
      update public.tasks set status = 'haciendo' where id = task.id returning * into task;
    end if;
  elsif p_action = 'comment_task' then
    if task.status <> 'haciendo' then raise exception 'Start first' using errcode = 'PT409'; end if;
    foreach field in array array['summary','changes','clarifications','validation','observations'] loop
      if jsonb_typeof(p_payload->field) is distinct from 'string' or length(p_payload->>field) > 12000
        or nullif(btrim(p_payload->>field),'') is null then
        raise exception 'Detailed result required' using errcode = '22023';
      end if;
    end loop;
    select c.client_name into client_name from auth.oauth_clients c where c.id = client;
    insert into public.comments(task_id,author_id,body) values(task.id,auth.uid(),
      'Trabajo realizado mediante MCP' || E'\nCliente registrado (nombre no verificado): ' || coalesce(client_name,'Sin nombre') ||
      ' [' || client::text || ']' || E'\nIntervención: ' || p_request_id::text ||
      E'\nModo de autorización: ' || case when mode = 'automatic'
        then 'automático (conexión autorizada; sin aceptación humana adicional)'
        else 'manual (las transiciones requieren aceptación humana explícita; este resultado no la acredita)' end ||
      E'\n\nResumen\n' || (p_payload->>'summary') || E'\n\nCambios realizados\n' || (p_payload->>'changes') ||
      E'\n\nAclaraciones y decisiones con el usuario\n' || (p_payload->>'clarifications') ||
      E'\n\nValidaciones y resultados\n' || (p_payload->>'validation') ||
      E'\n\nObservaciones, límites y pendientes\n' || (p_payload->>'observations')) returning id into comment_id;
  else
    if task.status <> 'haciendo' or (mode = 'human' and p_payload->'user_validated' is distinct from 'true'::jsonb)
      or not exists(select 1 from public.mcp_task_operations o join public.comments c
        on c.id::text = o.result->>'comment_id' and c.task_id = task.id
        where o.task_id = task.id and o.profile_id = auth.uid() and o.client_id = client
          and o.action = 'comment_task' and o.result->>'comment_id' = p_payload->>'comment_id'
          and (o.result->>'updated_at')::timestamptz = task.updated_at) then
      raise exception 'Validation or automation and current result required' using errcode = '22023';
    end if;
    update public.tasks set status = 'en_revision' where id = task.id returning * into task;
  end if;
  receipt := jsonb_build_object('request_id',p_request_id,'task_id',task.id,'status',task.status,
    'updated_at',task.updated_at,'comment_id',comment_id,'replayed',false,'authorization_mode',mode,'automatic_advance',automatic);
  insert into public.mcp_task_operations(task_id,profile_id,client_id,request_id,action,payload,result)
    values(task.id,auth.uid(),client,p_request_id,p_action,p_payload,receipt);
  return receipt;
end $$;
commit;
