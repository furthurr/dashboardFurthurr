-- Joint, explicit consent tied to the actual Auth grant, never to login alone.
begin;

create table public.mcp_workflow_permissions (
  consent_id uuid primary key references auth.oauth_consents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  consent_granted_at timestamptz not null,
  permissions text[] not null check (permissions <@ array['read_tasks','read_attachments','start_task','comment_task','review_task']::text[]),
  granted_at timestamptz not null default now()
);
alter table public.mcp_workflow_permissions enable row level security;
revoke all on public.mcp_workflow_permissions from public, anon, authenticated, mcp_identity;

create function public.mcp_authorize_workflow(p_authorization_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare consent auth.oauth_consents;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  -- Called only after Auth approves the displayed request, before redirect/code exchange.
  select c.* into consent from auth.oauth_authorizations a join auth.oauth_consents c
    on c.client_id = a.client_id and c.user_id = a.user_id
    where a.authorization_id = p_authorization_id and a.user_id = auth.uid()
      and a.status = 'approved' and a.expires_at > now() and c.revoked_at is null
    for share of c;
  if consent.id is null then
    raise exception 'Approved authorization required' using errcode = '42501';
  end if;
  insert into public.mcp_workflow_permissions(consent_id, profile_id, client_id, consent_granted_at, permissions)
    values(consent.id, auth.uid(), consent.client_id, consent.granted_at,
      array['read_tasks','read_attachments','start_task','comment_task','review_task'])
    on conflict(consent_id) do update set consent_granted_at = excluded.consent_granted_at,
      permissions = excluded.permissions, granted_at = now();
end $$;
revoke all on function public.mcp_authorize_workflow(text) from public, anon, mcp_identity;
grant execute on function public.mcp_authorize_workflow(text) to authenticated;

-- Auth can auto-approve an old identity consent. Return only display metadata,
-- never its authorization code, so expanded application consent is still explicit.
create function public.mcp_workflow_authorization_details(p_authorization_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  select jsonb_build_object('details', jsonb_build_object('authorization_id', a.authorization_id,
    'client', jsonb_build_object('id', c.id, 'name', coalesce(c.client_name, '')),
    'user', jsonb_build_object('id', p.id, 'email', p.email), 'redirect_uri', a.redirect_uri, 'scope', a.scope),
    'authorized', exists(select 1 from public.mcp_workflow_permissions w join auth.oauth_consents consent
      on consent.id = w.consent_id and consent.granted_at = w.consent_granted_at and consent.revoked_at is null
      where w.profile_id = p.id and w.client_id = c.id and consent.user_id = p.id and consent.client_id = c.id
        and w.permissions @> array['read_tasks','read_attachments','start_task','comment_task','review_task']))
    into result from auth.oauth_authorizations a join auth.oauth_clients c on c.id = a.client_id
      join public.profiles p on p.id = a.user_id
    where a.authorization_id = p_authorization_id and a.user_id = auth.uid()
      and a.status = 'approved' and a.expires_at > now();
  if result is null then raise exception 'Authorization unavailable' using errcode = '42501'; end if;
  return result;
end $$;
revoke all on function public.mcp_workflow_authorization_details(text) from public, anon, mcp_identity;
grant execute on function public.mcp_workflow_authorization_details(text) to authenticated;

create function public.mcp_list_workflow_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('client_id', c.client_id,
    'permissions', (select coalesce(array_agg(distinct permission), '{}'::text[]) from unnest(coalesce(p.permissions, '{}'::text[]) ||
      case when exists(select 1 from public.mcp_task_read_permissions r join auth.sessions s on s.id = r.session_id
        where r.profile_id = c.user_id and r.client_id = c.client_id and (s.not_after is null or s.not_after > now()))
        then array['read_tasks','read_attachments'] else '{}'::text[] end) permission))), '[]'::jsonb)
    from auth.oauth_consents c left join public.mcp_workflow_permissions p
      on p.consent_id = c.id and p.consent_granted_at = c.granted_at
        and p.profile_id = c.user_id and p.client_id = c.client_id
    where c.user_id = auth.uid() and c.revoked_at is null);
