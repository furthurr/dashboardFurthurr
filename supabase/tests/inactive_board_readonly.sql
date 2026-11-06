-- Disposable fixtures; privileged connection. Storage API is simulated by SQL.
begin;
select set_config('test.admin', gen_random_uuid()::text, true);
select set_config('test.user', gen_random_uuid()::text, true);
select set_config('test.board', gen_random_uuid()::text, true);
select set_config('test.other', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data)
  select id, id::text || '@example.test', '{"full_name":"Readonly probe"}' from unnest(array[current_setting('test.admin')::uuid, current_setting('test.user')::uuid]) u(id);
update public.profiles set role = 'admin' where id = current_setting('test.admin')::uuid;
insert into public.boards(id,name) values(current_setting('test.board')::uuid, current_setting('test.board')), (current_setting('test.other')::uuid, current_setting('test.other'));
select set_config('request.jwt.claims', json_build_object('sub',current_setting('test.admin'),'role','authenticated')::text,true);
set local role authenticated;
select set_config('test.task', public.create_task_with_assignees(current_setting('test.board')::uuid,'Read only',null,'backlog','normal',array[current_setting('test.user')::uuid])->>'id',true);
select set_config('test.other_task', public.create_task_with_assignees(current_setting('test.other')::uuid,'Writable',null,'backlog','normal','{}')->>'id',true);
insert into public.comments(task_id,author_id,body) values(current_setting('test.task')::uuid,auth.uid(),'Preserve');
insert into public.task_attachments(task_id,uploaded_by,file_name,file_url,file_size,mime_type) values(current_setting('test.task')::uuid,auth.uid(),'file.txt','https://example.test/task-attachments/'||current_setting('test.task')||'/file.txt',1,'text/plain');
insert into storage.objects(bucket_id,name) values('task-attachments',current_setting('test.task')||'/file.txt');
insert into storage.objects(bucket_id,name) values('task-attachments',current_setting('test.task')||'/orphan.txt');
insert into storage.objects(bucket_id,name) values('task-attachments',current_setting('test.other_task')||'/protected.txt');
-- A nested bucket marker must never turn a malformed reference into a path on
-- another task. The legacy validator accepts this shape; the manifest must not.
insert into public.task_attachments(task_id,uploaded_by,file_name,file_url,file_size,mime_type) values(current_setting('test.task')::uuid,auth.uid(),'spoof.txt','https://example.test/task-attachments/'||current_setting('test.task')||'/nested/task-attachments/'||current_setting('test.other_task')||'/protected.txt',1,'text/plain');
reset role;
alter table public.task_attachments disable trigger attachment_task_path;
insert into public.task_attachments(task_id,uploaded_by,file_name,file_url,file_size,mime_type) values(current_setting('test.task')::uuid,current_setting('test.admin')::uuid,'legacy.txt','https://example.test/task-attachments/'||current_setting('test.task')||'-legacy.txt',1,'text/plain');
alter table public.task_attachments enable trigger attachment_task_path;
insert into storage.objects(bucket_id,name) values('task-attachments',current_setting('test.task')||'-legacy.txt');
set local role authenticated;
select public.set_board_active(current_setting('test.board')::uuid,false);
do $$ begin
  if not exists(select 1 from public.tasks where id=current_setting('test.task')::uuid)
    or not exists(select 1 from public.comments where task_id=current_setting('test.task')::uuid)
    or not exists(select 1 from public.task_attachments where task_id=current_setting('test.task')::uuid)
    or not exists(select 1 from storage.objects where name=current_setting('test.task')||'/file.txt') then raise exception 'Read access lost'; end if;
  begin perform public.create_task_with_assignees(current_setting('test.board')::uuid,'Forbidden',null,'backlog','normal','{}'); raise exception 'Creation accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.rename_board(current_setting('test.board')::uuid,'Forbidden'); raise exception 'Rename accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.set_board_members(current_setting('test.board')::uuid,'{}'); raise exception 'Empty membership update accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.set_task_assignees(current_setting('test.task')::uuid,'{}'); raise exception 'Empty assignments accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.move_task_to_board(current_setting('test.task')::uuid,current_setting('test.other')::uuid); raise exception 'Transfer from inactive accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.move_task_to_board(current_setting('test.other_task')::uuid,current_setting('test.board')::uuid); raise exception 'Transfer to inactive accepted'; exception when object_not_in_prerequisite_state then null; end;
  update public.tasks set title='Forbidden' where id=current_setting('test.task')::uuid; if found then raise exception 'Update accepted'; end if;
  delete from public.tasks where id=current_setting('test.task')::uuid; if found then raise exception 'Task delete accepted'; end if;
  update public.comments set body='Forbidden' where task_id=current_setting('test.task')::uuid; if found then raise exception 'Comment update accepted'; end if;
  delete from public.comments where task_id=current_setting('test.task')::uuid; if found then raise exception 'Comment delete accepted'; end if;
  update public.task_attachments set file_name='Forbidden' where task_id=current_setting('test.task')::uuid; if found then raise exception 'Attachment update accepted'; end if;
  delete from public.task_attachments where task_id=current_setting('test.task')::uuid; if found then raise exception 'Attachment delete accepted'; end if;
  begin delete from public.task_assignees where task_id=current_setting('test.task')::uuid; if found then raise exception 'Assignment delete accepted'; end if; exception when insufficient_privilege then null; end;
  delete from storage.objects where name=current_setting('test.task')||'/file.txt'; if found then raise exception 'Storage delete accepted'; end if;
  delete from storage.objects where name=current_setting('test.task')||'-legacy.txt'; if found then raise exception 'Legacy Storage delete accepted'; end if;
  update storage.objects set name=current_setting('test.task')||'/renamed.txt' where name=current_setting('test.task')||'/file.txt'; if found then raise exception 'Storage update accepted'; end if;
  begin insert into public.comments(task_id,author_id,body) values(current_setting('test.task')::uuid,auth.uid(),'Forbidden'); raise exception 'Comment insert accepted'; exception when insufficient_privilege then null; end;
  begin insert into public.task_attachments(task_id,uploaded_by,file_name,file_url,file_size,mime_type) values(current_setting('test.task')::uuid,auth.uid(),'new.txt','https://example.test/task-attachments/'||current_setting('test.task')||'/new.txt',1,'text/plain'); raise exception 'Attachment insert accepted'; exception when insufficient_privilege then null; end;
  begin insert into storage.objects(bucket_id,name) values('task-attachments',current_setting('test.task')||'/new.txt'); raise exception 'Storage insert accepted'; exception when insufficient_privilege then null; end;
  begin perform public.delete_inactive_board(current_setting('test.board')::uuid); raise exception 'Old client deletion exposed'; exception when insufficient_privilege then null; end;
  begin perform public.prepare_board_deletion(current_setting('test.board')::uuid,auth.uid()); raise exception 'Service RPC exposed'; exception when insufficient_privilege then null; end;
  begin perform public.create_task_writable_internal(current_setting('test.board')::uuid,'Bypass',null,'backlog','normal','{}'); raise exception 'Private RPC exposed'; exception when insufficient_privilege then null; end;
  perform public.set_board_active(current_setting('test.board')::uuid,true);
  update public.tasks set title='Reactivated' where id=current_setting('test.task')::uuid; if not found then raise exception 'Reactivation did not restore writes'; end if;
  perform public.set_board_active(current_setting('test.board')::uuid,false);
