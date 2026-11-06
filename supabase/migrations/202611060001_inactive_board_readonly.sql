-- Read-only inactive boards. Requires the board-delete Edge Function for deletion.
begin;

-- Only the service can prepare/finish a whole-board deletion. No client grants.
create table public.board_deletion_jobs (
  board_id uuid primary key references public.boards(id) on delete cascade,
  paths text[] not null,
  created_at timestamptz not null default now()
);
alter table public.board_deletion_jobs enable row level security;
revoke all on public.board_deletion_jobs from public, anon, authenticated;

create function public.lock_writable_board(p_board_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare writable boolean;
begin
  if not public.can_access_board(p_board_id) then return false; end if;
  select b.is_active into writable from public.boards b where b.id = p_board_id for share;
  return coalesce(writable, false);
end; $$;
create function public.lock_writable_task(p_task_id uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare board uuid;
begin
  select board_id into board from public.tasks where id = p_task_id;
  return board is not null and public.lock_writable_board(board);
end; $$;
create function public.lock_writable_task_object(p_name text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare board uuid;
begin
  -- Resolve both task-prefixed and historical flat object names, without casts.
  for board in
    select t.board_id from public.tasks t where t.id::text = split_part(p_name, '/', 1)
    union
    select t.board_id from public.task_attachments a join public.tasks t on t.id = a.task_id
      where position('/' in p_name) = 0 and split_part(a.file_url, '/task-attachments/', 2) = p_name
  loop
    if not public.lock_writable_board(board) then return false; end if;
  end loop;
  return board is not null;
end; $$;
revoke all on function public.lock_writable_board(uuid), public.lock_writable_task(uuid), public.lock_writable_task_object(text) from public, anon;
grant execute on function public.lock_writable_board(uuid), public.lock_writable_task(uuid), public.lock_writable_task_object(text) to authenticated;

create policy "Active board insert" on public.tasks as restrictive for insert to authenticated with check (public.lock_writable_board(board_id));
create policy "Active board update" on public.tasks as restrictive for update to authenticated using (public.lock_writable_board(board_id)) with check (public.lock_writable_board(board_id));
create policy "Active board delete" on public.tasks as restrictive for delete to authenticated using (public.lock_writable_board(board_id));
do $$ declare resource text; begin
  foreach resource in array array['task_assignees', 'comments', 'task_attachments'] loop
    execute format('create policy "Active board insert" on public.%I as restrictive for insert to authenticated with check (public.lock_writable_task(task_id))', resource);
    execute format('create policy "Active board update" on public.%I as restrictive for update to authenticated using (public.lock_writable_task(task_id)) with check (public.lock_writable_task(task_id))', resource);
    execute format('create policy "Active board delete" on public.%I as restrictive for delete to authenticated using (public.lock_writable_task(task_id))', resource);
  end loop;
end; $$;
create policy "Active board storage insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'task-attachments' or public.lock_writable_task_object(name));
create policy "Active board storage update" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'task-attachments' or public.lock_writable_task_object(name))
  with check (bucket_id <> 'task-attachments' or public.lock_writable_task_object(name));
create policy "Active board storage delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'task-attachments' or public.lock_writable_task_object(name));

-- Definer RPCs bypass RLS. The private originals retain validation/authorization.
alter function public.rename_board(uuid, text) rename to rename_board_writable_internal;
alter function public.set_board_members(uuid, uuid[]) rename to set_board_members_writable_internal;
alter function public.set_task_assignees(uuid, uuid[]) rename to set_task_assignees_writable_internal;
alter function public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]) rename to create_task_writable_internal;
alter function public.move_task_to_board(uuid, uuid) rename to move_task_writable_internal;
revoke all on function public.rename_board_writable_internal(uuid, text), public.set_board_members_writable_internal(uuid, uuid[]), public.set_task_assignees_writable_internal(uuid, uuid[]), public.create_task_writable_internal(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_writable_internal(uuid, uuid) from public, anon, authenticated;

create function public.rename_board(p_board_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_board_id is null or p_name is null then raise exception 'Invalid board' using errcode = '22023'; end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if not public.lock_writable_board(p_board_id) then raise exception 'Board is not writable' using errcode = '55000'; end if;
  perform public.rename_board_writable_internal(p_board_id, p_name);
end; $$;
create function public.set_board_members(p_board_id uuid, p_profile_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if not public.lock_writable_board(p_board_id) then raise exception 'Board is not writable' using errcode = '55000'; end if;
  perform public.set_board_members_writable_internal(p_board_id, p_profile_ids);
end; $$;
create function public.set_task_assignees(p_task_id uuid, p_assignee_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$ begin
  if not public.can_access_task(p_task_id) then raise exception 'Task access denied' using errcode = '42501'; end if;
  if not public.lock_writable_task(p_task_id) then raise exception 'Board is not writable' using errcode = '55000'; end if;
  return public.set_task_assignees_writable_internal(p_task_id, p_assignee_ids);
end; $$;
create function public.create_task_with_assignees(p_board_id uuid, p_title text, p_description text, p_status public.task_status, p_priority public.task_priority, p_assignee_ids uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$ begin
  if not public.can_access_board(p_board_id) then raise exception 'Board access denied' using errcode = '42501'; end if;
  if not public.lock_writable_board(p_board_id) then raise exception 'Board is not writable' using errcode = '55000'; end if;
  return public.create_task_writable_internal(p_board_id, p_title, p_description, p_status, p_priority, p_assignee_ids);
end; $$;
create function public.move_task_to_board(p_task_id uuid, p_board_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not public.can_access_task(p_task_id) or not public.can_access_board(p_board_id) then raise exception 'Board access denied' using errcode = '42501'; end if;
  perform 1 from public.tasks where id = p_task_id for update;
  -- Consistent board lock order avoids opposite transfers deadlocking here.
  perform 1 from public.boards where id in (p_board_id, (select board_id from public.tasks where id = p_task_id)) order by id for share;
  if not public.lock_writable_task(p_task_id) or not public.lock_writable_board(p_board_id) then raise exception 'Board is not writable' using errcode = '55000'; end if;
  perform public.move_task_writable_internal(p_task_id, p_board_id);
end; $$;
revoke all on function public.rename_board(uuid, text), public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]), public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) from public, anon;
grant execute on function public.rename_board(uuid, text), public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]), public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) to authenticated;

