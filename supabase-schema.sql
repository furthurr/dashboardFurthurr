-- ============================================
-- SUPABASE SCHEMA FOR KANBAN BOARD PROJECT
-- Dashboard Furthurr
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

create type user_role as enum ('admin', 'usuario', 'invitado');

create type task_status as enum ('backlog', 'por_hacer', 'haciendo', 'en_revision', 'finalizadas');

create type task_priority as enum ('urgente', 'alta', 'normal', 'baja');

-- ============================================
-- PROFILES TABLE
-- Extends auth.users with public profile data
-- ============================================

create table public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    full_name text not null,
    email text not null,
    avatar_url text,
    nickname text,
    role user_role not null default 'invitado',
    is_active boolean not null default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.profiles is 'User profiles extending auth.users with application-specific fields';

-- ============================================
-- TASKS TABLE
-- Core task/kanban card entity
-- ============================================

create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    status task_status not null default 'backlog',
    priority task_priority not null default 'normal',
    special_notes text,
    created_by uuid references public.profiles(id) on delete set null,
    position numeric not null default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.tasks is 'Main task entity for kanban board cards';

-- ============================================
-- TASK_ASSIGNEES TABLE
-- Many-to-many relationship between tasks and profiles
-- ============================================

create table public.task_assignees (
    task_id uuid references public.tasks(id) on delete cascade,
    profile_id uuid references public.profiles(id) on delete cascade,
    created_at timestamp with time zone default now(),
    primary key (task_id, profile_id)
);

comment on table public.task_assignees is 'Links tasks to multiple assignees';

-- ============================================
-- COMMENTS TABLE
-- Task comments with edit permissions tracking
-- ============================================

create table public.comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete cascade not null,
    author_id uuid references public.profiles(id) on delete set null not null,
    body text not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

comment on table public.comments is 'Task comments with author tracking';

-- ============================================
-- TASK_ATTACHMENTS TABLE
-- File attachments for tasks (max 5MB enforced at client and storage level)
-- ============================================

create table public.task_attachments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete cascade not null,
    uploaded_by uuid references public.profiles(id) on delete set null not null,
    file_name text not null,
    file_url text not null,
    file_size integer not null,
    mime_type text not null,
    created_at timestamp with time zone default now()
);

comment on table public.task_attachments is 'Task file attachments with metadata';

-- ============================================
-- INDEXES
-- ============================================

create index idx_tasks_status on public.tasks(status);
create index idx_tasks_priority on public.tasks(priority);
create index idx_tasks_created_by on public.tasks(created_by);
create index idx_comments_task_id on public.comments(task_id);
create index idx_comments_author_id on public.comments(author_id);
create index idx_task_attachments_task_id on public.task_attachments(task_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Apply updated_at trigger to relevant tables
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.handle_updated_at();

create trigger set_tasks_updated_at
    before update on public.tasks
    for each row execute function public.handle_updated_at();

create trigger set_comments_updated_at
    before update on public.comments
    for each row execute function public.handle_updated_at();

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, full_name, email, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', ''),
        new.email,
        'usuario'
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.task_attachments enable row level security;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Everyone can read profiles (needed for assignee dropdowns and task display)
create policy "Profiles are publicly readable"
    on public.profiles for select
    using (true);

-- Users can update their own profile
create policy "Users can update own profile"
    on public.profiles for update
    using (auth.uid() = id);

-- Only admins can update other users' profiles and roles
create policy "Admins can update any profile"
    on public.profiles for update
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- ============================================
-- TASKS POLICIES
-- ============================================

-- All authenticated users can view tasks
create policy "Authenticated users can view tasks"
    on public.tasks for select
    using (auth.role() = 'authenticated');

-- All authenticated users can create tasks (admin and usuario can create)
-- Invitados could be blocked here if needed, but they shouldn't reach this UI anyway
create policy "Authenticated users can create tasks"
    on public.tasks for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'usuario')
        )
    );

-- Any active account can edit any task; column grants limit the writable fields.
-- The restrictive "Active account required" policy still blocks inactive accounts.
create policy "Active accounts can update tasks"
    on public.tasks for update
    to authenticated
    using (true)
    with check (true);

-- Creators and admins can delete tasks
create policy "Creators and admins can delete tasks"
    on public.tasks for delete
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- ============================================
-- TASK_ASSIGNEES POLICIES
-- ============================================

-- Anyone authenticated can view assignees
create policy "Authenticated users can view assignees"
    on public.task_assignees for select
    using (auth.role() = 'authenticated');

-- Only admin and usuario can add assignees
create policy "Admins and usuarios can add assignees"
    on public.task_assignees for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'usuario')
        )
    );

-- Only admin can remove assignees (or task creator)
create policy "Admins and task creators can remove assignees"
    on public.task_assignees for delete
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
        or exists (
            select 1 from public.tasks
            where id = task_id and created_by = auth.uid()
        )
    );

-- ============================================
-- COMMENTS POLICIES
-- ============================================

-- Anyone authenticated can view comments
create policy "Authenticated users can view comments"
    on public.comments for select
    using (auth.role() = 'authenticated');

-- Only admin and usuario can create comments (invitados blocked)
create policy "Admins and usuarios can create comments"
    on public.comments for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'usuario')
        )
    );

-- Authors and admins can update comments
create policy "Authors and admins can update comments"
    on public.comments for update
    using (
        author_id = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- Authors and admins can delete comments
create policy "Authors and admins can delete comments"
    on public.comments for delete
    using (
        author_id = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

-- ============================================
-- TASK_ATTACHMENTS POLICIES
-- ============================================

-- Anyone authenticated can view attachments
create policy "Authenticated users can view attachments"
    on public.task_attachments for select
    using (auth.role() = 'authenticated');

-- Only admin and usuario can upload attachments
create policy "Admins and usuarios can upload attachments"
    on public.task_attachments for insert
    with check (
        exists (
            select 1 from public.profiles
            where id = auth.uid() and role in ('admin', 'usuario')
        )
    );

-- Creators, assignees, and admins can delete attachments
create policy "Creators, assignees, and admins can delete attachments"
    on public.task_attachments for delete
    using (
        uploaded_by = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
        or exists (
            select 1 from public.tasks
            where id = task_id and created_by = auth.uid()
        )
    );

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Avatar bucket for user profile photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Task attachments bucket
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Anyone can view public avatars
create policy "Public read access for avatars"
    on storage.objects for select
    using (bucket_id = 'avatars');

-- Users can upload their own avatar; active admins can upload for other users.
create policy "Avatar owners and admins can upload"
    on storage.objects for insert
    with check (
        bucket_id = 'avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'admin' and is_active
            )
        )
    );

