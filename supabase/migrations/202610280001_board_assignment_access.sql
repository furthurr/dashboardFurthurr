-- Active task assignees can access the board while at least one assignment remains.
begin;

create or replace function public.has_board_assignment(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1
    from public.tasks t
    join public.task_assignees ta on ta.task_id = t.id
    where t.board_id = p_board_id and ta.profile_id = auth.uid()
  );
$$;
revoke all on function public.has_board_assignment(uuid) from public, anon;
grant execute on function public.has_board_assignment(uuid) to authenticated;

-- Keep this policy independent of can_access_board: INSERT ... RETURNING evaluates
-- it, and can_access_board reads boards. The helper reads only assignments/tasks.
drop policy "Accessible boards" on public.boards;
create policy "Accessible boards" on public.boards for select to authenticated
  using (
    public.is_active_account() and (
      public.is_board_admin()
      or (boards.is_active and (
        exists(select 1 from public.board_members m where m.board_id = boards.id and m.profile_id = auth.uid())
        or public.has_board_assignment(boards.id)
      ))
    )
  );

create or replace function public.can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1 from public.boards b
    where b.id = p_board_id and (
      public.is_board_admin()
      or (b.is_active and (
        exists(select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid())
        or public.has_board_assignment(b.id)
      ))
    )
  );
$$;

drop function public.list_boards_with_pending_counts();
create function public.list_boards_with_pending_counts()
returns table (
  id uuid, name text, is_active boolean, created_at timestamptz,
  pending_count bigint, my_pending_count bigint, people jsonb
)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.is_active, b.created_at,
    (select count(*) from public.tasks t
      where t.board_id = b.id and t.status in ('backlog', 'por_hacer', 'haciendo')),
    (select count(*) from public.tasks t
      join public.task_assignees ta on ta.task_id = t.id
      where t.board_id = b.id and ta.profile_id = auth.uid()
        and t.status in ('backlog', 'por_hacer', 'haciendo')),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', people.id, 'full_name', people.full_name, 'avatar_url', people.avatar_url)
        order by people.full_name)
      from (
        select distinct p.id, p.full_name, p.avatar_url
        from public.profiles p
        where exists(select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id)
          or exists(
            select 1 from public.task_assignees ta
            join public.tasks t on t.id = ta.task_id
            where t.board_id = b.id and ta.profile_id = p.id
          )
      ) people
    ), '[]'::jsonb)
  from public.boards b
  where public.is_active_account() and (
    public.is_board_admin()
    or (b.is_active and (
      exists(select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid())
      or public.has_board_assignment(b.id)
    ))
  )
  order by b.name;
$$;
revoke all on function public.list_boards_with_pending_counts() from public, anon;
grant execute on function public.list_boards_with_pending_counts() to authenticated;

commit;
