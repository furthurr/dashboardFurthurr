-- Apply after 202610200002_shared_task_editing.sql. Never rerun the bootstrap.
begin;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120 and name = btrim(name)),
  created_at timestamptz not null default now()
);
create unique index boards_unique_name on public.boards (lower(name));
create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (board_id, profile_id)
);
create index board_members_profile on public.board_members(profile_id, board_id);
insert into public.boards(name) values ('Offline'), ('General');
insert into public.board_members(board_id, profile_id)
  select b.id, p.id from public.boards b cross join public.profiles p where b.name = 'Offline' and p.is_active;
alter table public.tasks add column board_id uuid references public.boards(id) on delete restrict;
update public.tasks set board_id = (select id from public.boards where name = 'Offline');
alter table public.tasks alter column board_id set not null;
create index tasks_board_status_position on public.tasks(board_id, status, position);

create function public.is_board_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and role = 'admin');
$$;
create function public.can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1 from public.boards b where b.id = p_board_id and (public.is_board_admin() or exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid()
    ))
  );
$$;
create function public.can_access_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tasks where id = p_task_id and public.can_access_board(board_id));
$$;
revoke all on function public.is_board_admin(), public.can_access_board(uuid), public.can_access_task(uuid) from public, anon;
grant execute on function public.is_board_admin(), public.can_access_board(uuid), public.can_access_task(uuid) to authenticated;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
revoke all on public.boards, public.board_members from anon, authenticated;
grant select, insert on public.boards to authenticated;
grant select on public.board_members to authenticated;
create policy "Accessible boards" on public.boards for select to authenticated using (public.can_access_board(id));
create policy "Admins create boards" on public.boards for insert to authenticated with check (public.is_board_admin());
create policy "Admins read memberships" on public.board_members for select to authenticated using (public.is_board_admin());

-- Restrictive policies compose with the existing role/ownership policies.
create policy "Board access required" on public.tasks as restrictive for all to authenticated
  using (public.can_access_board(board_id)) with check (public.can_access_board(board_id));
create policy "Board access required" on public.task_assignees as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "Board access required" on public.comments as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "Board access required" on public.task_attachments as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
-- Creation is transactional through the RPC, never arbitrary client INSERTs.
revoke insert on public.tasks from anon, authenticated;

create function public.set_board_members(p_board_id uuid, p_profile_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if p_profile_ids is null or array_position(p_profile_ids, null) is not null then
    raise exception 'Invalid members' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = any(p_profile_ids) order by id for share;
  if exists(select 1 from unnest(p_profile_ids) ids(id) left join public.profiles p on p.id = ids.id
    where p.id is null or (not p.is_active and not exists(select 1 from public.board_members m where m.board_id = p_board_id and m.profile_id = p.id))) then
    raise exception 'Members must exist and be active' using errcode = '22023';
  end if;
  delete from public.board_members where board_id = p_board_id and not (profile_id = any(p_profile_ids));
  insert into public.board_members(board_id, profile_id) select p_board_id, id from unnest(p_profile_ids) ids(id) on conflict do nothing;
end;
$$;

-- Preserve assignment validation while placing an access guard before the definer function.
alter function public.set_task_assignees(uuid, uuid[]) rename to set_task_assignees_internal;
revoke all on function public.set_task_assignees_internal(uuid, uuid[]) from public, anon, authenticated;
create function public.set_task_assignees(p_task_id uuid, p_assignee_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.tasks where id = p_task_id for update;
  if not public.can_access_task(p_task_id) then raise exception 'Task access denied' using errcode = '42501'; end if;
  return public.set_task_assignees_internal(p_task_id, p_assignee_ids);
end;
$$;

drop function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]);
create function public.create_task_with_assignees(
  p_board_id uuid, p_title text, p_description text, p_status public.task_status,
  p_priority public.task_priority, p_assignee_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_task public.tasks; next_position numeric;
begin
  if not public.can_access_board(p_board_id) or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ) then raise exception 'Not allowed to create tasks' using errcode = '42501'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_board_id::text || ':' || p_status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where board_id = p_board_id and status = p_status;
  insert into public.tasks(board_id, title, description, status, priority, created_by, position)
    values(p_board_id, btrim(p_title), nullif(btrim(p_description), ''), p_status, p_priority, auth.uid(), next_position) returning * into new_task;
  perform public.set_task_assignees(new_task.id, p_assignee_ids);
  return to_jsonb(new_task);
end;
$$;

create function public.move_task_to_board(p_task_id uuid, p_board_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; next_position numeric;
begin
  select * into current_task from public.tasks where id = p_task_id for update;
  if not found or not public.can_access_task(p_task_id) or not public.can_access_board(p_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  if current_task.board_id = p_board_id then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_board_id::text || ':' || current_task.status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where board_id = p_board_id and status = current_task.status;
  update public.tasks set board_id = p_board_id, position = next_position where id = p_task_id;
end;
$$;
revoke all on function public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) from public, anon;
grant execute on function public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) to authenticated;

-- Legacy objects use a flat UUID filename; new uploads use task-id/UUID.ext.
-- Resolve legacy metadata without exposing the file or relying on client-supplied URLs.
create function public.can_access_task_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and (
    exists(select 1 from public.tasks t where t.id::text = split_part(p_name, '/', 1) and public.can_access_board(t.board_id))
    or exists(select 1 from public.task_attachments a where
      right(a.file_url, length('/task-attachments/' || p_name)) = '/task-attachments/' || p_name and public.can_access_task(a.task_id))
  );
$$;
revoke all on function public.can_access_task_object(text) from public, anon;
grant execute on function public.can_access_task_object(text) to authenticated;
create policy "Board storage access" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'task-attachments' or public.can_access_task_object(name))
  with check (bucket_id <> 'task-attachments' or public.can_access_task_object(name));
create policy "Board storage upload role" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'task-attachments' or exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ));
drop policy "Users can delete own attachments" on storage.objects;
create policy "Users can delete own attachments" on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments' and exists (
    select 1 from public.task_attachments a join public.tasks t on t.id = a.task_id
    where right(a.file_url, length('/task-attachments/' || name)) = '/task-attachments/' || name
      and (a.uploaded_by = auth.uid() or t.created_by = auth.uid() or public.is_board_admin())
  )
);
-- Prevent linking someone else's object to an accessible task to bypass storage isolation.
create function public.validate_attachment_path() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.file_url not like '%/task-attachments/' || new.task_id::text || '/%' then
    raise exception 'Attachment path must belong to its task' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger attachment_task_path before insert or update on public.task_attachments
  for each row execute function public.validate_attachment_path();
update storage.buckets set public = false where id = 'task-attachments';
commit;