-- Users and active admins can replace an avatar in its profile folder.
create policy "Avatar owners and admins can update"
    on storage.objects for update
    using (
        bucket_id = 'avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'admin' and is_active
            )
        )
    )
    with check (
        bucket_id = 'avatars'
        and (
            (storage.foldername(name))[1] = auth.uid()::text
            or exists (
                select 1 from public.profiles
                where id = auth.uid() and role = 'admin' and is_active
            )
        )
    );

-- Task attachments: authenticated users can view
create policy "Authenticated users can view attachments"
    on storage.objects for select
    using (bucket_id = 'task-attachments');

-- Admin and usuario can upload task attachments (5MB enforced in client)
create policy "Admins and usuarios can upload task attachments"
    on storage.objects for insert
    with check (
        bucket_id = 'task-attachments'
        and auth.role() = 'authenticated'
    );

-- Creators, assignees, and admins can delete attachments
create policy "Users can delete own attachments"
    on storage.objects for delete
    using (
        bucket_id = 'task-attachments'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- View for tasks with assignee details
create or replace view public.tasks_with_assignees as
select
    t.*,
    json_agg(
        json_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'email', p.email,
            'avatar_url', p.avatar_url,
            'nickname', p.nickname
        )
    ) filter (where p.id is not null) as assignees
from public.tasks t
left join public.task_assignees ta on ta.task_id = t.id
left join public.profiles p on p.id = ta.profile_id
group by t.id;

-- View for tasks with comment count
create or replace view public.tasks_with_stats as
select
    t.*,
    count(distinct c.id) as comment_count,
    count(distinct a.id) as attachment_count
from public.tasks t
left join public.comments c on c.task_id = t.id
left join public.task_attachments a on a.task_id = t.id
group by t.id;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on types
grant usage on schema public to authenticated;

-- Grant necessary permissions
grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;
grant select on public.tasks to authenticated;
grant insert on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
-- Client writes are limited to the editable fields; created_by stays server-owned.
revoke update on public.tasks from anon, authenticated;
grant update (title, description, status, priority, position) on public.tasks to authenticated;
grant select on public.task_assignees to authenticated;
grant insert on public.task_assignees to authenticated;
grant delete on public.task_assignees to authenticated;
grant select on public.comments to authenticated;
grant insert on public.comments to authenticated;
grant update on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant select on public.task_attachments to authenticated;
grant insert on public.task_attachments to authenticated;
grant delete on public.task_attachments to authenticated;
grant update (file_name) on public.task_attachments to authenticated;

-- NOTE: Storage permissions are handled via RLS policies in the storage.objects table.
-- Policies for storage were defined earlier in this file.
-- No additional GRANT statements needed for storage buckets.

-- Grant access to views
grant select on public.tasks_with_assignees to authenticated;
grant select on public.tasks_with_stats to authenticated;

-- User administration hardening (keep aligned with migration 202610190001).
create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;
revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated, anon;

revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, nickname) on public.profiles to authenticated;
drop policy "Profiles are publicly readable" on public.profiles;
create policy "Account profile visibility" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_account());
create policy "Active profile writes" on public.profiles as restrictive for update to authenticated
  using (public.is_active_account()) with check (public.is_active_account());
create policy "Active profile visibility" on public.profiles as restrictive for select to anon, authenticated
  using (id = auth.uid() or public.is_active_account());
do $$
declare resource text;
begin
  foreach resource in array array['tasks', 'task_assignees', 'comments', 'task_attachments'] loop
    execute format('create policy "Active account required" on public.%I as restrictive for all to anon, authenticated using (public.is_active_account()) with check (public.is_active_account())', resource);
  end loop;
end $$;
create policy "Active storage reads" on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or bucket_id = 'avatars' or public.is_active_account());
create policy "Active storage inserts" on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());
create policy "Active storage updates" on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account())
  with check (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());
create policy "Active storage deletes" on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());
alter view public.tasks_with_assignees set (security_invoker = true);
alter view public.tasks_with_stats set (security_invoker = true);

-- Transactional task assignments (migration 202610200001).
revoke insert, update, delete on public.task_assignees from anon, authenticated;

create or replace function public.set_task_assignees(p_task_id uuid, p_assignee_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  requested uuid[];
  result jsonb;
begin
  if auth.uid() is null or not public.is_active_account() then
    raise exception 'An active account is required' using errcode = '42501';
  end if;
  if p_assignee_ids is null or array_position(p_assignee_ids, null) is not null then
    raise exception 'Invalid assignee list' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct id), '{}'::uuid[]) into requested from unnest(p_assignee_ids) as ids(id);
  perform 1 from public.tasks where id = p_task_id for update;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = any(requested) order by id for share;
  if exists (
    select 1 from unnest(requested) as ids(id)
    left join public.profiles p on p.id = ids.id
    where p.id is null or (not p.is_active and not exists (
      select 1 from public.task_assignees ta where ta.task_id = p_task_id and ta.profile_id = ids.id
    ))
  ) then raise exception 'Assignees must exist and be active' using errcode = '22023'; end if;
  delete from public.task_assignees where task_id = p_task_id and not (profile_id = any(requested));
  insert into public.task_assignees (task_id, profile_id)
    select p_task_id, id from unnest(requested) as ids(id) on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email,
    'avatar_url', p.avatar_url, 'role', p.role, 'is_active', p.is_active
  ) order by p.full_name, p.id), '[]'::jsonb) into result
  from public.task_assignees ta join public.profiles p on p.id = ta.profile_id where ta.task_id = p_task_id;
  return result;
end;
$$;

