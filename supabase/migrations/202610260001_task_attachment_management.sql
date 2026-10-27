-- Apply after 202610220002_board_lifecycle.sql. Never rerun the bootstrap.
begin;

-- Only the display name can be changed through the authenticated client.
revoke update on public.task_attachments from public, anon, authenticated;
revoke update (id, task_id, uploaded_by, file_name, file_url, file_size, mime_type, created_at)
  on public.task_attachments from public, anon, authenticated;
grant update (file_name) on public.task_attachments to authenticated;

drop policy if exists "Attachment managers can rename attachments" on public.task_attachments;
create policy "Attachment managers can rename attachments"
  on public.task_attachments for update to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_board_admin()
    or exists(select 1 from public.tasks where id = task_id and created_by = auth.uid())
  )
  with check (
    uploaded_by = auth.uid()
    or public.is_board_admin()
    or exists(select 1 from public.tasks where id = task_id and created_by = auth.uid())
  );

commit;
