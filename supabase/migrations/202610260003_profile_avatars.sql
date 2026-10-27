-- Apply after the existing user-administration and board migrations.
-- The avatar bucket stays public, but only its owner or an active admin can write.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
drop policy if exists "Avatar owners and admins can upload" on storage.objects;
create policy "Avatar owners and admins can upload"
  on storage.objects for insert to authenticated
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

drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Avatar owners and admins can update" on storage.objects;
create policy "Avatar owners and admins can update"
  on storage.objects for update to authenticated
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

commit;