create or replace function public.create_task_with_assignees(
  p_title text, p_description text, p_status public.task_status,
  p_priority public.task_priority, p_assignee_ids uuid[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  new_task public.tasks;
  next_position numeric;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ) then raise exception 'Not allowed to create tasks' using errcode = '42501'; end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Title is required' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('create-task:' || p_status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where status = p_status;
  insert into public.tasks (title, description, status, priority, created_by, position)
    values (btrim(p_title), nullif(btrim(p_description), ''), p_status, p_priority, auth.uid(), next_position)
    returning * into new_task;
  perform public.set_task_assignees(new_task.id, p_assignee_ids);
  return to_jsonb(new_task);
end;
$$;
revoke all on function public.set_task_assignees(uuid, uuid[]) from public, anon;
revoke all on function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]) from public, anon;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated;
grant execute on function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]) to authenticated;

-- Boards and board-scoped access (keep aligned with 202610210001_boards.sql).
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120 and name = btrim(name)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index boards_unique_name on public.boards (lower(name));
create table public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (board_id, profile_id)
);
create index board_members_profile on public.board_members(profile_id, board_id);
insert into public.boards(name) values ('Offline'), ('General');
insert into public.board_members(board_id, profile_id)
  select b.id, p.id from public.boards b cross join public.profiles p where b.name = 'Offline' and p.is_active;
alter table public.tasks add column board_id uuid references public.boards(id) on delete restrict;
update public.tasks set board_id = (select id from public.boards where name = 'Offline');
alter table public.tasks alter column board_id set not null;
create index tasks_board_status_position on public.tasks(board_id, status, position);

create function public.is_board_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and is_active and role = 'admin');
$$;
create function public.has_board_assignment(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1 from public.tasks t join public.task_assignees ta on ta.task_id = t.id
    where t.board_id = p_board_id and ta.profile_id = auth.uid()
  );
$$;
create function public.can_access_board(p_board_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and exists (
    select 1 from public.boards b where b.id = p_board_id and (
      public.is_board_admin() or (b.is_active and (
        exists(select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid())
        or public.has_board_assignment(b.id)
      ))
    )
  );
$$;
create function public.can_access_task(p_task_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.tasks where id = p_task_id and public.can_access_board(board_id));
$$;
revoke all on function public.is_board_admin(), public.has_board_assignment(uuid), public.can_access_board(uuid), public.can_access_task(uuid) from public, anon;
grant execute on function public.is_board_admin(), public.has_board_assignment(uuid), public.can_access_board(uuid), public.can_access_task(uuid) to authenticated;
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
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
revoke all on public.boards, public.board_members from anon, authenticated;
grant select, insert on public.boards to authenticated;
grant select on public.board_members to authenticated;
create policy "Accessible boards" on public.boards for select to authenticated
  using (
    public.is_active_account() and (
      public.is_board_admin()
      or (boards.is_active and exists (
        select 1 from public.board_members m
        where m.board_id = boards.id and m.profile_id = auth.uid()
      ))
      or (boards.is_active and public.has_board_assignment(boards.id))
    )
  );
create policy "Admins create boards" on public.boards for insert to authenticated with check (public.is_board_admin());
create policy "Admins read memberships" on public.board_members for select to authenticated using (public.is_board_admin());
create policy "Members read own memberships" on public.board_members for select to authenticated using (profile_id = auth.uid());
create policy "Board access required" on public.tasks as restrictive for all to authenticated
  using (public.can_access_board(board_id)) with check (public.can_access_board(board_id));
create policy "Board access required" on public.task_assignees as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "Board access required" on public.comments as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
create policy "Board access required" on public.task_attachments as restrictive for all to authenticated
  using (public.can_access_task(task_id)) with check (public.can_access_task(task_id));
revoke insert on public.tasks from anon, authenticated;

create function public.set_board_members(p_board_id uuid, p_profile_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  perform 1 from public.boards where id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if p_profile_ids is null or array_position(p_profile_ids, null) is not null then
    raise exception 'Invalid members' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = any(p_profile_ids) order by id for share;
  if exists(select 1 from unnest(p_profile_ids) ids(id) left join public.profiles p on p.id = ids.id
    where p.id is null or (not p.is_active and not exists(select 1 from public.board_members m where m.board_id = p_board_id and m.profile_id = p.id))) then
    raise exception 'Members must exist and be active' using errcode = '22023';
  end if;
  delete from public.board_members where board_id = p_board_id and not (profile_id = any(p_profile_ids));
  insert into public.board_members(board_id, profile_id) select p_board_id, id from unnest(p_profile_ids) ids(id) on conflict do nothing;
end;
$$;

-- Board lifecycle: rename and deactivate/reactivate are admin only.
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
create function public.delete_inactive_board(p_board_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_is_active boolean;
begin
  if not public.is_board_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  if p_board_id is null then raise exception 'Invalid board' using errcode = '22023'; end if;
  select b.is_active into current_is_active from public.boards b where b.id = p_board_id for update;
  if not found then raise exception 'Board not found' using errcode = 'P0002'; end if;
  if current_is_active then raise exception 'Board must be deactivated' using errcode = '55000'; end if;
  delete from public.tasks where board_id = p_board_id;
  delete from public.boards where id = p_board_id;
end;
$$;
-- Accessible boards with pending tasks (backlog, por_hacer, haciendo).
create function public.list_boards_with_pending_counts()
returns table (id uuid, name text, is_active boolean, created_at timestamptz, pending_count bigint, my_pending_count bigint, people jsonb)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name, b.is_active, b.created_at,
    (select count(*) from public.tasks t
      where t.board_id = b.id and t.status in ('backlog', 'por_hacer', 'haciendo')),
    (select count(*) from public.tasks t join public.task_assignees ta on ta.task_id = t.id
      where t.board_id = b.id and ta.profile_id = auth.uid()
        and t.status in ('backlog', 'por_hacer', 'haciendo')),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', people.id, 'full_name', people.full_name, 'avatar_url', people.avatar_url)
        order by people.full_name)
      from (
        select distinct p.id, p.full_name, p.avatar_url
        from public.profiles p
        where exists(select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id)
          or exists(select 1 from public.task_assignees ta join public.tasks t on t.id = ta.task_id
            where t.board_id = b.id and ta.profile_id = p.id)
      ) people
    ), '[]'::jsonb)
  from public.boards b
  where public.is_active_account() and (
    public.is_board_admin()
    or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = auth.uid()
    ))
    or (b.is_active and public.has_board_assignment(b.id))
  )
  order by b.name;