end $$;
revoke all on function public.mcp_list_workflow_access() from public, anon, mcp_identity;
grant execute on function public.mcp_list_workflow_access() to authenticated;

create function public.mcp_revoke_workflow_permission(p_client_id uuid, p_permission text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  if p_permission is null or p_permission not in ('read_tasks','read_attachments','start_task','comment_task','review_task','all') then
    raise exception 'Invalid permission' using errcode = '22023';
  end if;
  update public.mcp_workflow_permissions set permissions = case when p_permission = 'all' then '{}'::text[]
    else array_remove(permissions, p_permission) end
    where profile_id = auth.uid() and client_id = p_client_id;
  -- Retiring read also retires the legacy session-bound read grant.
  if p_permission in ('read_tasks', 'read_attachments', 'all') then
    delete from public.mcp_task_read_permissions where profile_id = auth.uid() and client_id = p_client_id;
  end if;
end $$;
revoke all on function public.mcp_revoke_workflow_permission(uuid, text) from public, anon, mcp_identity;
grant execute on function public.mcp_revoke_workflow_permission(uuid, text) to authenticated;

-- Internal helpers have no public/MCP grants. All entry points recheck live identity.
create function public.mcp_has_workflow_permission(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mcp_workflow_permissions p join auth.oauth_consents c on c.id = p.consent_id
    where p.profile_id = auth.uid() and p.client_id = (auth.jwt() ->> 'client_id')::uuid
      and c.user_id = p.profile_id and c.client_id = p.client_id and c.revoked_at is null
      and c.granted_at = p.consent_granted_at and p_permission = any(p.permissions))
    or (p_permission in ('read_tasks','read_attachments') and exists (
      select 1 from public.mcp_task_read_permissions p where p.session_id = (auth.jwt() ->> 'session_id')::uuid
        and p.profile_id = auth.uid() and p.client_id = (auth.jwt() ->> 'client_id')::uuid));
$$;
revoke all on function public.mcp_has_workflow_permission(text) from public, anon, authenticated, mcp_identity;

create function public.mcp_assert_task_access(p_task_id uuid, p_check_status boolean default true) returns public.tasks
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks;
begin
  perform public.mcp_whoami();
  if not public.mcp_has_workflow_permission('read_tasks') then
    raise exception 'Read consent required' using errcode = 'PT403';
  end if;
  select * into task from public.tasks where id = p_task_id;
  if task.id is null or not exists (select 1 from public.profiles p join public.boards b on b.id = task.board_id
    where p.id = auth.uid() and p.is_active and (p.role = 'admin' or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id)))) then
    raise exception 'Task unavailable' using errcode = 'PT404';
  end if;
  if not exists(select 1 from public.task_assignees where task_id = task.id and profile_id = auth.uid()) then
    raise exception 'Assignment required' using errcode = 'PT412';
  end if;
  if p_check_status and task.status not in ('backlog','por_hacer','haciendo') then
    raise exception 'Move manually to haciendo' using errcode = 'PT409';
  end if;
  return task;
end $$;
revoke all on function public.mcp_assert_task_access(uuid, boolean) from public, anon, authenticated, mcp_identity;

