-- Permanently delete a deactivated board and its relational task data.
-- Apply after 202610220002_board_lifecycle.sql.
begin;

create function public.delete_inactive_board(p_board_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_is_active boolean;
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_board_id is null then raise exception 'Invalid board' using errcode = '22023'; end if;

  select b.is_active into current_is_active
  from public.boards b where b.id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if current_is_active then raise exception 'Board must be deactivated' using errcode = '55000'; end if;

  -- tasks.board_id uses ON DELETE RESTRICT; deleting the task rows first lets
  -- their comments, assignments and attachment metadata cascade atomically.
  delete from public.tasks where board_id = p_board_id;
  delete from public.boards where id = p_board_id;
end;
$$;

revoke all on function public.delete_inactive_board(uuid) from public, anon;
grant execute on function public.delete_inactive_board(uuid) to authenticated;

commit;