$$;
revoke all on function public.rename_board(uuid, text), public.set_board_active(uuid, boolean),
  public.delete_inactive_board(uuid),
  public.list_boards_with_pending_counts() from public, anon;
grant execute on function public.rename_board(uuid, text), public.set_board_active(uuid, boolean),
  public.delete_inactive_board(uuid),
  public.list_boards_with_pending_counts() to authenticated;

alter function public.set_task_assignees(uuid, uuid[]) rename to set_task_assignees_internal;
revoke all on function public.set_task_assignees_internal(uuid, uuid[]) from public, anon, authenticated;
create function public.set_task_assignees(p_task_id uuid, p_assignee_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.tasks where id = p_task_id for update;
  if not public.can_access_task(p_task_id) then raise exception 'Task access denied' using errcode = '42501'; end if;
  return public.set_task_assignees_internal(p_task_id, p_assignee_ids);
end;
$$;
drop function public.create_task_with_assignees(text, text, public.task_status, public.task_priority, uuid[]);
create function public.create_task_with_assignees(
  p_board_id uuid, p_title text, p_description text, p_status public.task_status,
  p_priority public.task_priority, p_assignee_ids uuid[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare new_task public.tasks; next_position numeric;
begin
  if not public.can_access_board(p_board_id) or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ) then raise exception 'Not allowed to create tasks' using errcode = '42501'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'Title required' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_board_id::text || ':' || p_status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where board_id = p_board_id and status = p_status;
  insert into public.tasks(board_id, title, description, status, priority, created_by, position)
    values(p_board_id, btrim(p_title), nullif(btrim(p_description), ''), p_status, p_priority, auth.uid(), next_position) returning * into new_task;
  perform public.set_task_assignees(new_task.id, p_assignee_ids);
  return to_jsonb(new_task);
end;
$$;
create function public.move_task_to_board(p_task_id uuid, p_board_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare current_task public.tasks; next_position numeric;
begin
  select * into current_task from public.tasks where id = p_task_id for update;
  if not found or not public.can_access_task(p_task_id) or not public.can_access_board(p_board_id) then
    raise exception 'Board access denied' using errcode = '42501';
  end if;
  if current_task.board_id = p_board_id then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_board_id::text || ':' || current_task.status::text));
  select coalesce(max(position) + 1, 0) into next_position from public.tasks where board_id = p_board_id and status = current_task.status;
  update public.tasks set board_id = p_board_id, position = next_position where id = p_task_id;
end;
$$;
revoke all on function public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) from public, anon;
grant execute on function public.set_board_members(uuid, uuid[]), public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, text, text, public.task_status, public.task_priority, uuid[]), public.move_task_to_board(uuid, uuid) to authenticated;
create function public.can_access_task_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_active_account() and (
    exists(select 1 from public.tasks t where t.id::text = split_part(p_name, '/', 1) and public.can_access_board(t.board_id))
    or exists(select 1 from public.task_attachments a where
      right(a.file_url, length('/task-attachments/' || p_name)) = '/task-attachments/' || p_name and public.can_access_task(a.task_id))
  );
$$;
revoke all on function public.can_access_task_object(text) from public, anon;
grant execute on function public.can_access_task_object(text) to authenticated;
create policy "Board storage access" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'task-attachments' or public.can_access_task_object(name))
  with check (bucket_id <> 'task-attachments' or public.can_access_task_object(name));
create policy "Board storage upload role" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'task-attachments' or exists (
    select 1 from public.profiles where id = auth.uid() and is_active and role in ('admin', 'usuario')
  ));
drop policy "Users can delete own attachments" on storage.objects;
create policy "Users can delete own attachments" on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments' and exists (
    select 1 from public.task_attachments a join public.tasks t on t.id = a.task_id
    where right(a.file_url, length('/task-attachments/' || name)) = '/task-attachments/' || name
      and (a.uploaded_by = auth.uid() or t.created_by = auth.uid() or public.is_board_admin())
  )
);
create function public.validate_attachment_path() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.file_url not like '%/task-attachments/' || new.task_id::text || '/%' then
    raise exception 'Attachment path must belong to its task' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger attachment_task_path before insert or update on public.task_attachments
  for each row execute function public.validate_attachment_path();
update storage.buckets set public = false where id = 'task-attachments';

-- MCP identity-only bootstrap. Keep aligned with 202610280002_mcp_identity.sql.
-- Phase 1: OAuth clients can identify themselves, not use the portal's business APIs.
begin;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_identity') then
    create role mcp_identity nologin noinherit;
  end if;
end $$;
grant mcp_identity to authenticator;
grant usage on schema public to mcp_identity;

-- Set explicitly per environment BEFORE enabling the Auth hook/OAuth server.
create table public.mcp_oauth_configuration (
  singleton boolean primary key default true check (singleton),
  resource_url text not null check (
    resource_url ~ '^https://[^/?#]+/functions/v1/mcp$'
    or resource_url ~ '^http://(localhost|127\.0\.0\.1):[0-9]+/functions/v1/mcp$'
  )
);
alter table public.mcp_oauth_configuration enable row level security;
revoke all on public.mcp_oauth_configuration from public, anon, authenticated, mcp_identity;

create function public.mcp_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb := event -> 'claims'; resource text;
begin
  -- Preserve ordinary portal login/refresh byte-for-byte. Never use user_metadata.
  if coalesce(event ->> 'client_id', claims ->> 'client_id', '') = '' then
    return jsonb_build_object('claims', claims);
  end if;
  select resource_url into resource from public.mcp_oauth_configuration where singleton;
  if resource is null then
    raise exception 'Configure the MCP resource before enabling OAuth' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = (event ->> 'user_id')::uuid and is_active) then
    raise exception 'An active Furthurr account is required' using errcode = '42501';
  end if;
  claims := jsonb_set(claims, '{client_id}', to_jsonb(coalesce(event ->> 'client_id', claims ->> 'client_id')));
  claims := jsonb_set(claims, '{role}', '"mcp_identity"'::jsonb);
  claims := jsonb_set(claims, '{aud}', to_jsonb(resource));
  return jsonb_build_object('claims', claims);
end $$;
revoke all on function public.mcp_access_token_hook(jsonb) from public, anon, authenticated, mcp_identity;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.mcp_access_token_hook(jsonb) to supabase_auth_admin;

