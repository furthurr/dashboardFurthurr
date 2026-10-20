-- Run after the migration with a privileged SQL connection.
-- All probes, including temporary deactivation, are isolated and rolled back.
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id from public.profiles where role = 'admin' and is_active order by id limit 1),
  'role', 'authenticated'
)::text, true);
select set_config('app.access_probe_id', gen_random_uuid()::text, true);

set local role authenticated;
do $$
begin
  if not public.is_active_account() then raise exception 'An active admin is required for this probe'; end if;
  if has_column_privilege(current_user, 'public.profiles', 'role', 'UPDATE')
    or has_column_privilege(current_user, 'public.profiles', 'is_active', 'UPDATE') then
    raise exception 'Client can modify protected profile columns';
  end if;
  insert into public.tasks (id, title, created_by)
    values (current_setting('app.access_probe_id')::uuid, 'Transactional access probe', auth.uid());
  if not exists (select 1 from public.tasks where id = current_setting('app.access_probe_id')::uuid) then
    raise exception 'Active account cannot read its task';
  end if;
  perform 1 from public.profiles;
end $$;

reset role;
update public.profiles set is_active = false where id = auth.uid();
set local role authenticated;
do $$
begin
  if public.is_active_account() then raise exception 'Inactive account is still active'; end if;
  if exists (select 1 from public.tasks)
    or exists (select 1 from public.tasks_with_assignees)
    or exists (select 1 from public.tasks_with_stats)
    or exists (select 1 from public.comments)
    or exists (select 1 from public.task_assignees)
    or exists (select 1 from public.task_attachments)
    or exists (select 1 from storage.objects where bucket_id = 'task-attachments') then
    raise exception 'Inactive account can read protected data';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and not is_active) then
    raise exception 'Inactive account cannot read its access state';
  end if;
  begin
    insert into public.tasks (title, created_by) values ('Must not be created', auth.uid());
    raise exception 'Inactive account can insert tasks';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
select 'PASS: active access, protected columns, inactive read/write denial; all probes rolled back' as verification;
