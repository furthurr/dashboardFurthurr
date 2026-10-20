-- Privileged connection, after both migrations. Fixtures never persist: ROLLBACK.
begin;
select set_config('app.assignment_admin', gen_random_uuid()::text, true);
select set_config('app.assignment_user', gen_random_uuid()::text, true);
select set_config('app.assignment_guest', gen_random_uuid()::text, true);
select set_config('app.assignment_inactive', gen_random_uuid()::text, true);

insert into auth.users (id, email, raw_user_meta_data)
select id, id::text || '@example.test', '{"full_name":"Transactional assignment probe"}'::jsonb
from unnest(array[
  current_setting('app.assignment_admin')::uuid, current_setting('app.assignment_user')::uuid,
  current_setting('app.assignment_guest')::uuid, current_setting('app.assignment_inactive')::uuid
]) as fixtures(id);
update public.profiles set role = 'admin' where id = current_setting('app.assignment_admin')::uuid;
update public.profiles set role = 'usuario' where id = current_setting('app.assignment_user')::uuid;
update public.profiles set role = 'invitado' where id = current_setting('app.assignment_guest')::uuid;
update public.profiles set is_active = false where id = current_setting('app.assignment_inactive')::uuid;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.assignment_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('app.assignment_task', public.create_task_with_assignees(
  'Assignment transaction probe', 'Keep this description', 'backlog', 'normal',
  array[current_setting('app.assignment_user')::uuid, current_setting('app.assignment_guest')::uuid, current_setting('app.assignment_user')::uuid]
)->>'id', true);
do $$
begin
  if (select count(*) from public.task_assignees where task_id = current_setting('app.assignment_task')::uuid) <> 2 then
    raise exception 'Initial assignees or deduplication failed';
  end if;
end $$;

-- A guest can replace assignments on another account's task but not its fields.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.assignment_guest'), 'role', 'authenticated')::text, true);
do $$
begin
  perform public.set_task_assignees(current_setting('app.assignment_task')::uuid,
    array[current_setting('app.assignment_admin')::uuid, current_setting('app.assignment_user')::uuid]);
  if (select count(*) from public.task_assignees where task_id = current_setting('app.assignment_task')::uuid) <> 2 then
    raise exception 'Guest could not assign on another account task';
  end if;
  update public.tasks set title = 'Forbidden change' where id = current_setting('app.assignment_task')::uuid;
  if found then raise exception 'Assignment permission broadened task editing'; end if;
  begin
    perform public.create_task_with_assignees('Guest creation forbidden', null, 'backlog', 'normal', '{}');
    raise exception 'Guest can create tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.task_assignees(task_id, profile_id)
      values(current_setting('app.assignment_task')::uuid, current_setting('app.assignment_guest')::uuid);
    raise exception 'Direct assignment writes are allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- A regular user can remove every assignee on another account's task.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.assignment_user'), 'role', 'authenticated')::text, true);
do $$
declare
  created_task jsonb;
begin
  created_task := public.create_task_with_assignees('Unassigned task probe', null, 'backlog', 'normal', '{}');
  if (created_task->>'created_by')::uuid <> auth.uid()
    or exists(select 1 from public.task_assignees where task_id = (created_task->>'id')::uuid) then
    raise exception 'Regular user creation without assignees failed';
  end if;
  created_task := public.create_task_with_assignees('Single assignee probe', null, 'backlog', 'normal', array[current_setting('app.assignment_guest')::uuid]);
  if (select count(*) from public.task_assignees where task_id = (created_task->>'id')::uuid) <> 1 then
    raise exception 'Regular user creation with one assignee failed';
  end if;
  perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, '{}');
  if exists (select 1 from public.task_assignees where task_id = current_setting('app.assignment_task')::uuid) then
    raise exception 'Regular user could not remove all assignees';
  end if;
  begin
    perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, array[gen_random_uuid()]);
    raise exception 'Nonexistent assignee accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, array[null::uuid]);
    raise exception 'Null assignee accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_task_assignees(gen_random_uuid(), '{}');
    raise exception 'Nonexistent task accepted';
  exception when no_data_found then null;
  end;
  begin
    perform public.create_task_with_assignees('Atomic failure probe', null, 'backlog', 'normal', array[current_setting('app.assignment_inactive')::uuid]);
    raise exception 'Inactive target accepted during creation';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.tasks where title = 'Atomic failure probe' and created_by = auth.uid()) then
    raise exception 'Failed creation left an orphan task';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.assignment_admin'), 'role', 'authenticated')::text, true);
select public.set_task_assignees(current_setting('app.assignment_task')::uuid, array[current_setting('app.assignment_user')::uuid]);
reset role;
update public.profiles set is_active = false where id = current_setting('app.assignment_user')::uuid;
set local role authenticated;
do $$
begin
  perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, array[current_setting('app.assignment_user')::uuid]);
  if not exists (select 1 from public.task_assignees where task_id = current_setting('app.assignment_task')::uuid) then
    raise exception 'Previously assigned inactive account was not preserved';
  end if;
  perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, '{}');
  begin
    perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, array[current_setting('app.assignment_user')::uuid]);
    raise exception 'Removed inactive target can be assigned again';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from public.task_assignees where task_id = current_setting('app.assignment_task')::uuid) then
    raise exception 'Failed replacement did not roll back';
  end if;
  if not exists (select 1 from public.tasks where id = current_setting('app.assignment_task')::uuid
    and title = 'Assignment transaction probe' and description = 'Keep this description'
    and created_by = current_setting('app.assignment_admin')::uuid) then
    raise exception 'Assignment operation modified task fields';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.assignment_user'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    perform public.set_task_assignees(current_setting('app.assignment_task')::uuid, '{}');
    raise exception 'Inactive actor accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  if has_function_privilege(current_user, 'public.set_task_assignees(uuid,uuid[])', 'EXECUTE') then
    raise exception 'Anonymous caller has assignment permission';
  end if;
end $$;
reset role;
rollback;
select 'PASS: transactional creation, multiple assignments, deduplication, guest/user permissions, inactive targets, atomic failures; fixtures rolled back' as verification;