create function public.mcp_whoami() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare claims jsonb := auth.jwt(); identity jsonb;
begin
  if claims ->> 'role' is distinct from 'mcp_identity'
    or coalesce(claims ->> 'client_id', '') = ''
    or not exists (select 1 from public.mcp_oauth_configuration where singleton and resource_url = claims ->> 'aud') then
    raise exception 'Invalid MCP token' using errcode = '28000';
  end if;
  -- Check the live session on EVERY request, including tool listing/initialization.
  -- revokeGrant removes these sessions; a still-unexpired JWT must not keep working.
  if not exists (
    select 1 from auth.sessions s where s.id = (claims ->> 'session_id')::uuid
      and s.user_id = auth.uid() and s.oauth_client_id = (claims ->> 'client_id')::uuid
      and (s.not_after is null or s.not_after > now())
  ) then
    raise exception 'MCP session revoked or expired' using errcode = '28000';
  end if;
  select jsonb_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name,
    'role', p.role, 'client_id', claims ->> 'client_id') into identity
    from public.profiles p where p.id = auth.uid() and p.is_active;
  if identity is null then
    raise exception 'An active Furthurr account is required' using errcode = '42501';
  end if;
  return identity;
end $$;
revoke all on function public.mcp_whoami() from public, anon, authenticated;
grant execute on function public.mcp_whoami() to mcp_identity;

-- Defense in depth if an OAuth token were issued before the hook was activated.
do $$ declare resource text; begin
  foreach resource in array array['profiles','boards','board_members','tasks','task_assignees','comments','task_attachments'] loop
    execute format('create policy "OAuth identity isolation" on public.%I as restrictive for all to public using (coalesce(auth.jwt() ->> ''client_id'', '''') = '''') with check (coalesce(auth.jwt() ->> ''client_id'', '''') = '''')', resource);
  end loop;
end $$;
create policy "OAuth identity isolation" on storage.objects as restrictive for all to public
  using (coalesce(auth.jwt() ->> 'client_id', '') = '')
  with check (coalesce(auth.jwt() ->> 'client_id', '') = '');

-- Fail closed if the deployment has unexpected PUBLIC grants or role inheritance.
do $$ declare item record; begin
  if exists (select 1 from pg_roles where rolname = 'mcp_identity' and
    (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolinherit)) then
    raise exception 'mcp_identity must be a non-privileged NOLOGIN NOINHERIT role';
  end if;
  if pg_has_role('mcp_identity', 'authenticated', 'member') or pg_has_role('mcp_identity', 'service_role', 'member') then
    raise exception 'mcp_identity must not inherit portal roles';
  end if;
  for item in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype <> 'trigger'::regtype
      and p.oid <> 'public.mcp_whoami()'::regprocedure loop
    if has_function_privilege('mcp_identity', item.oid, 'execute') then
      raise exception 'Unexpected function grant for mcp_identity: %', item.oid::regprocedure;
    end if;
  end loop;
  for item in select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage') and c.relkind in ('r', 'v', 'm', 'p') loop
    if has_table_privilege('mcp_identity', item.oid, 'select,insert,update,delete')
      or has_any_column_privilege('mcp_identity', item.oid, 'select,insert,update') then
      raise exception 'Unexpected table grant for mcp_identity: %', item.oid::regclass;
    end if;
  end loop;
end $$;

commit;

-- Phase 2: explicit, session-bound read consent; no direct business table grants.
begin;

create table public.mcp_task_read_permissions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  granted_at timestamptz not null default now()
);
alter table public.mcp_task_read_permissions enable row level security;
revoke all on public.mcp_task_read_permissions from public, anon, authenticated, mcp_identity;
create index mcp_task_read_permissions_owner on public.mcp_task_read_permissions(profile_id, client_id);

-- Called by the portal after a separate, explicit confirmation. Permissions bind
-- to current live sessions, never to future connections of the same OAuth client.
create function public.mcp_set_task_read_access(p_client_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  if p_client_id is null or p_enabled is null then
    raise exception 'Invalid consent' using errcode = '22023';
  end if;
  if p_enabled then
    if not exists (select 1 from auth.sessions where user_id = auth.uid()
      and oauth_client_id = p_client_id and (not_after is null or not_after > now())) then
      raise exception 'No live connection' using errcode = '22023';
    end if;
    insert into public.mcp_task_read_permissions(session_id, profile_id, client_id)
      select id, user_id, oauth_client_id from auth.sessions where user_id = auth.uid()
        and oauth_client_id = p_client_id and (not_after is null or not_after > now())
      on conflict(session_id) do update set granted_at = now();
  else
    delete from public.mcp_task_read_permissions where profile_id = auth.uid() and client_id = p_client_id;
  end if;
end $$;
revoke all on function public.mcp_set_task_read_access(uuid, boolean) from public, anon, mcp_identity;
grant execute on function public.mcp_set_task_read_access(uuid, boolean) to authenticated;

create function public.mcp_list_task_read_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(access)), '[]'::jsonb) into result from (
    select s.oauth_client_id as client_id, bool_or(p.session_id is not null) as enabled,
      bool_or(p.session_id is null) as needs_authorization
    from auth.sessions s left join public.mcp_task_read_permissions p
      on p.session_id = s.id and p.profile_id = s.user_id and p.client_id = s.oauth_client_id
    where s.user_id = auth.uid() and s.oauth_client_id is not null and (s.not_after is null or s.not_after > now())
    group by s.oauth_client_id
  ) access;
  return result;
end $$;
revoke all on function public.mcp_list_task_read_access() from public, anon, mcp_identity;
grant execute on function public.mcp_list_task_read_access() to authenticated;

