-- ONLY disposable harness: existing grants before the unified migration.
insert into auth.users(id,email) values('10000000-0000-0000-0000-000000000001','existing@example.test');
insert into auth.oauth_clients(id,client_name)
select ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,'Existing fixture' from generate_series(1,7) n;
insert into auth.oauth_consents(id,user_id,client_id,granted_at,revoked_at)
select ('30000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,'10000000-0000-0000-0000-000000000001',
  ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,now()-interval '1 day',
  case when n=4 then now() else null end from generate_series(1,7) n;
-- Partial/withdrawn app grants are existing connections; identity-only is not.
insert into public.mcp_workflow_permissions(consent_id,profile_id,client_id,consent_granted_at,permissions)
select id,user_id,client_id,case when right(client_id::text,1) in ('5','7') then granted_at-interval '1 day' else granted_at end,
  case when right(client_id::text,1)='2' then '{}'::text[] else array['read_tasks'] end
from auth.oauth_consents where right(client_id::text,1) in ('1','2','4','5','7');
insert into auth.sessions(id,user_id,oauth_client_id)
values('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007');
insert into public.mcp_task_read_permissions(session_id,profile_id,client_id)
values('40000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000007');
