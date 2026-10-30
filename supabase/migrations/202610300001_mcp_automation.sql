-- Automation is separately opted into by the portal user and by task editors.
-- These records do not themselves change any task state.
begin;

create table public.mcp_automation_consents (
  consent_id uuid primary key references auth.oauth_consents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  consent_granted_at timestamptz not null,
  granted_at timestamptz not null default now()
);
alter table public.mcp_automation_consents enable row level security;
revoke all on public.mcp_automation_consents from public, anon, authenticated, mcp_identity;

create table public.mcp_task_automation (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  enabled_by uuid not null references public.profiles(id) on delete cascade,
  enabled_at timestamptz not null default now()
);
alter table public.mcp_task_automation enable row level security;
revoke all on public.mcp_task_automation from public, anon, authenticated, mcp_identity;

-- Only the portal identity can explicitly opt an existing OAuth grant in or out.
create function public.mcp_set_automation_consent(p_client_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare consent auth.oauth_consents;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Active portal session required' using errcode = '42501';
  end if;
  if p_client_id is null or p_enabled is null then
    raise exception 'Invalid consent' using errcode = '22023';
  end if;
  select c.* into consent from auth.oauth_consents c
    where c.user_id = auth.uid() and c.client_id = p_client_id and c.revoked_at is null
    for update;
  if consent.id is null then raise exception 'Connection unavailable' using errcode = '42501'; end if;
  if p_enabled then
    if not exists(select 1 from public.mcp_workflow_permissions w
      where w.consent_id = consent.id and w.profile_id = auth.uid() and w.client_id = p_client_id
        and w.consent_granted_at = consent.granted_at
        and w.permissions @> array['read_tasks','start_task','comment_task','review_task']) then
      raise exception 'Workflow permission required' using errcode = '42501';
    end if;
    insert into public.mcp_automation_consents(consent_id, profile_id, client_id, consent_granted_at)
      values(consent.id, auth.uid(), p_client_id, consent.granted_at)
      on conflict(consent_id) do update set profile_id = excluded.profile_id,
        client_id = excluded.client_id, consent_granted_at = excluded.consent_granted_at, granted_at = now();
  else
    delete from public.mcp_automation_consents where consent_id = consent.id and profile_id = auth.uid();
  end if;
end $$;
revoke all on function public.mcp_set_automation_consent(uuid,boolean) from public, anon, mcp_identity;
grant execute on function public.mcp_set_automation_consent(uuid,boolean) to authenticated;

create function public.mcp_set_task_automation(p_task_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare task public.tasks;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Active portal session required' using errcode = '42501';
  end if;
  if p_task_id is null or p_enabled is null then raise exception 'Invalid request' using errcode = '22023'; end if;
  select * into task from public.tasks where id = p_task_id for update;
  if task.id is null or not public.can_access_board(task.board_id) then
    raise exception 'Task unavailable' using errcode = '42501';
  end if;
  if p_enabled then
    insert into public.mcp_task_automation(task_id, enabled_by) values(task.id, auth.uid())
      on conflict(task_id) do update set enabled_by = excluded.enabled_by, enabled_at = now();
  else
    delete from public.mcp_task_automation where task_id = task.id;
  end if;
end $$;
revoke all on function public.mcp_set_task_automation(uuid,boolean) from public, anon, mcp_identity;
grant execute on function public.mcp_set_task_automation(uuid,boolean) to authenticated;

-- Effective consent is bound to the current Auth grant and all workflow permissions.
create function public.mcp_automation_enabled(p_task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.mcp_task_automation where task_id = p_task_id)
    and exists(select 1 from public.mcp_automation_consents a join auth.oauth_consents c on c.id = a.consent_id
      where a.profile_id = auth.uid() and a.client_id = (auth.jwt()->>'client_id')::uuid
        and c.user_id = a.profile_id and c.client_id = a.client_id and c.revoked_at is null
        and c.granted_at = a.consent_granted_at)
    and public.mcp_has_workflow_permission('read_tasks')
    and public.mcp_has_workflow_permission('start_task')
    and public.mcp_has_workflow_permission('comment_task')
    and public.mcp_has_workflow_permission('review_task');
$$;
revoke all on function public.mcp_automation_enabled(uuid) from public, anon, authenticated, mcp_identity;

create function public.mcp_get_task_automation(p_task_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.jwt()->>'role' is distinct from 'authenticated' or coalesce(auth.jwt()->>'client_id','') <> ''
    or not public.is_active_account() or not exists(select 1 from public.tasks t
      where t.id = p_task_id and public.can_access_board(t.board_id)) then
    raise exception 'Task unavailable' using errcode = '42501';
  end if;
  return exists(select 1 from public.mcp_task_automation where task_id = p_task_id);
end $$;
revoke all on function public.mcp_get_task_automation(uuid) from public, anon, mcp_identity;
grant execute on function public.mcp_get_task_automation(uuid) to authenticated;

-- Revocation/renewal invalidates the opt-in, even if workflow is later reauthorized.
create function public.mcp_clear_automation_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'oauth_consents' then
    if new.granted_at is distinct from old.granted_at or new.revoked_at is not null then
      delete from public.mcp_automation_consents where consent_id = new.id;
    end if;
  else
    if new.consent_granted_at is distinct from old.consent_granted_at
      or not new.permissions @> array['read_tasks','start_task','comment_task','review_task'] then
      delete from public.mcp_automation_consents where consent_id = new.consent_id;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.mcp_clear_automation_consent() from public, anon, authenticated, mcp_identity;
create trigger mcp_automation_auth_changed after update on auth.oauth_consents
  for each row execute function public.mcp_clear_automation_consent();
create trigger mcp_automation_workflow_changed after update on public.mcp_workflow_permissions
  for each row execute function public.mcp_clear_automation_consent();

alter function public.mcp_list_workflow_access() rename to mcp_list_workflow_access_base;
revoke all on function public.mcp_list_workflow_access_base() from authenticated;
create function public.mcp_list_workflow_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select coalesce(jsonb_agg(item || jsonb_build_object('automatic_advance', exists(
    select 1 from public.mcp_automation_consents a join auth.oauth_consents c on c.id = a.consent_id
    join public.mcp_workflow_permissions w on w.consent_id = c.id
    where a.profile_id = auth.uid() and a.client_id::text = item->>'client_id'
      and c.user_id = a.profile_id and c.client_id = a.client_id and c.revoked_at is null
      and c.granted_at = a.consent_granted_at and w.consent_granted_at = c.granted_at
      and w.permissions @> array['read_tasks','start_task','comment_task','review_task']))), '[]'::jsonb)
    into result from jsonb_array_elements(public.mcp_list_workflow_access_base()) item;
  return result;
end $$;
revoke all on function public.mcp_list_workflow_access() from public, anon, mcp_identity;
grant execute on function public.mcp_list_workflow_access() to authenticated;

alter function public.mcp_get_task(uuid,integer,integer,integer) rename to mcp_get_task_base;
revoke all on function public.mcp_get_task_base(uuid,integer,integer,integer) from mcp_identity;
create function public.mcp_get_task(p_task_id uuid, p_comments_offset integer default 0,
  p_attachments_offset integer default 0, p_page_size integer default 50) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.mcp_get_task_base(p_task_id,p_comments_offset,p_attachments_offset,p_page_size)
    || jsonb_build_object('automatic_advance',public.mcp_automation_enabled(p_task_id));
$$;
revoke all on function public.mcp_get_task(uuid,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.mcp_get_task(uuid,integer,integer,integer) to mcp_identity;

-- Preserve all workflow controls without synthesizing human approval flags.
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
  -- Same lock order as the existing workflow; the task lock serializes opt-out.
  perform 1 from auth.oauth_consents where user_id = auth.uid() and client_id = client for share;
  perform 1 from public.mcp_workflow_permissions where profile_id = auth.uid() and client_id = client for share;
  perform 1 from auth.sessions where id = (auth.jwt()->>'session_id')::uuid for share;
  perform 1 from public.tasks where id = p_task_id for update;
  perform 1 from public.mcp_automation_consents where profile_id = auth.uid() and client_id = client for share;
  perform 1 from public.task_assignees where task_id = p_task_id and profile_id = auth.uid() for share;
  perform 1 from public.profiles where id = auth.uid() for share;
  perform 1 from public.boards where id = (select board_id from public.tasks where id = p_task_id) for share;
  perform 1 from public.board_members where board_id = (select board_id from public.tasks where id = p_task_id)
    and profile_id = auth.uid() for share;
  if not public.mcp_has_workflow_permission(p_action) then
    raise exception 'Work consent required' using errcode = 'PT403';
  end if;
  task := public.mcp_assert_task_access(p_task_id, false);
  automatic := public.mcp_automation_enabled(p_task_id);
  mode := coalesce(p_payload->>'authorization_mode','human');
  if mode not in ('human','automatic') or jsonb_typeof(p_payload) is distinct from 'object'
    or (mode = 'automatic' and (p_payload ? 'user_approved' or p_payload ? 'user_validated')) then
    raise exception 'Invalid authorization mode' using errcode = '22023';
  end if;
  if mode = 'automatic' and not automatic then
    raise exception 'Both automation authorizations required' using errcode = 'PT403';
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
        then 'automático (dos autorizaciones vigentes; sin aceptación humana adicional)'
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
revoke all on function public.mcp_work_task(uuid,text,uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.mcp_work_task(uuid,text,uuid,timestamptz,jsonb) to mcp_identity;

commit;