create function public.mcp_get_task(p_task_id uuid, p_comments_offset integer default 0,
  p_attachments_offset integer default 0, p_page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks; result jsonb; comments_total bigint; attachments_total bigint;
begin
  perform public.mcp_whoami();
  if not exists (select 1 from public.mcp_task_read_permissions p
    where p.session_id = (auth.jwt() ->> 'session_id')::uuid and p.profile_id = auth.uid()
      and p.client_id = (auth.jwt() ->> 'client_id')::uuid) then
    raise exception 'Explicit task read consent required' using errcode = 'PT403';
  end if;
  if p_task_id is null or p_comments_offset is null or p_attachments_offset is null or p_page_size is null
    or p_comments_offset < 0 or p_attachments_offset < 0 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Invalid task query' using errcode = '22023';
  end if;
  select * into task from public.tasks t where t.id = p_task_id;
  -- Deliberately require membership for non-admin MCP clients. Portal helpers
  -- may also allow assignment-based board access; that does not widen this grant.
  if task.id is null or not exists (
    select 1 from public.profiles p join public.boards b on b.id = task.board_id
    where p.id = auth.uid() and p.is_active and (p.role = 'admin' or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id
    )))
  ) then
    raise exception 'Task unavailable or inaccessible' using errcode = 'PT404';
  end if;
  select count(*) into comments_total from public.comments where task_id = p_task_id;
  select count(*) into attachments_total from public.task_attachments where task_id = p_task_id;
  select jsonb_build_object(
    'task', jsonb_build_object('id', task.id, 'title', task.title, 'description', task.description,
      'status', task.status, 'priority', task.priority, 'special_notes', task.special_notes,
      'created_at', task.created_at, 'updated_at', task.updated_at),
    'board', (select jsonb_build_object('id', b.id, 'name', b.name) from public.boards b where b.id = task.board_id),
    'assignees', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name, p.id), '[]'::jsonb)
      from public.task_assignees a join public.profiles p on p.id = a.profile_id where a.task_id = p_task_id),
    'comments', jsonb_build_object('total', comments_total, 'offset', p_comments_offset,
      'next_offset', case when p_comments_offset::bigint + p_page_size < comments_total then p_comments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb) from (
        select c.id, c.body, c.created_at, c.updated_at,
          jsonb_build_object('id', p.id, 'full_name', p.full_name) as author
        from public.comments c left join public.profiles p on p.id = c.author_id
        where c.task_id = p_task_id order by c.created_at, c.id limit p_page_size offset p_comments_offset
      ) c)),
    'attachments', jsonb_build_object('total', attachments_total, 'offset', p_attachments_offset,
      'next_offset', case when p_attachments_offset::bigint + p_page_size < attachments_total then p_attachments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb) from (
        select id, file_name, mime_type, file_size, created_at, file_url from public.task_attachments
        where task_id = p_task_id order by created_at, id limit p_page_size offset p_attachments_offset
      ) a))
  ) into result;
  return result;
end $$;
revoke all on function public.mcp_get_task(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.mcp_get_task(uuid, integer, integer, integer) to mcp_identity;

commit;

-- Joint, explicit consent tied to the actual Auth grant, never to login alone.
begin;

create table public.mcp_workflow_permissions (
  consent_id uuid primary key references auth.oauth_consents(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  consent_granted_at timestamptz not null,
  permissions text[] not null check (permissions <@ array['read_tasks','read_attachments','start_task','comment_task','review_task']::text[]),
  granted_at timestamptz not null default now()
);
alter table public.mcp_workflow_permissions enable row level security;
revoke all on public.mcp_workflow_permissions from public, anon, authenticated, mcp_identity;

create function public.mcp_authorize_workflow(p_authorization_id text) returns void
language plpgsql security definer set search_path = '' as $$
declare consent auth.oauth_consents;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  -- Called only after Auth approves the displayed request, before redirect/code exchange.
  select c.* into consent from auth.oauth_authorizations a join auth.oauth_consents c
    on c.client_id = a.client_id and c.user_id = a.user_id
    where a.authorization_id = p_authorization_id and a.user_id = auth.uid()
      and a.status = 'approved' and a.expires_at > now() and c.revoked_at is null
    for share of c;
  if consent.id is null then
    raise exception 'Approved authorization required' using errcode = '42501';
  end if;
  insert into public.mcp_workflow_permissions(consent_id, profile_id, client_id, consent_granted_at, permissions)
    values(consent.id, auth.uid(), consent.client_id, consent.granted_at,
      array['read_tasks','read_attachments','start_task','comment_task','review_task'])
    on conflict(consent_id) do update set consent_granted_at = excluded.consent_granted_at,
      permissions = excluded.permissions, granted_at = now();
end $$;
revoke all on function public.mcp_authorize_workflow(text) from public, anon, mcp_identity;
grant execute on function public.mcp_authorize_workflow(text) to authenticated;

-- Auth can auto-approve an old identity consent. Return only display metadata,
-- never its authorization code, so expanded application consent is still explicit.
create function public.mcp_workflow_authorization_details(p_authorization_id text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  select jsonb_build_object('details', jsonb_build_object('authorization_id', a.authorization_id,
    'client', jsonb_build_object('id', c.id, 'name', coalesce(c.client_name, '')),
    'user', jsonb_build_object('id', p.id, 'email', p.email), 'redirect_uri', a.redirect_uri, 'scope', a.scope),
    'authorized', exists(select 1 from public.mcp_workflow_permissions w join auth.oauth_consents consent
      on consent.id = w.consent_id and consent.granted_at = w.consent_granted_at and consent.revoked_at is null
      where w.profile_id = p.id and w.client_id = c.id and consent.user_id = p.id and consent.client_id = c.id
        and w.permissions @> array['read_tasks','read_attachments','start_task','comment_task','review_task']))
    into result from auth.oauth_authorizations a join auth.oauth_clients c on c.id = a.client_id
      join public.profiles p on p.id = a.user_id
    where a.authorization_id = p_authorization_id and a.user_id = auth.uid()
      and a.status = 'approved' and a.expires_at > now();
  if result is null then raise exception 'Authorization unavailable' using errcode = '42501'; end if;
  return result;
end $$;
revoke all on function public.mcp_workflow_authorization_details(text) from public, anon, mcp_identity;
grant execute on function public.mcp_workflow_authorization_details(text) to authenticated;

create function public.mcp_list_workflow_access() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('client_id', c.client_id,
    'permissions', (select coalesce(array_agg(distinct permission), '{}'::text[]) from unnest(coalesce(p.permissions, '{}'::text[]) ||
      case when exists(select 1 from public.mcp_task_read_permissions r join auth.sessions s on s.id = r.session_id
        where r.profile_id = c.user_id and r.client_id = c.client_id and (s.not_after is null or s.not_after > now()))
        then array['read_tasks','read_attachments'] else '{}'::text[] end) permission))), '[]'::jsonb)
    from auth.oauth_consents c left join public.mcp_workflow_permissions p
      on p.consent_id = c.id and p.consent_granted_at = c.granted_at
        and p.profile_id = c.user_id and p.client_id = c.client_id
    where c.user_id = auth.uid() and c.revoked_at is null);
