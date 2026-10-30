-- ONLY for a disposable plain PostgreSQL test database, NEVER a Supabase project.
-- Minimal Auth/Storage stand-ins; this does not simulate the actual services.
do $$ declare role_name text; begin
  foreach role_name in array array['anon','authenticated','service_role','authenticator','supabase_auth_admin'] loop
    if not exists(select 1 from pg_roles where rolname = role_name) then
      execute format('create role %I nologin', role_name);
    end if;
  end loop;
end $$;
create schema auth;
create schema storage;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create type auth.oauth_client_type as enum ('public', 'confidential');
create type auth.oauth_registration_type as enum ('dynamic', 'manual');
create table auth.oauth_clients (
  id uuid primary key, client_name text, redirect_uris text, grant_types text,
  client_type auth.oauth_client_type, token_endpoint_auth_method text,
  registration_type auth.oauth_registration_type, client_secret_hash text,
  created_at timestamptz, updated_at timestamptz
);
create table auth.sessions (id uuid primary key, user_id uuid references auth.users, oauth_client_id uuid references auth.oauth_clients, not_after timestamptz);
create table auth.oauth_consents (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade,
  client_id uuid references auth.oauth_clients on delete cascade, scopes text not null default 'email profile', granted_at timestamptz not null default now(), revoked_at timestamptz,
  unique(user_id, client_id));
create table auth.oauth_authorizations (id uuid primary key default gen_random_uuid(), authorization_id text unique not null,
  user_id uuid references auth.users, client_id uuid references auth.oauth_clients, status text default 'pending',
  expires_at timestamptz not null default now() + interval '3 minutes',
  redirect_uri text default 'https://example.test/callback', scope text default 'email profile');
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt() ->> 'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt() ->> 'role' $$;
grant usage on schema auth, storage to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid());
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1] $$;