end $$;
reset role;
do $$ declare paths text[]; begin
  begin perform public.prepare_board_deletion(current_setting('test.other')::uuid,current_setting('test.admin')::uuid); raise exception 'Active deletion accepted'; exception when object_not_in_prerequisite_state then null; end;
  begin perform public.prepare_board_deletion(current_setting('test.board')::uuid,current_setting('test.user')::uuid); raise exception 'Nonadmin deletion accepted'; exception when insufficient_privilege then null; end;
  paths := public.prepare_board_deletion(current_setting('test.board')::uuid,current_setting('test.admin')::uuid);
  if cardinality(paths) <> 3 or not paths @> array[current_setting('test.task')||'/file.txt',current_setting('test.task')||'/orphan.txt',current_setting('test.task')||'-legacy.txt'] then raise exception 'Wrong manifest'; end if;
  if paths <> public.prepare_board_deletion(current_setting('test.board')::uuid,current_setting('test.admin')::uuid) then raise exception 'Retry manifest changed'; end if;
  begin perform public.finish_board_deletion(current_setting('test.board')::uuid,current_setting('test.admin')::uuid); raise exception 'Finished before Storage cleanup'; exception when object_not_in_prerequisite_state then null; end;
end $$;
set local role authenticated;
do $$ begin
  begin perform public.set_board_active(current_setting('test.board')::uuid,true); raise exception 'Pending board reactivated'; exception when object_not_in_prerequisite_state then null; end;
end $$;
reset role;
-- Simulates successful server Storage API cleanup, not a production SQL operation.
delete from storage.objects where bucket_id='task-attachments' and name=any((select paths from public.board_deletion_jobs where board_id=current_setting('test.board')::uuid)::text[]);
select public.finish_board_deletion(current_setting('test.board')::uuid,current_setting('test.admin')::uuid);
do $$ begin
  if exists(select 1 from public.boards where id=current_setting('test.board')::uuid)
    or exists(select 1 from public.tasks where id=current_setting('test.task')::uuid)
    or exists(select 1 from public.comments where task_id=current_setting('test.task')::uuid)
    or exists(select 1 from public.task_assignees where task_id=current_setting('test.task')::uuid)
    or exists(select 1 from public.task_attachments where task_id=current_setting('test.task')::uuid)
    or exists(select 1 from public.board_deletion_jobs where board_id=current_setting('test.board')::uuid) then raise exception 'Deletion left relational data'; end if;
  if not exists(select 1 from public.tasks where id=current_setting('test.other_task')::uuid) then raise exception 'Other board affected'; end if;
  if not exists(select 1 from storage.objects where name=current_setting('test.other_task')||'/protected.txt') then raise exception 'Other board Storage affected'; end if;
end $$;
rollback;
select 'PASS: inactive board readonly, RPC guards, Storage and retryable whole-board deletion' as verification;
