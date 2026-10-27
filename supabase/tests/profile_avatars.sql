-- Run after 202610260003_profile_avatars.sql. All fixtures are rolled back.
begin;

select set_config('app.avatar_admin', gen_random_uuid()::text, true);
select set_config('app.avatar_user', gen_random_uuid()::text, true);
insert into auth.users(id, email, raw_user_meta_data)
select id, id::text || '@example.test', '{"full_name":"Avatar probe"}'::jsonb
from unnest(array[current_setting('app.avatar_admin')::uuid, current_setting('app.avatar_user')::uuid]) ids(id);
update public.profiles set role = 'admin' where id = current_setting('app.avatar_admin')::uuid;

do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'avatars' and public and file_size_limit = 2097152
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then raise exception 'Avatar bucket limits or public visibility are incorrect'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('app.avatar_admin'), 'role', 'authenticated'
)::text, true);
set local role authenticated;

insert into storage.objects(bucket_id, name) values
  ('avatars', current_setting('app.avatar_admin') || '/avatar'),
  ('avatars', current_setting('app.avatar_user') || '/avatar');
update public.profiles set avatar_url = 'https://example.test/avatar/admin'
  where id = current_setting('app.avatar_user')::uuid;
do $$ begin
  if not exists (select 1 from public.profiles where id = current_setting('app.avatar_user')::uuid
    and avatar_url = 'https://example.test/avatar/admin') then
    raise exception 'Admin cannot set another user avatar';
  end if;
end $$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('app.avatar_user'), 'role', 'authenticated'
)::text, true);
insert into storage.objects(bucket_id, name) values
  ('avatars', current_setting('app.avatar_user') || '/self-avatar');
update public.profiles set avatar_url = 'https://example.test/avatar/self'
  where id = current_setting('app.avatar_user')::uuid;
update storage.objects set metadata = '{}'::jsonb
  where bucket_id = 'avatars' and name = current_setting('app.avatar_user') || '/self-avatar';
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'avatars'
    and name = current_setting('app.avatar_user') || '/self-avatar' and metadata = '{}'::jsonb) then
    raise exception 'User cannot replace their own avatar';
  end if;

  update public.profiles set avatar_url = 'https://example.test/avatar/unauthorized'
    where id = current_setting('app.avatar_admin')::uuid;
  if found then raise exception 'User can change another profile avatar'; end if;

  update storage.objects set metadata = '{}'::jsonb
    where bucket_id = 'avatars' and name = current_setting('app.avatar_admin') || '/avatar';
  if found then raise exception 'User can replace another profile avatar object'; end if;

  begin
    insert into storage.objects(bucket_id, name)
      values('avatars', current_setting('app.avatar_admin') || '/user-upload');
    raise exception 'User can upload into another profile folder';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
rollback;
select 'PASS: avatar bucket limits, owner/admin writes and cross-profile denial; fixtures rolled back' as verification;
