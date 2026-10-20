begin;

-- All assignment changes go through the transactional functions below.
-- Reads retain existing RLS, including the active-account gate.
revoke insert, update, delete on public.task_assignees from anon, authenticated;

create or replace function public.set_task_assignees(p_task_id uuid, p_assignee_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  requested uuid[];
  result jsonb;
begin
  if auth.uid() is null or not public.is_active_account() then
    raise exception 'An active account is required' using errcode = '42501';
  end if;
  if p_assignee_ids is null or array_position(p_assignee_ids, null) is not null then
    raise exception 'Invalid assignee list' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct id), '{}'::uuid[]) into requested from unnest(p_assignee_ids) as ids(id);
  -- Serialize concurrent replacement of the same task's assignment set.
  perform 1 from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;

  -- Lock targets against concurrent deactivation until this transaction completes.
  perform 1 from public.profiles where id = any(requested) order by id for share;
  if exists (
    select 1 from unnest(requested) as ids(id)
    left join public.profiles p on p.id = ids.id
    where p.id is null or (not p.is_active and not exists (
      select 1 from public.task_assignees ta where ta.task_id = p_task_id and ta.profile_id = ids.id
    ))
  ) then raise exception 'Assignees must exist and be active' using errcode = '22023'; end if;

  delete from public.task_assignees where task_id = p_task_id and not (profile_id = any(requested));
  insert into public.task_assignees (task_id, profile_id)
    select p_task_id, id from unnest(requested) as ids(id) on conflict do nothing;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email,
    'avatar_url', p.avatar_url, 'role', p.role, 'is_active', p.is_active
  ) order by p.full_name, p.id), '[]'::jsonb) into result
  from public.task_assignees ta join public.profiles p on p.id = ta.profile_id where ta.task_id = p_task_id;
  return result;
end;
$$;

create or replace function public.create_task_with_assignees(
  p_title text, p_description text, p_status public.task_status,
  p_priority public.task_priority, p_assignee_ids uuid[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  new_task public.tasks;
  next_position numeric;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ) then raise exception 'Not allowed to create tasks' using errcode = '42501'; end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Title is required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('create-task:' || p_status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where status = p_status;
  insert into public.tasks (title, description, status, priority, created_by, position)
    values (btrim(p_title), nullif(btrim(p_description), ''), p_status, p_priority, auth.uid(), next_position)
    returning * into new_task;
  -- Any validation/assignment failure rolls back the newly inserted task as well.
  perform public.set_task_assignees(new_task.id, p_assignee_ids);
  return to_jsonb(new_task);
end;
$$;

revoke all on function public.set_task_assignees(uuid, uuid[]) from public, anon;
revoke all on function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]) from public, anon;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated;
grant execute on function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]) to authenticated;

commit;
