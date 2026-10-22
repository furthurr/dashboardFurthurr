-- Privileged connection after 202610220001_board_access_returning.sql. No fixtures persist.
begin;
select set_config('app.board_admin', gen_random_uuid()::text, true);
select set_config('app.board_user', gen_random_uuid()::text, true);
select set_config('app.board_guest', gen_random_uuid()::text, true);
select set_config('app.board_outsider', gen_random_uuid()::text, true);
select set_config('app.board_source', gen_random_uuid()::text, true);
select set_config('app.board_target', gen_random_uuid()::text, true);
select set_config('app.board_private', gen_random_uuid()::text, true);
select set_config('app.board_archived', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data)
select id, id::text || '@example.test', '{"full_name":"Board probe"}'::jsonb from unnest(array[
  current_setting('app.board_admin')::uuid, current_setting('app.board_user')::uuid,
  current_setting('app.board_guest')::uuid, current_setting('app.board_outsider')::uuid
]) ids(id);
update public.profiles set role = 'admin' where id = current_setting('app.board_admin')::uuid;
update public.profiles set role = 'invitado' where id = current_setting('app.board_guest')::uuid;
insert into public.boards(id, name, is_active) values
  (current_setting('app.board_source')::uuid, 'Probe source ' || current_setting('app.board_source'), true),
  (current_setting('app.board_target')::uuid, 'Probe target ' || current_setting('app.board_target'), true),
  (current_setting('app.board_private')::uuid, 'Probe private ' || current_setting('app.board_private'), true),
  (current_setting('app.board_archived')::uuid, 'Probe archived ' || current_setting('app.board_archived'), false);
insert into public.board_members(board_id, profile_id)
  select board_id, profile_id from unnest(array[current_setting('app.board_source')::uuid, current_setting('app.board_target')::uuid, current_setting('app.board_archived')::uuid]) boards(board_id)
  cross join unnest(array[current_setting('app.board_user')::uuid, current_setting('app.board_guest')::uuid]) profiles(profile_id);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('app.board_task', public.create_task_with_assignees(current_setting('app.board_source')::uuid,
  'Move me', 'Preserved description', 'haciendo', 'alta', array[current_setting('app.board_outsider')::uuid])->>'id', true);
select set_config('app.private_task', public.create_task_with_assignees(current_setting('app.board_private')::uuid,
  'Hidden task', null, 'backlog', 'normal', '{}')->>'id', true);
insert into public.comments(task_id, author_id, body) values(current_setting('app.board_task')::uuid, auth.uid(), 'Preserved comment');
insert into public.task_attachments(task_id, uploaded_by, file_name, file_url, file_size, mime_type)
values(current_setting('app.board_task')::uuid, auth.uid(), 'probe.txt',
  'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.board_task') || '/probe.txt', 1, 'text/plain');
insert into storage.objects(bucket_id, name) values('task-attachments', current_setting('app.board_task') || '/probe.txt');
do $$
declare created_board_id uuid;
begin
  if not public.can_access_board(current_setting('app.board_private')::uuid) then raise exception 'Admin cannot see all boards'; end if;
  insert into public.boards(name) values ('Probe returning ' || gen_random_uuid()::text) returning id into created_board_id;
  if not exists(select 1 from public.boards where id = created_board_id) then
    raise exception 'Admin INSERT RETURNING did not return its newly created board';
  end if;
  perform public.set_board_members(current_setting('app.board_source')::uuid,
    array[current_setting('app.board_user')::uuid, current_setting('app.board_guest')::uuid]);
  begin
    perform public.set_board_members(current_setting('app.board_source')::uuid, array[gen_random_uuid()]);
    raise exception 'Invalid member accepted';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.boards(name) values ('OFFLINE');
    raise exception 'Duplicate board accepted';
  exception when unique_violation then null; end;
end $$;

-- Board lifecycle: the admin sees deactivated boards, renames them and counts
-- their pending tasks; members lose access while the board stays deactivated.
select set_config('app.archived_task', public.create_task_with_assignees(current_setting('app.board_archived')::uuid,
  'Archived task', null, 'backlog', 'normal', '{}')->>'id', true);
