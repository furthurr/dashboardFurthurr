-- Phase 2: explicit, session-bound read consent; no direct business table grants.
begin;

create table public.mcp_task_read_permissions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  granted_at timestamptz not null default now()
);
alter table public.mcp_task_read_permissions enable row level security;
revoke all on public.mcp_task_read_permissions from public, anon, authenticated, mcp_identity;
create index mcp_task_read_permissions_owner on public.mcp_task_read_permissions(profile_id, client_id);

-- Called by the portal after a separate, explicit confirmation. Permissions bind
-- to current live sessions, never to future connections of the same OAuth client.
create function public.mcp_set_task_read_access(p_client_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  if p_client_id is null or p_enabled is null then
    raise exception 'Invalid consent' using errcode = '22023';
  end if;
  if p_enabled then
    if not exists (select 1 from auth.sessions where user_id = auth.uid()
      and oauth_client_id = p_client_id and (not_after is null or not_after > now())) then
      raise exception 'No live connection' using errcode = '22023';
    end if;
    insert into public.mcp_task_read_permissions(session_id, profile_id, client_id)
      select id, user_id, oauth_client_id from auth.sessions where user_id = auth.uid()
        and oauth_client_id = p_client_id and (not_after is null or not_after > now())
      on conflict(session_id) do update set granted_at = now();
  else
    delete from public.mcp_task_read_permissions where profile_id = auth.uid() and client_id = p_client_id;
  end if;
end $$;
revoke all on function public.mcp_set_task_read_access(uuid, boolean) from public, anon, mcp_identity;
grant execute on function public.mcp_set_task_read_access(uuid, boolean) to authenticated;

create function public.mcp_list_task_read_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(access)), '[]'::jsonb) into result from (
    select s.oauth_client_id as client_id, bool_or(p.session_id is not null) as enabled,
      bool_or(p.session_id is null) as needs_authorization
    from auth.sessions s left join public.mcp_task_read_permissions p
      on p.session_id = s.id and p.profile_id = s.user_id and p.client_id = s.oauth_client_id
    where s.user_id = auth.uid() and s.oauth_client_id is not null and (s.not_after is null or s.not_after > now())
    group by s.oauth_client_id
  ) access;
  return result;
end $$;
revoke all on function public.mcp_list_task_read_access() from public, anon, mcp_identity;
grant execute on function public.mcp_list_task_read_access() to authenticated;

create function public.mcp_get_task(p_task_id uuid, p_comments_offset integer default 0,
  p_attachments_offset integer default 0, p_page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks; result jsonb; comments_total bigint; attachments_total bigint;
begin
  perform public.mcp_whoami();
  if not exists (select 1 from public.mcp_task_read_permissions p
    where p.session_id = (auth.jwt() ->> 'session_id')::uuid and p.profile_id = auth.uid()
      and p.client_id = (auth.jwt() ->> 'client_id')::uuid) then
    raise exception 'Explicit task read consent required' using errcode = 'PT403';
  end if;
  if p_task_id is null or p_comments_offset is null or p_attachments_offset is null or p_page_size is null
    or p_comments_offset < 0 or p_attachments_offset < 0 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Invalid task query' using errcode = '22023';
  end if;
  select * into task from public.tasks t where t.id = p_task_id;
  -- Deliberately require membership for non-admin MCP clients. Portal helpers
  -- may also allow assignment-based board access; that does not widen this grant.
  if task.id is null or not exists (
    select 1 from public.profiles p join public.boards b on b.id = task.board_id
    where p.id = auth.uid() and p.is_active and (p.role = 'admin' or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id
    )))
  ) then
    raise exception 'Task unavailable or inaccessible' using errcode = 'PT404';
  end if;
  select count(*) into comments_total from public.comments where task_id = p_task_id;
  select count(*) into attachments_total from public.task_attachments where task_id = p_task_id;
  select jsonb_build_object(
    'task', jsonb_build_object('id', task.id, 'title', task.title, 'description', task.description,
      'status', task.status, 'priority', task.priority, 'special_notes', task.special_notes,
      'created_at', task.created_at, 'updated_at', task.updated_at),
    'board', (select jsonb_build_object('id', b.id, 'name', b.name) from public.boards b where b.id = task.board_id),
    'assignees', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name, p.id), '[]'::jsonb)
      from public.task_assignees a join public.profiles p on p.id = a.profile_id where a.task_id = p_task_id),
    'comments', jsonb_build_object('total', comments_total, 'offset', p_comments_offset,
      'next_offset', case when p_comments_offset::bigint + p_page_size < comments_total then p_comments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb) from (
        select c.id, c.body, c.created_at, c.updated_at,
          jsonb_build_object('id', p.id, 'full_name', p.full_name) as author
        from public.comments c left join public.profiles p on p.id = c.author_id
        where c.task_id = p_task_id order by c.created_at, c.id limit p_page_size offset p_comments_offset
      ) c)),
    'attachments', jsonb_build_object('total', attachments_total, 'offset', p_attachments_offset,
      'next_offset', case when p_attachments_offset::bigint + p_page_size < attachments_total then p_attachments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb) from (
        select id, file_name, mime_type, file_size, created_at, file_url from public.task_attachments
        where task_id = p_task_id order by created_at, id limit p_page_size offset p_attachments_offset
      ) a))
  ) into result;
  return result;
end $$;
revoke all on function public.mcp_get_task(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.mcp_get_task(uuid, integer, integer, integer) to mcp_identity;

commit;
