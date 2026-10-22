-- Fix RLS recursion when admins create a board through PostgREST INSERT ... RETURNING.
-- Apply after 202610210001_boards.sql.
begin;

create or replace function public.can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  -- This function is called by the SELECT policy on public.boards. Avoid reading
  -- public.boards here, since INSERT ... RETURNING also evaluates that policy.
  select public.is_active_account() and (
    public.is_board_admin() or exists (
      select 1 from public.board_members m where m.board_id = p_board_id and m.profile_id = auth.uid()
    )
  );
$$;

commit;