end $$;
revoke all on function public.mcp_list_workflow_access() from public, anon, mcp_identity;
grant execute on function public.mcp_list_workflow_access() to authenticated;

create function public.mcp_revoke_workflow_permission(p_client_id uuid, p_permission text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.jwt() ->> 'role' is distinct from 'authenticated'
    or coalesce(auth.jwt() ->> 'client_id', '') <> '' or not public.is_active_account() then
    raise exception 'Portal session required' using errcode = '42501';
  end if;
  if p_permission is null or p_permission not in ('read_tasks','read_attachments','start_task','comment_task','review_task','all') then
    raise exception 'Invalid permission' using errcode = '22023';
  end if;
  update public.mcp_workflow_permissions set permissions = case when p_permission = 'all' then '{}'::text[]
    else array_remove(permissions, p_permission) end
    where profile_id = auth.uid() and client_id = p_client_id;
  -- Retiring read also retires the legacy session-bound read grant.
  if p_permission in ('read_tasks', 'read_attachments', 'all') then
    delete from public.mcp_task_read_permissions where profile_id = auth.uid() and client_id = p_client_id;
  end if;
end $$;
revoke all on function public.mcp_revoke_workflow_permission(uuid, text) from public, anon, mcp_identity;
grant execute on function public.mcp_revoke_workflow_permission(uuid, text) to authenticated;

-- Internal helpers have no public/MCP grants. All entry points recheck live identity.
create function public.mcp_has_workflow_permission(p_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mcp_workflow_permissions p join auth.oauth_consents c on c.id = p.consent_id
    where p.profile_id = auth.uid() and p.client_id = (auth.jwt() ->> 'client_id')::uuid
      and c.user_id = p.profile_id and c.client_id = p.client_id and c.revoked_at is null
      and c.granted_at = p.consent_granted_at and p_permission = any(p.permissions))
    or (p_permission in ('read_tasks','read_attachments') and exists (
      select 1 from public.mcp_task_read_permissions p where p.session_id = (auth.jwt() ->> 'session_id')::uuid
        and p.profile_id = auth.uid() and p.client_id = (auth.jwt() ->> 'client_id')::uuid));
$$;
revoke all on function public.mcp_has_workflow_permission(text) from public, anon, authenticated, mcp_identity;

create function public.mcp_assert_task_access(p_task_id uuid, p_check_status boolean default true) returns public.tasks
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks;
begin
  perform public.mcp_whoami();
  if not public.mcp_has_workflow_permission('read_tasks') then
    raise exception 'Read consent required' using errcode = 'PT403';
  end if;
  select * into task from public.tasks where id = p_task_id;
  if task.id is null or not exists (select 1 from public.profiles p join public.boards b on b.id = task.board_id
    where p.id = auth.uid() and p.is_active and (p.role = 'admin' or (b.is_active and exists (
      select 1 from public.board_members m where m.board_id = b.id and m.profile_id = p.id)))) then
    raise exception 'Task unavailable' using errcode = 'PT404';
  end if;
  if not exists(select 1 from public.task_assignees where task_id = task.id and profile_id = auth.uid()) then
    raise exception 'Assignment required' using errcode = 'PT412';
  end if;
  if p_check_status and task.status not in ('backlog','por_hacer','haciendo') then
    raise exception 'Move manually to haciendo' using errcode = 'PT409';
  end if;
  return task;
end $$;
revoke all on function public.mcp_assert_task_access(uuid, boolean) from public, anon, authenticated, mcp_identity;

create or replace function public.mcp_get_task(p_task_id uuid, p_comments_offset integer default 0,
  p_attachments_offset integer default 0, p_page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare task public.tasks; comments_total bigint; attachments_total bigint;
begin
  task := public.mcp_assert_task_access(p_task_id);
  if p_task_id is null or p_comments_offset is null or p_attachments_offset is null or p_page_size is null
    or p_comments_offset < 0 or p_attachments_offset < 0 or p_page_size < 1 or p_page_size > 100 then
    raise exception 'Invalid query' using errcode = '22023';
  end if;
  select count(*) into comments_total from public.comments where task_id = p_task_id;
  select count(*) into attachments_total from public.task_attachments where task_id = p_task_id;
  return jsonb_build_object(
    'task', jsonb_build_object('id', task.id, 'title', task.title, 'description', task.description,
      'status', task.status, 'priority', task.priority, 'special_notes', task.special_notes,
      'created_at', task.created_at, 'updated_at', task.updated_at),
    'board', (select jsonb_build_object('id', b.id, 'name', b.name) from public.boards b where b.id = task.board_id),
    'assignees', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name) order by p.full_name, p.id), '[]'::jsonb)
      from public.task_assignees a join public.profiles p on p.id = a.profile_id where a.task_id = p_task_id),
    'comments', jsonb_build_object('total', comments_total, 'offset', p_comments_offset,
      'next_offset', case when p_comments_offset::bigint + p_page_size < comments_total then p_comments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at, c.id), '[]'::jsonb) from (
        select c.id, c.body, c.created_at, c.updated_at, jsonb_build_object('id', p.id, 'full_name', p.full_name) as author
        from public.comments c left join public.profiles p on p.id = c.author_id
        where c.task_id = p_task_id order by c.created_at, c.id limit p_page_size offset p_comments_offset) c)),
    'attachments', jsonb_build_object('total', attachments_total, 'offset', p_attachments_offset,
      'next_offset', case when p_attachments_offset::bigint + p_page_size < attachments_total then p_attachments_offset::bigint + p_page_size else null end,
      'items', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at, a.id), '[]'::jsonb) from (
        select id, file_name, mime_type, file_size, created_at,
          case when public.mcp_has_workflow_permission('read_attachments') then file_url else '' end as file_url
        from public.task_attachments where task_id = p_task_id order by created_at, id limit p_page_size offset p_attachments_offset) a)));
end $$;

