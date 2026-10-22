-- Board lifecycle: rename, deactivate/reactivate and pending task counts.
-- Apply after 202610220001_board_access_returning.sql.
begin;

alter table public.boards add column is_active boolean not null default true;

-- Members read their own membership row: the boards read policy checks it
-- directly and public.board_members has its own row level security.
create policy "Members read own memberships" on public.board_members for select to authenticated
  using (profile_id = auth.uid());

-- Replace the boards read policy. It must not call a function that reads
-- public.boards, because INSERT ... RETURNING evaluates this policy as well.
drop policy "Accessible boards" on public.boards;
create policy "Accessible boards" on public.boards for select to authenticated
  using (
    public.is_active_account() and (
      public.is_board_admin()
      or (boards.is_active and exists (
        select 1 from public.board_members m
        where m.board_id = boards.id and m.profile_id = auth.uid()
      ))
    )
  );

-- Members lose access to a deactivated board; active admins keep it.
create or replace function public.can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and (
    public.is_board_admin() or exists (
      select 1 from public.board_members m
      join public.boards b on b.id = m.board_id
      where m.board_id = p_board_id and m.profile_id = auth.uid() and b.is_active
    )
  );
$$;

-- Rename a board. Admin only; the trimmed name keeps the 1-120 character rule
-- and the unique index reports duplicates as unique_violation.
create function public.rename_board(p_board_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare trimmed text;
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_board_id is null or p_name is null then raise exception 'Invalid board' using errcode = '22023'; end if;
  trimmed := btrim(p_name);
  if char_length(trimmed) < 1 or char_length(trimmed) > 120 then
    raise exception 'Invalid board name' using errcode = '22023';
  end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  update public.boards set name = trimmed where id = p_board_id;
end;
$$;

-- Deactivate or reactivate a board. Content and memberships are preserved.
create function public.set_board_active(p_board_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_board_id is null or p_active is null then raise exception 'Invalid board' using errcode = '22023'; end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  update public.boards set is_active = p_active where id = p_board_id;
end;
$$;

-- Accessible boards with the number of pending tasks (backlog, por_hacer, haciendo).
-- Active admins see every board; other accounts only see the active boards they
-- belong to, so no membership or task count of another board is exposed.
create function public.list_boards_with_pending_counts()
returns table (id uuid, name text, is_active boolean, created_at timestamptz, pending_count bigint)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.is_active, b.created_at,
    (select count(*) from public.tasks t
      where t.board_id = b.id and t.status in ('backlog', 'por_hacer', 'haciendo'))
  from public.boards b
  where public.is_active_account() and (
    public.is_board_admin()
    or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid()
    ))
  )
  order by b.name;
$$;

revoke all on function public.rename_board(uuid, text), public.set_board_active(uuid, boolean),
  public.list_boards_with_pending_counts() from public, anon;
grant execute on function public.rename_board(uuid, text), public.set_board_active(uuid, boolean),
  public.list_boards_with_pending_counts() to authenticated;

commit;