create or replace function public.mcp_get_task(p_task_id uuid, p_comments_offset integer default 0,
  p_attachments_offset integer default 0, p_page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks; comments_total bigint; attachments_total bigint;
begin
  task := public.mcp_assert_task_access(p_task_id);
  if p_task_id is null or p_comments_offset is null or p_attachments_offset is null or p_page_size is null
    or p_comments_offset < 0 or p_attachments_offset < 0 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Invalid query' using errcode = '22023';
  end if;
  select count(*) into comments_total from public.comments where task_id = p_task_id;
  select count(*) into attachments_total from public.task_attachments where task_id = p_task_id;
  return jsonb_build_object(
    'task', jsonb_build_object('id', task.id, 'title', task.title, 'description', task.description,
      'status', task.status, 'priority', task.priority, 'special_notes', task.special_notes,
      'created_at', task.created_at, 'updated_at', task.updated_at),
    'board', (select jsonb_build_object('id', b.id, 'name', b.name) from public.boards b where b.id = task.board_id),
    'assignees', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name, p.id), '[]'::jsonb)
      from public.task_assignees a join public.profiles p on p.id = a.profile_id where a.task_id = p_task_id),
    'comments', jsonb_build_object('total', comments_total, 'offset', p_comments_offset,
      'next_offset', case when p_comments_offset::bigint + p_page_size < comments_total then p_comments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb) from (
        select c.id, c.body, c.created_at, c.updated_at, jsonb_build_object('id', p.id, 'full_name', p.full_name) as author
        from public.comments c left join public.profiles p on p.id = c.author_id
        where c.task_id = p_task_id order by c.created_at, c.id limit p_page_size offset p_comments_offset) c)),
    'attachments', jsonb_build_object('total', attachments_total, 'offset', p_attachments_offset,
      'next_offset', case when p_attachments_offset::bigint + p_page_size < attachments_total then p_attachments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb) from (
        select id, file_name, mime_type, file_size, created_at,
          case when public.mcp_has_workflow_permission('read_attachments') then file_url else '' end as file_url
        from public.task_attachments where task_id = p_task_id order by created_at, id limit p_page_size offset p_attachments_offset) a)));
end $$;