create function public.mcp_get_attachment(p_task_id uuid, p_attachment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.mcp_assert_task_access(p_task_id);
  if not public.mcp_has_workflow_permission('read_attachments') then
    raise exception 'Attachment consent required' using errcode = 'PT403';
  end if;
  select to_jsonb(a) - 'uploaded_by' into result from public.task_attachments a
    where a.id = p_attachment_id and a.task_id = p_task_id;
  if result is null then raise exception 'Attachment unavailable' using errcode = 'PT404'; end if;
  return result;
end $$;
revoke all on function public.mcp_get_attachment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_get_attachment(uuid, uuid) to mcp_identity;

create table public.mcp_task_operations (
  task_id uuid not null references public.tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid not null,
  request_id uuid not null,
  action text not null check (action in ('start_task','comment_task','review_task')),
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(task_id, profile_id, client_id, request_id)
);
alter table public.mcp_task_operations enable row level security;
revoke all on public.mcp_task_operations from public, anon, authenticated, mcp_identity;

create function public.mcp_work_task(p_task_id uuid, p_action text, p_request_id uuid,
  p_expected_updated_at timestamptz, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare task public.tasks; previous public.mcp_task_operations; result jsonb; comment_id uuid;
  client uuid := (auth.jwt() ->> 'client_id')::uuid; client_name text; field text;
begin
  perform public.mcp_whoami();
  if p_action is null or p_action not in ('start_task','comment_task','review_task') or p_request_id is null
    or p_expected_updated_at is null or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 80000 then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  -- Serialize against Auth grant/session revocation as well as permission withdrawal.
  perform 1 from auth.oauth_consents where user_id = auth.uid() and client_id = client for share;
  perform 1 from public.mcp_workflow_permissions where profile_id = auth.uid() and client_id = client for share;
  perform 1 from auth.sessions where id = (auth.jwt() ->> 'session_id')::uuid for share;
  if not public.mcp_has_workflow_permission(p_action) then
    raise exception 'Work consent required' using errcode = 'PT403';
  end if;
  perform 1 from public.tasks where id = p_task_id for update;
  perform 1 from public.task_assignees where task_id = p_task_id and profile_id = auth.uid() for share;
  perform 1 from public.profiles where id = auth.uid() for share;
  perform 1 from public.boards where id = (select board_id from public.tasks where id = p_task_id) for share;
  perform 1 from public.board_members where board_id = (select board_id from public.tasks where id = p_task_id)
    and profile_id = auth.uid() for share;
  task := public.mcp_assert_task_access(p_task_id, false);
  select * into previous from public.mcp_task_operations where task_id = p_task_id and profile_id = auth.uid()
    and client_id = client and request_id = p_request_id;
  if previous.task_id is not null then
    if previous.action <> p_action or previous.payload <> p_payload then
      raise exception 'Request ID reused' using errcode = 'PT422';
    end if;
    -- Minimal receipt only; never return a task projection in a blocked stage.
    return jsonb_build_object('request_id', p_request_id, 'replayed', true) ||
      case when task.status in ('backlog','por_hacer','haciendo') then jsonb_build_object('comment_id', previous.result -> 'comment_id') else '{}'::jsonb end;
  end if;
  if task.status not in ('backlog','por_hacer','haciendo') then
    raise exception 'Move manually to haciendo' using errcode = 'PT409';
  end if;
  if task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task changed; reload' using errcode = 'PT428';
  end if;
  if p_action = 'start_task' then
    if p_payload -> 'user_approved' is distinct from 'true'::jsonb
      or jsonb_typeof(p_payload -> 'context_summary') is distinct from 'string'
      or length(p_payload ->> 'context_summary') > 12000 or nullif(btrim(p_payload ->> 'context_summary'), '') is null then
      raise exception 'User approval and context required' using errcode = '22023';
    end if;
    if task.status <> 'haciendo' then
      update public.tasks set status = 'haciendo' where id = task.id returning * into task;
    end if;
  elsif p_action = 'comment_task' then
    if task.status <> 'haciendo' then raise exception 'Start first' using errcode = 'PT409'; end if;
    foreach field in array array['summary','changes','clarifications','validation','observations'] loop
      if jsonb_typeof(p_payload -> field) is distinct from 'string' or length(p_payload ->> field) > 12000
        or nullif(btrim(p_payload ->> field), '') is null then
        raise exception 'Detailed result required' using errcode = '22023';
      end if;
    end loop;
    select c.client_name into client_name from auth.oauth_clients c where c.id = client;
    insert into public.comments(task_id, author_id, body) values(task.id, auth.uid(),
      'Trabajo realizado mediante MCP' || E'\nCliente registrado (nombre no verificado): ' || coalesce(client_name, 'Sin nombre') ||
      ' [' || client::text || ']' || E'\nIntervención: ' || p_request_id::text ||
      E'\n\nResumen\n' || (p_payload ->> 'summary') || E'\n\nCambios realizados\n' || (p_payload ->> 'changes') ||
      E'\n\nAclaraciones y decisiones con el usuario\n' || (p_payload ->> 'clarifications') ||
      E'\n\nValidaciones y resultados\n' || (p_payload ->> 'validation') ||
      E'\n\nObservaciones, límites y pendientes\n' || (p_payload ->> 'observations')) returning id into comment_id;
  else
    if task.status <> 'haciendo' or p_payload -> 'user_validated' is distinct from 'true'::jsonb
      or not exists (select 1 from public.mcp_task_operations o join public.comments c
        on c.id::text = o.result ->> 'comment_id' and c.task_id = task.id
        where o.task_id = task.id and o.profile_id = auth.uid() and o.client_id = client
          and o.action = 'comment_task' and o.result ->> 'comment_id' = p_payload ->> 'comment_id'
          and (o.result ->> 'updated_at')::timestamptz = task.updated_at) then
      raise exception 'User validation and current result comment required' using errcode = '22023';
    end if;
    update public.tasks set status = 'en_revision' where id = task.id returning * into task;
  end if;
  result := jsonb_build_object('request_id', p_request_id, 'task_id', task.id, 'status', task.status,
    'updated_at', task.updated_at, 'comment_id', comment_id, 'replayed', false);
  insert into public.mcp_task_operations(task_id, profile_id, client_id, request_id, action, payload, result)
    values(task.id, auth.uid(), client, p_request_id, p_action, p_payload, result);
  return result;
end $$;
revoke all on function public.mcp_work_task(uuid, text, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_work_task(uuid, text, uuid, timestamptz, jsonb) to mcp_identity;

commit;