do $$
begin
  if (select count(*) from public.list_boards_with_pending_counts() where id = current_setting('app.board_archived')::uuid) <> 1 then
    raise exception 'Admin does not see the deactivated board';
  end if;
  if (select pending_count from public.list_boards_with_pending_counts() where id = current_setting('app.board_archived')::uuid) <> 1 then
    raise exception 'Pending count of a deactivated board is incorrect';
  end if;
  if (select pending_count from public.list_boards_with_pending_counts() where id = current_setting('app.board_source')::uuid) <> 1 then
    raise exception 'Pending count is incorrect';
  end if;
  perform public.rename_board(current_setting('app.board_source')::uuid, 'Probe renamed ' || current_setting('app.board_source'));
  if not exists(select 1 from public.boards where id = current_setting('app.board_source')::uuid
    and name = 'Probe renamed ' || current_setting('app.board_source')) then
    raise exception 'Admin could not rename the board';
  end if;
  begin
    perform public.rename_board(current_setting('app.board_source')::uuid, 'OFFLINE');
    raise exception 'Duplicate board name accepted';
  exception when unique_violation then null; end;
  begin
    perform public.rename_board(current_setting('app.board_source')::uuid, '   ');
    raise exception 'Empty board name accepted';
  exception when invalid_parameter_value then null; end;
  perform public.set_board_active(current_setting('app.board_archived')::uuid, true);
  if not (select is_active from public.boards where id = current_setting('app.board_archived')::uuid) then
    raise exception 'Admin could not reactivate the board';
  end if;
  perform public.set_board_active(current_setting('app.board_archived')::uuid, false);
  if (select is_active from public.boards where id = current_setting('app.board_archived')::uuid) then
    raise exception 'Admin could not deactivate the board';
  end if;
end $$;

-- Simulate a flat-path attachment predating the migration; do not rewrite it.
reset role;
alter table public.task_attachments disable trigger attachment_task_path;
insert into public.task_attachments(task_id, uploaded_by, file_name, file_url, file_size, mime_type)
values(current_setting('app.board_task')::uuid, current_setting('app.board_admin')::uuid, 'legacy.txt',
  'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.board_task') || '-legacy.txt', 1, 'text/plain');
alter table public.task_attachments enable trigger attachment_task_path;
insert into storage.objects(bucket_id, name) values('task-attachments', current_setting('app.board_task') || '-legacy.txt');
set local role authenticated;

