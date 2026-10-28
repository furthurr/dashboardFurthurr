-- Privileged connection after 202610260002_delete_inactive_boards.sql. No fixtures persist.
begin;
select set_config('app.board_admin', gen_random_uuid()::text, true);
select set_config('app.board_user', gen_random_uuid()::text, true);
select set_config('app.board_guest', gen_random_uuid()::text, true);
select set_config('app.board_outsider', gen_random_uuid()::text, true);
select set_config('app.board_source', gen_random_uuid()::text, true);
select set_config('app.board_target', gen_random_uuid()::text, true);
select set_config('app.board_private', gen_random_uuid()::text, true);
select set_config('app.board_archived', gen_random_uuid()::text, true);
select set_config('app.board_attachment', gen_random_uuid()::text, true);
select set_config('app.member_attachment', gen_random_uuid()::text, true);
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
insert into public.task_attachments(id, task_id, uploaded_by, file_name, file_url, file_size, mime_type)
values(current_setting('app.board_attachment')::uuid, current_setting('app.board_task')::uuid, auth.uid(), 'probe.txt',
  'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.board_task') || '/probe.txt', 1, 'text/plain');
insert into public.task_attachments(id, task_id, uploaded_by, file_name, file_url, file_size, mime_type)
values(current_setting('app.member_attachment')::uuid, current_setting('app.board_task')::uuid,
  current_setting('app.board_user')::uuid, 'member.txt',
  'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.board_task') || '/member.txt', 1, 'text/plain');
insert into storage.objects(bucket_id, name) values('task-attachments', current_setting('app.board_task') || '/probe.txt');
insert into storage.objects(bucket_id, name) values('task-attachments', current_setting('app.board_task') || '/member.txt');
update public.task_attachments set file_name = 'admin-renamed-member.txt'
  where id = current_setting('app.member_attachment')::uuid;
do $$ begin
  if not exists(select 1 from public.task_attachments where id = current_setting('app.member_attachment')::uuid
    and file_name = 'admin-renamed-member.txt') then
    raise exception 'Admin cannot rename another uploader''s attachment';
  end if;
end $$;
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
  'Archived task', null, 'backlog', 'normal', array[current_setting('app.board_outsider')::uuid])->>'id', true);
insert into public.comments(task_id, author_id, body)
values(current_setting('app.archived_task')::uuid, current_setting('app.board_admin')::uuid, 'Delete with board');
insert into public.task_attachments(task_id, uploaded_by, file_name, file_url, file_size, mime_type)
values(current_setting('app.archived_task')::uuid, current_setting('app.board_admin')::uuid, 'board-delete.txt',
  'https://example.test/storage/v1/object/public/task-attachments/' || current_setting('app.archived_task') || '/board-delete.txt', 1, 'text/plain');
insert into storage.objects(bucket_id, name)
values('task-attachments', current_setting('app.archived_task') || '/board-delete.txt');
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
  begin
    perform public.delete_inactive_board(current_setting('app.board_source')::uuid);
    raise exception 'Active board deletion was accepted';
  exception when object_not_in_prerequisite_state then null; end;
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

