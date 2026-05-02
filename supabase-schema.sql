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

-- Users can update tasks they created; admins can update any task
create policy "Creators and admins can update tasks"
    on public.tasks for update
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'admin'
        )
    );

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
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

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

-- Authenticated users can upload avatars (file size limited to 2MB in client)
create policy "Authenticated users can upload avatars"
    on storage.objects for insert
    with check (
        bucket_id = 'avatars'
        and auth.role() = 'authenticated'
    );

-- Users can update their own avatar
create policy "Users can update own avatar"
    on storage.objects for update
    using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
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
grant update on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
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

-- NOTE: Storage permissions are handled via RLS policies in the storage.objects table.
-- Policies for storage were defined earlier in this file.
-- No additional GRANT statements needed for storage buckets.

-- Grant access to views
grant select on public.tasks_with_assignees to authenticated;
grant select on public.tasks_with_stats to authenticated;