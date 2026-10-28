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
