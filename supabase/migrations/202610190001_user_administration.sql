-- Existing installations: run this migration, NOT the complete bootstrap schema.
begin;

alter table public.profiles add column if not exists is_active boolean not null default true;

-- SECURITY DEFINER avoids recursive profiles RLS. Read live DB state, not JWT metadata.
create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_active);
$$;
revoke all on function public.is_active_account() from public;
grant execute on function public.is_active_account() to authenticated, anon;

-- Client profile edits must never promote roles or reactivate an account.
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, nickname) on public.profiles to authenticated;

drop policy if exists "Profiles are publicly readable" on public.profiles;
drop policy if exists "Account profile visibility" on public.profiles;
create policy "Account profile visibility" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_account());

-- Restrictive policies AND with existing permissive policies, including old sessions.
do $$
declare resource text;
begin
  foreach resource in array array['tasks', 'task_assignees', 'comments', 'task_attachments'] loop
    execute format('drop policy if exists "Active account required" on public.%I', resource);
    execute format('create policy "Active account required" on public.%I as restrictive for all to anon, authenticated using (public.is_active_account()) with check (public.is_active_account())', resource);
  end loop;
end $$;

drop policy if exists "Active profile writes" on public.profiles;
create policy "Active profile writes" on public.profiles as restrictive for update to authenticated
  using (public.is_active_account()) with check (public.is_active_account());
drop policy if exists "Active profile visibility" on public.profiles;
create policy "Active profile visibility" on public.profiles as restrictive for select to anon, authenticated
  using (id = auth.uid() or public.is_active_account());

drop policy if exists "Active storage reads" on storage.objects;
create policy "Active storage reads" on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or bucket_id = 'avatars' or public.is_active_account());
drop policy if exists "Active storage inserts" on storage.objects;
create policy "Active storage inserts" on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());
drop policy if exists "Active storage updates" on storage.objects;
create policy "Active storage updates" on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account())
  with check (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());
drop policy if exists "Active storage deletes" on storage.objects;
create policy "Active storage deletes" on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id not in ('avatars', 'task-attachments') or public.is_active_account());

-- Owner-executed views must not bypass the new RLS gates.
alter view public.tasks_with_assignees set (security_invoker = true);
alter view public.tasks_with_stats set (security_invoker = true);

commit;