create function public.mcp_get_attachment(p_task_id uuid, p_attachment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.mcp_assert_task_access(p_task_id);
  if not public.mcp_has_workflow_permission('read_attachments') then
    raise exception 'Attachment consent required' using errcode = 'PT403';
  end if;
  select to_jsonb(a) - 'uploaded_by' into result from public.task_attachments a
    where a.id = p_attachment_id and a.task_id = p_task_id;
  if result is null then raise exception 'Attachment unavailable' using errcode = 'PT404'; end if;
  return result;
end $$;
revoke all on function public.mcp_get_attachment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_get_attachment(uuid, uuid) to mcp_identity;

create table public.mcp_task_operations (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  request_id uuid not null,
  action text not null check (action in ('start_task','comment_task','review_task')),
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(task_id, profile_id, client_id, request_id)
);
alter table public.mcp_task_operations enable row level security;
revoke all on public.mcp_task_operations from public, anon, authenticated, mcp_identity;

create function public.mcp_work_task(p_task_id uuid, p_action text, p_request_id uuid,
  p_expected_updated_at timestamptz, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare task public.tasks; previous public.mcp_task_operations; result jsonb; comment_id uuid;
  client uuid := (auth.jwt() ->> 'client_id')::uuid; client_name text; field text;
begin
  perform public.mcp_whoami();
  if p_action is null or p_action not in ('start_task','comment_task','review_task') or p_request_id is null
    or p_expected_updated_at is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 80000 then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  -- Serialize against Auth grant/session revocation as well as permission withdrawal.
  perform 1 from auth.oauth_consents where user_id = auth.uid() and client_id = client for share;
  perform 1 from public.mcp_workflow_permissions where profile_id = auth.uid() and client_id = client for share;
  perform 1 from auth.sessions where id = (auth.jwt() ->> 'session_id')::uuid for share;
  if not public.mcp_has_workflow_permission(p_action) then
    raise exception 'Work consent required' using errcode = 'PT403';
  end if;
  perform 1 from public.tasks where id = p_task_id for update;
  perform 1 from public.task_assignees where task_id = p_task_id and profile_id = auth.uid() for share;
  perform 1 from public.profiles where id = auth.uid() for share;
  perform 1 from public.boards where id = (select board_id from public.tasks where id = p_task_id) for share;
  perform 1 from public.board_members where board_id = (select board_id from public.tasks where id = p_task_id)
    and profile_id = auth.uid() for share;
  task := public.mcp_assert_task_access(p_task_id, false);
  select * into previous from public.mcp_task_operations where task_id = p_task_id and profile_id = auth.uid()
    and client_id = client and request_id = p_request_id;
  if previous.task_id is not null then
    if previous.action <> p_action or previous.payload <> p_payload then
      raise exception 'Request ID reused' using errcode = 'PT422';
    end if;
    -- Minimal receipt only; never return a task projection in a blocked stage.
    return jsonb_build_object('request_id', p_request_id, 'replayed', true) ||
      case when task.status in ('backlog','por_hacer','haciendo') then jsonb_build_object('comment_id', previous.result -> 'comment_id') else '{}'::jsonb end;
  end if;
  if task.status not in ('backlog','por_hacer','haciendo') then
    raise exception 'Move manually to haciendo' using errcode = 'PT409';
  end if;
  if task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task changed; reload' using errcode = 'PT428';
  end if;
  if p_action = 'start_task' then
    if p_payload -> 'user_approved' is distinct from 'true'::jsonb
      or jsonb_typeof(p_payload -> 'context_summary') is distinct from 'string'
      or length(p_payload ->> 'context_summary') > 12000 or nullif(btrim(p_payload ->> 'context_summary'), '') is null then
      raise exception 'User approval and context required' using errcode = '22023';
    end if;
    if task.status <> 'haciendo' then
      update public.tasks set status = 'haciendo' where id = task.id returning * into task;
    end if;
  elsif p_action = 'comment_task' then
    if task.status <> 'haciendo' then raise exception 'Start first' using errcode = 'PT409'; end if;
    foreach field in array array['summary','changes','clarifications','validation','observations'] loop
      if jsonb_typeof(p_payload -> field) is distinct from 'string' or length(p_payload ->> field) > 12000
        or nullif(btrim(p_payload ->> field), '') is null then
        raise exception 'Detailed result required' using errcode = '22023';
      end if;
    end loop;
    select c.client_name into client_name from auth.oauth_clients c where c.id = client;
    insert into public.comments(task_id, author_id, body) values(task.id, auth.uid(),
      'Trabajo realizado mediante MCP' || E'\nCliente registrado (nombre no verificado): ' || coalesce(client_name, 'Sin nombre') ||
      ' [' || client::text || ']' || E'\nIntervención: ' || p_request_id::text ||
      E'\n\nResumen\n' || (p_payload ->> 'summary') || E'\n\nCambios realizados\n' || (p_payload ->> 'changes') ||
      E'\n\nAclaraciones y decisiones con el usuario\n' || (p_payload ->> 'clarifications') ||
      E'\n\nValidaciones y resultados\n' || (p_payload ->> 'validation') ||
      E'\n\nObservaciones, límites y pendientes\n' || (p_payload ->> 'observations')) returning id into comment_id;
  else
    if task.status <> 'haciendo' or p_payload -> 'user_validated' is distinct from 'true'::jsonb
      or not exists (select 1 from public.mcp_task_operations o join public.comments c
        on c.id::text = o.result ->> 'comment_id' and c.task_id = task.id
        where o.task_id = task.id and o.profile_id = auth.uid() and o.client_id = client
          and o.action = 'comment_task' and o.result ->> 'comment_id' = p_payload ->> 'comment_id'
          and (o.result ->> 'updated_at')::timestamptz = task.updated_at) then
      raise exception 'User validation and current result comment required' using errcode = '22023';
    end if;
    update public.tasks set status = 'en_revision' where id = task.id returning * into task;
  end if;
  result := jsonb_build_object('request_id', p_request_id, 'task_id', task.id, 'status', task.status,
    'updated_at', task.updated_at, 'comment_id', comment_id, 'replayed', false);
  insert into public.mcp_task_operations(task_id, profile_id, client_id, request_id, action, payload, result)
    values(task.id, auth.uid(), client, p_request_id, p_action, p_payload, result);
  return result;
end $$;
revoke all on function public.mcp_work_task(uuid, text, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_work_task(uuid, text, uuid, timestamptz, jsonb) to mcp_identity;

commit;
