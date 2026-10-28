-- Focused regression for 202610280001; compatible with the lifecycle baseline.
-- Run with a privileged connection. All fixtures are rolled back.
begin;
select set_config('app.probe_user', gen_random_uuid()::text, true);
select set_config('app.probe_board', gen_random_uuid()::text, true);
select set_config('app.probe_task', gen_random_uuid()::text, true);
select set_config('app.probe_done', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data)
values(current_setting('app.probe_user')::uuid, current_setting('app.probe_user') || '@example.test', '{"full_name":"Assignment probe"}');
insert into public.boards(id, name)
values(current_setting('app.probe_board')::uuid, 'Assignment probe ' || current_setting('app.probe_board'));
insert into public.tasks(id, board_id, title, status, priority, created_by, position) values
 (current_setting('app.probe_task')::uuid, current_setting('app.probe_board')::uuid, 'Pending probe', 'haciendo', 'normal', current_setting('app.probe_user')::uuid, 0),
 (current_setting('app.probe_done')::uuid, current_setting('app.probe_board')::uuid, 'Completed probe', 'finalizadas', 'normal', current_setting('app.probe_user')::uuid, 1);
insert into public.task_assignees(task_id, profile_id) values
 (current_setting('app.probe_task')::uuid, current_setting('app.probe_user')::uuid),
 (current_setting('app.probe_done')::uuid, current_setting('app.probe_user')::uuid);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.probe_user'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not exists(select 1 from public.boards where id = current_setting('app.probe_board')::uuid)
    or not exists(select 1 from public.tasks where id = current_setting('app.probe_task')::uuid) then
    raise exception 'Assignment did not grant board/task access';
  end if;
  if not exists(select 1 from public.list_boards_with_pending_counts()
    where id = current_setting('app.probe_board')::uuid and pending_count = 1 and my_pending_count = 1
      and jsonb_array_length(people) = 1) then
    raise exception 'Counts or deduplicated people projection incorrect';
  end if;
  perform public.set_task_assignees(current_setting('app.probe_task')::uuid, '{}');
  if not public.can_access_board(current_setting('app.probe_board')::uuid)
    or not exists(select 1 from public.list_boards_with_pending_counts()
      where id = current_setting('app.probe_board')::uuid and my_pending_count = 0) then
    raise exception 'Completed assignment must retain access but not count as pending';
  end if;
end $$;
reset role;
update public.boards set is_active = false where id = current_setting('app.probe_board')::uuid;
set local role authenticated;
do $$ begin
  if public.can_access_board(current_setting('app.probe_board')::uuid)
    or exists(select 1 from public.boards where id = current_setting('app.probe_board')::uuid)
    or exists(select 1 from public.list_boards_with_pending_counts() where id = current_setting('app.probe_board')::uuid) then
    raise exception 'Assignment exposed inactive board';
  end if;
end $$;
reset role;
update public.boards set is_active = true where id = current_setting('app.probe_board')::uuid;
set local role authenticated;
select public.set_task_assignees(current_setting('app.probe_done')::uuid, '{}');
do $$ begin
  if public.can_access_board(current_setting('app.probe_board')::uuid)
    or exists(select 1 from public.tasks where id = current_setting('app.probe_task')::uuid)
    or exists(select 1 from public.list_boards_with_pending_counts() where id = current_setting('app.probe_board')::uuid) then
    raise exception 'Final assignment removal did not revoke access';
  end if;
end $$;
reset role;
rollback;
select 'PASS: assignment access, pending counts, people deduplication, inactive board and final removal' as verification;