-- An assignment grants access to an active board; removing the last assignment revokes it.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_outsider'), 'role', 'authenticated')::text, true);
do $$ begin
  if not public.can_access_board(current_setting('app.board_source')::uuid)
    or not public.can_access_task(current_setting('app.board_task')::uuid)
    or not exists(select 1 from public.boards where id = current_setting('app.board_source')::uuid)
    or not exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid)
    or not exists(select 1 from public.comments where task_id = current_setting('app.board_task')::uuid)
    or not exists(select 1 from public.task_attachments where task_id = current_setting('app.board_task')::uuid)
    or not exists(select 1 from public.tasks_with_stats where id = current_setting('app.board_task')::uuid)
    or not exists(select 1 from public.tasks_with_assignees where id = current_setting('app.board_task')::uuid)
    or not exists(select 1 from storage.objects where name = current_setting('app.board_task') || '/probe.txt') then
    raise exception 'Assigned user cannot read board resources';
  end if;
  if not exists(select 1 from public.list_boards_with_pending_counts() where id = current_setting('app.board_source')::uuid) then
    raise exception 'Assigned user cannot see the board in the catalog';
  end if;
  if (select my_pending_count from public.list_boards_with_pending_counts() where id = current_setting('app.board_source')::uuid) <> 1
    or not (select people @> jsonb_build_array(jsonb_build_object('id', current_setting('app.board_outsider')::uuid))
      from public.list_boards_with_pending_counts() where id = current_setting('app.board_source')::uuid) then
    raise exception 'The assigned user pending count or board people projection is incorrect';
  end if;
  perform public.set_task_assignees(current_setting('app.board_task')::uuid, '{}');
  if public.can_access_board(current_setting('app.board_source')::uuid)
    or public.can_access_task(current_setting('app.board_task')::uuid)
    or exists(select 1 from public.boards where id = current_setting('app.board_source')::uuid)
    or exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid) then
    raise exception 'Removing the final assignment did not revoke access';
  end if;
  begin
    perform public.move_task_to_board(current_setting('app.board_task')::uuid, current_setting('app.board_target')::uuid);
    raise exception 'Nonmember can move task';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_task_assignees_internal(current_setting('app.board_task')::uuid, '{}');
    raise exception 'Internal RPC exposed';
  exception when insufficient_privilege then null; end;
end $$;

-- Restore the fixture assignment for subsequent transfer and revocation probes.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_admin'), 'role', 'authenticated')::text, true);
select public.set_task_assignees(current_setting('app.board_task')::uuid, array[current_setting('app.board_outsider')::uuid]);
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
  update public.task_attachments set file_name = 'member-renamed.txt'
    where id = current_setting('app.member_attachment')::uuid;
  if not found or not exists(select 1 from public.task_attachments where id = current_setting('app.member_attachment')::uuid
    and file_name = 'member-renamed.txt') then
    raise exception 'Uploader cannot rename own attachment';
  end if;
  update public.task_attachments set file_name = 'unauthorized.txt'
    where id = current_setting('app.board_attachment')::uuid;
  if found then raise exception 'Non-uploader and non-creator renamed an attachment'; end if;
  begin
    update public.task_attachments set file_url = 'https://example.test/changed'
      where id = current_setting('app.member_attachment')::uuid;
    raise exception 'Attachment storage path is client-writable';
  exception when insufficient_privilege or invalid_parameter_value then null; end;
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
  begin
    perform public.delete_inactive_board(current_setting('app.board_archived')::uuid);
    raise exception 'Nonadmin deleted a board';
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
    or (select count(*) from public.task_attachments where task_id = current_setting('app.board_task')::uuid) <> 3
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
     or public.can_access_task_object(current_setting('app.board_task') || '/member.txt')
    or exists(select 1 from public.tasks where id = current_setting('app.board_task')::uuid) then
    raise exception 'Membership removal did not revoke access';
  end if;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('app.board_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.delete_inactive_board(current_setting('app.board_archived')::uuid);
  if exists(select 1 from public.boards where id = current_setting('app.board_archived')::uuid)
    or exists(select 1 from public.board_members where board_id = current_setting('app.board_archived')::uuid)
    or exists(select 1 from public.tasks where id = current_setting('app.archived_task')::uuid)
    or exists(select 1 from public.comments where task_id = current_setting('app.archived_task')::uuid)
    or exists(select 1 from public.task_assignees where task_id = current_setting('app.archived_task')::uuid)
    or exists(select 1 from public.task_attachments where task_id = current_setting('app.archived_task')::uuid) then
    raise exception 'Deleting an inactive board did not remove its relational data';
  end if;
end $$;
reset role;
rollback;
select 'PASS: boards, membership, RPC authorization, resources, transfer and revocation' as verification;