-- A failed Storage cleanup must not allow reactivation of a partially deleted board.
create function public.guard_board_reactivation() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if new.is_active and exists(select 1 from public.board_deletion_jobs where board_id = old.id) then
    raise exception 'Board deletion pending; retry deletion' using errcode = '55000';
  end if;
  return new;
end; $$;
revoke all on function public.guard_board_reactivation() from public, anon, authenticated;
create trigger board_deletion_pending before update on public.boards for each row execute function public.guard_board_reactivation();

create function public.prepare_board_deletion(p_board_id uuid, p_actor_id uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare active boolean; object_paths text[];
begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'admin' and is_active) then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  select is_active into active from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if active then raise exception 'Board must be deactivated' using errcode = '55000'; end if;
  select paths into object_paths from public.board_deletion_jobs where board_id = p_board_id;
  if found then return object_paths; end if;
  -- Names are selected from the fixed bucket, never caller-supplied URLs/paths.
  select coalesce(array_agg(o.name order by o.name), '{}'::text[]) into object_paths
  from storage.objects o where o.bucket_id = 'task-attachments' and exists (
    select 1 from public.tasks t where t.board_id = p_board_id and (
      split_part(o.name, '/', 1) = t.id::text or exists (
        select 1 from public.task_attachments a where a.task_id = t.id
          and position('/' in o.name) = 0 and split_part(a.file_url, '/task-attachments/', 2) = o.name
      )
    )
  );
  insert into public.board_deletion_jobs(board_id, paths) values(p_board_id, object_paths);
  return object_paths;
end; $$;
create function public.finish_board_deletion(p_board_id uuid, p_actor_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'admin' and is_active) then
    raise exception 'Admin required' using errcode = '42501';
  end if;
  perform 1 from public.boards where id = p_board_id and not is_active for update;
  if not found then raise exception 'Inactive board required' using errcode = '55000'; end if;
  if not exists(select 1 from public.board_deletion_jobs where board_id = p_board_id) then
    raise exception 'Deletion not prepared' using errcode = '55000';
  end if;
  -- Storage API must remove objects, not SQL DELETE (which leaves physical files).
  if exists(select 1 from storage.objects o join public.board_deletion_jobs j on o.name = any(j.paths)
    where j.board_id = p_board_id and o.bucket_id = 'task-attachments') then
    raise exception 'Storage cleanup incomplete' using errcode = '55000';
  end if;
  delete from public.tasks where board_id = p_board_id;
  delete from public.boards where id = p_board_id;
end; $$;
revoke all on function public.prepare_board_deletion(uuid, uuid), public.finish_board_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_board_deletion(uuid, uuid), public.finish_board_deletion(uuid, uuid) to service_role;
-- Retire the unsafe client-side Storage-first entrypoint; no fallback.
revoke all on function public.delete_inactive_board(uuid) from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
