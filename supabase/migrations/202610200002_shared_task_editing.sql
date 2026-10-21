-- Existing installations: run this migration after 202610200001_task_assignments.sql.
-- Any active account can edit any task; deletion and task creation keep their rules.
begin;

-- Replace the creator/admin-only update policy with shared editing.
drop policy if exists "Creators and admins can update tasks" on public.tasks;
drop policy if exists "Active accounts can update tasks" on public.tasks;
create policy "Active accounts can update tasks"
    on public.tasks for update
    to authenticated
    using (true)
    with check (true);

-- Limit client writes to the editable fields. created_by stays server-owned so
-- nobody can claim a foreign task and then delete it.
revoke update on public.tasks from anon, authenticated;
grant update (title, description, status, priority, position) on public.tasks to authenticated;

commit;