-- Assignment alone never grants board/task/file access.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_outsider'), 'role', 'authenticated')::text, true);
do $$ begin
  if exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid)
    or exists(select 1 from public.comments where task_id = current_setting('app.board_task')::uuid)
    or exists(select 1 from public.task_attachments where task_id = current_setting('app.board_task')::uuid)
    or exists(select 1 from public.task_assignees where task_id = current_setting('app.board_task')::uuid)
    or exists(select 1 from public.tasks_with_stats where id = current_setting('app.board_task')::uuid)
    or exists(select 1 from public.tasks_with_assignees where id = current_setting('app.board_task')::uuid)
    or exists(select 1 from storage.objects where name in (current_setting('app.board_task') || '/probe.txt', current_setting('app.board_task') || '-legacy.txt')) then
    raise exception 'Nonmember can read board resources';
  end if;
  begin
    perform public.set_task_assignees(current_setting('app.board_task')::uuid, '{}');
    raise exception 'Nonmember can call assignment RPC';
  exception when insufficient_privilege then null; end;
  begin
    perform public.move_task_to_board(current_setting('app.board_task')::uuid, current_setting('app.board_target')::uuid);
    raise exception 'Nonmember can move task';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_task_assignees_internal(current_setting('app.board_task')::uuid, '{}');
    raise exception 'Internal RPC exposed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_user'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from public.boards where id in (current_setting('app.board_source')::uuid, current_setting('app.board_target')::uuid, current_setting('app.board_private')::uuid)) <> 2 then
    raise exception 'Board visibility incorrect';
  end if;
  begin
    insert into public.boards(name) values('Forbidden board');
    raise exception 'Nonadmin can create board';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_board_members(current_setting('app.board_source')::uuid, '{}');
    raise exception 'Nonadmin can manage members';
  exception when insufficient_privilege then null; end;
  begin
    perform public.move_task_to_board(current_setting('app.board_task')::uuid, current_setting('app.board_private')::uuid);
    raise exception 'Inaccessible destination accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_task_with_assignees(current_setting('app.board_private')::uuid, 'Forbidden task', null, 'backlog', 'normal', '{}');
    raise exception 'Creation in inaccessible board allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.tasks set board_id = current_setting('app.board_target')::uuid where id = current_setting('app.board_task')::uuid;
    raise exception 'Direct board reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.task_attachments(task_id, uploaded_by, file_name, file_url, file_size, mime_type)
    values(current_setting('app.board_task')::uuid, auth.uid(), 'spoof.txt',
      'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.private_task') || '/secret.txt', 1, 'text/plain');
    raise exception 'Cross-task attachment path accepted';
  exception when invalid_parameter_value then null; end;
  if not public.can_access_task_object(current_setting('app.board_task') || '-legacy.txt') then
    raise exception 'Legacy attachment inaccessible to member';
  end if;
  update public.tasks set title = 'Member edit' where id = current_setting('app.board_task')::uuid;
  if not found then raise exception 'Member cannot edit'; end if;
end $$;

-- A deactivated board disappears for its members and only admins can change it.
do $$ begin
  if exists(select 1 from public.list_boards_with_pending_counts() where id = current_setting('app.board_archived')::uuid) then
    raise exception 'Member sees a deactivated board';
  end if;
  if public.can_access_board(current_setting('app.board_archived')::uuid)
    or public.can_access_task(current_setting('app.archived_task')::uuid) then
    raise exception 'Member reaches a deactivated board';
  end if;
  if exists(select 1 from public.tasks where id = current_setting('app.archived_task')::uuid) then
    raise exception 'Member reads tasks of a deactivated board';
  end if;
  begin
    perform public.rename_board(current_setting('app.board_archived')::uuid, 'Renamed by member');
    raise exception 'Member renamed a board';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_board_active(current_setting('app.board_archived')::uuid, true);
    raise exception 'Member activated a board';
  exception when insufficient_privilege then null; end;
end $$;

-- A guest can transfer accessible tasks, retaining all related resources.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_guest'), 'role', 'authenticated')::text, true);
select public.move_task_to_board(current_setting('app.board_task')::uuid, current_setting('app.board_target')::uuid);
do $$ begin
  if not exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid and board_id = current_setting('app.board_target')::uuid
    and status = 'haciendo' and priority = 'alta' and description = 'Preserved description')
    or exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid and board_id = current_setting('app.board_source')::uuid)
    or (select count(*) from public.comments where task_id = current_setting('app.board_task')::uuid) <> 1
    or (select count(*) from public.task_assignees where task_id = current_setting('app.board_task')::uuid) <> 1
    or (select count(*) from public.task_attachments where task_id = current_setting('app.board_task')::uuid) <> 2
    or not public.can_access_task_object(current_setting('app.board_task') || '/probe.txt') then
    raise exception 'Transfer lost data or duplicated task';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_admin'), 'role', 'authenticated')::text, true);
select public.set_board_members(current_setting('app.board_target')::uuid, '{}');
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_guest'), 'role', 'authenticated')::text, true);
do $$ begin
  if public.can_access_task(current_setting('app.board_task')::uuid)
    or public.can_access_task_object(current_setting('app.board_task') || '/probe.txt')
    or public.can_access_task_object(current_setting('app.board_task') || '-legacy.txt')
    or exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid) then
    raise exception 'Membership removal did not revoke access';
  end if;
end $$;
reset role;
rollback;
select 'PASS: boards, membership, RPC authorization, resources, transfer and revocation' as verification;
