-- Staged Team administration. No initial user privileges or legacy role grants change.
begin;
insert into public.roles(id,name) values('super_admin','Super Admin'),('manager','Manager'),('employee','Employee'),('viewer','Viewer');
create table public.team_admin_principal(singleton boolean primary key default true check(singleton),user_id uuid unique not null references public.employee_profiles(id) on delete restrict,verified_email text not null,activated_at timestamptz,configured_at timestamptz not null default now());
create table public.team_user_settings(user_id uuid primary key references public.employee_profiles(id) on delete restrict,role_id text not null references public.roles(id),removed_at timestamptz,check(role_id in ('manager','employee','viewer')));
create table public.team_module_access(user_id uuid not null references public.employee_profiles(id) on delete restrict,module text not null check(module in ('directory','sales','marketing','operations','training','priorities','platform','events','alfikr-sales','alfikr-marketing','alfikr-content')),can_read boolean not null default false,can_write boolean not null default false,can_delete boolean not null default false,primary key(user_id,module),check((not can_write and not can_delete) or can_read));
create table public.team_invitations(id uuid primary key default gen_random_uuid(),email text not null,full_name text not null,department_id text not null references public.departments(id),role_id text not null check(role_id in ('manager','employee','viewer')),modules jsonb not null default '[]',supplier_access boolean not null default false,invited_by uuid not null references public.employee_profiles(id),status text not null default 'Pending' check(status in ('Pending','Accepted','Cancelled')),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',accepted_by uuid references public.employee_profiles(id),accepted_at timestamptz);
create unique index team_invitation_pending_email_idx on public.team_invitations(lower(email)) where status='Pending';
create function public.is_super_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.team_admin_principal p join public.employee_profiles e on e.id=p.user_id join auth.users u on u.id=p.user_id where p.user_id=(select auth.uid()) and p.activated_at is not null and e.status='active' and lower(u.email)=p.verified_email and u.email_confirmed_at is not null);$$;
create function public.configure_team_super_admin(target uuid,expected_email text) returns void language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.team_admin_principal) then raise exception 'The designated account is already configured';end if;
 if not exists(select 1 from auth.users u join public.employee_profiles e on e.id=u.id where u.id=target and lower(u.email)=lower(trim(expected_email)) and u.email_confirmed_at is not null and e.status='active') then raise exception 'Verify the configured confirmed authentication account and active employee first';end if;
 insert into public.team_admin_principal(user_id,verified_email) values(target,lower(trim(expected_email)));
end $$;
create function public.activate_team_super_admin() returns void language plpgsql security definer set search_path='' as $$declare target uuid;begin
 select user_id into target from public.team_admin_principal where singleton=true for update;
 if target is null or target is distinct from (select auth.uid()) or not exists(select 1 from auth.users u join public.employee_profiles e on e.id=u.id join public.team_admin_principal p on p.user_id=u.id where u.id=target and lower(u.email)=p.verified_email and u.email_confirmed_at is not null and e.status='active') then raise exception 'Sign in as the verified designated account' using errcode='42501';end if;
 update public.team_admin_principal set activated_at=coalesce(activated_at,now()) where user_id=target;
 insert into public.user_roles(user_id,role_id) values(target,'super_admin') on conflict do nothing;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'team_admin_principal',target,'UPDATE');
end $$;
create function public.team_admin_activation_ready() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.team_admin_principal p join auth.users u on u.id=p.user_id where p.user_id=(select auth.uid()) and p.activated_at is null and lower(u.email)=p.verified_email and u.email_confirmed_at is not null) and public.is_employee();$$;
revoke all on function public.is_super_admin(),public.configure_team_super_admin(uuid,text),public.activate_team_super_admin(),public.team_admin_activation_ready() from public;
grant execute on function public.is_super_admin(),public.activate_team_super_admin(),public.team_admin_activation_ready() to authenticated;
-- No execute grant for configure_team_super_admin: trusted SQL operator only.
create or replace function public.has_permission(requested text) returns boolean language plpgsql stable security definer set search_path='' as $$declare uid uuid:=auth.uid();r text;m text:=split_part(requested,'.',1);a text:=split_part(requested,'.',2);begin
 if not public.is_employee() then return false;end if;
 if public.is_super_admin() then return exists(select 1 from public.permissions where id=requested) or (m in ('alfikr-sales','alfikr-marketing','alfikr-content') and a in ('read','write','delete'));end if;
 select role_id into r from public.team_user_settings where user_id=uid and removed_at is null;
 if found then
  if requested='products.read' then return exists(select 1 from public.team_module_access where user_id=uid and module in ('sales','marketing','operations','training') and can_read);end if;
  return exists(select 1 from public.team_module_access where user_id=uid and module=m and case a when 'read' then can_read when 'write' then can_write and r<>'viewer' when 'delete' then can_delete and r<>'viewer' else false end);
 end if;
 -- Untouched employees retain their existing department permissions.
 return exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id where ur.user_id=uid and rp.permission_id=requested);
end $$;
create function public.team_record_write_allowed(assignee uuid,creator uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_employee() and (public.is_super_admin() or not exists(select 1 from public.team_user_settings where user_id=(select auth.uid())) or exists(select 1 from public.team_user_settings where user_id=(select auth.uid()) and removed_at is null and (role_id='manager' or (role_id='employee' and coalesce(assignee,creator)=(select auth.uid())))));$$;
revoke all on function public.team_record_write_allowed(uuid,uuid) from public;
grant execute on function public.team_record_write_allowed(uuid,uuid) to authenticated;
create policy assigned_insert on public.activities as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.activities as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.activities as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.it_projects as restrictive for insert to authenticated with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_update on public.it_projects as restrictive for update to authenticated using(public.team_record_write_allowed(responsible_id,owner_id)) with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_delete on public.it_projects as restrictive for delete to authenticated using(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_insert on public.it_issues as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.it_issues as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.it_issues as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.conference_contacts as restrictive for insert to authenticated with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_update on public.conference_contacts as restrictive for update to authenticated using(public.team_record_write_allowed(responsible_id,owner_id)) with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_delete on public.conference_contacts as restrictive for delete to authenticated using(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_insert on public.workspace_events as restrictive for insert to authenticated with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_update on public.workspace_events as restrictive for update to authenticated using(public.team_record_write_allowed(responsible_id,owner_id)) with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_delete on public.workspace_events as restrictive for delete to authenticated using(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_insert on public.operations_projects as restrictive for insert to authenticated with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_update on public.operations_projects as restrictive for update to authenticated using(public.team_record_write_allowed(responsible_id,owner_id)) with check(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_delete on public.operations_projects as restrictive for delete to authenticated using(public.team_record_write_allowed(responsible_id,owner_id));
create policy assigned_insert on public.operations_quality_checks as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.operations_quality_checks as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.operations_quality_checks as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.operations_followups as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.operations_followups as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.operations_followups as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.marketing_campaigns as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.marketing_campaigns as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.marketing_campaigns as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.marketing_content as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.marketing_content as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.marketing_content as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.marketing_assets as restrictive for insert to authenticated with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_update on public.marketing_assets as restrictive for update to authenticated using(public.team_record_write_allowed(assigned_to,owner_id)) with check(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_delete on public.marketing_assets as restrictive for delete to authenticated using(public.team_record_write_allowed(assigned_to,owner_id));
create policy assigned_insert on public.training_sessions as restrictive for insert to authenticated with check(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_update on public.training_sessions as restrictive for update to authenticated using(public.team_record_write_allowed(trainer_id,owner_id)) with check(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_delete on public.training_sessions as restrictive for delete to authenticated using(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_insert on public.training_registrations as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.training_registrations as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.training_registrations as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.training_history as restrictive for insert to authenticated with check(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_update on public.training_history as restrictive for update to authenticated using(public.team_record_write_allowed(trainer_id,owner_id)) with check(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_delete on public.training_history as restrictive for delete to authenticated using(public.team_record_write_allowed(trainer_id,owner_id));
create policy assigned_insert on public.sales_opportunities as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.sales_opportunities as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.sales_opportunities as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.sales_subscriptions as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.sales_subscriptions as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.sales_subscriptions as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.sales_quotations as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.sales_quotations as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.sales_quotations as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.sales_renewals as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.sales_renewals as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.sales_renewals as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.sales_payments as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.sales_payments as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.sales_payments as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.products as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.products as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.products as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.accounts as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.accounts as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.accounts as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy assigned_insert on public.contacts as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_update on public.contacts as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy assigned_delete on public.contacts as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create function public.team_apply_modules(target uuid,role_value text,module_values jsonb) returns void language plpgsql security definer set search_path='' as $$declare item jsonb;begin
 if role_value not in ('manager','employee','viewer') or jsonb_typeof(module_values)<>'array' or jsonb_array_length(module_values)>11 then raise exception 'Invalid role or modules';end if;
 delete from public.team_module_access where user_id=target;
 for item in select * from jsonb_array_elements(module_values) loop
  insert into public.team_module_access(user_id,module,can_read,can_write,can_delete) values(target,item->>'module',coalesce((item->>'read')::boolean,false),role_value<>'viewer' and coalesce((item->>'write')::boolean,false),role_value<>'viewer' and coalesce((item->>'delete')::boolean,false));
 end loop;
end $$;
revoke all on function public.team_apply_modules(uuid,text,jsonb) from public;
create function public.team_update_user(target uuid,person_name text,department_value text,role_value text,active boolean,module_values jsonb,private_invoices boolean,remove_user boolean default false) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 if target=(select auth.uid()) or exists(select 1 from public.team_admin_principal where user_id=target) then raise exception 'The Super Admin account is protected' using errcode='23514';end if;
 if length(trim(person_name)) not between 1 and 200 or not exists(select 1 from public.employee_profiles where id=target) then raise exception 'Invalid employee';end if;
 perform public.team_apply_modules(target,role_value,module_values);
 update public.employee_profiles set full_name=trim(person_name),status=case when active and not remove_user then 'active' else 'inactive' end where id=target;
 insert into public.team_user_settings(user_id,role_id,removed_at) values(target,role_value,case when remove_user then now() else null end) on conflict(user_id) do update set role_id=excluded.role_id,removed_at=excluded.removed_at;
 delete from public.user_roles where user_id=target;insert into public.user_roles values(target,role_value);
 delete from public.user_departments where user_id=target;insert into public.user_departments values(target,department_value);
 if private_invoices and not remove_user then insert into public.supplier_invoice_access(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;else delete from public.supplier_invoice_access where user_id=target;end if;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'team_user_settings',target,'UPDATE');
end $$;
create function public.team_create_invitation(person_email text,person_name text,department_value text,role_value text,module_values jsonb,private_invoices boolean) returns uuid language plpgsql security definer set search_path='' as $$declare result uuid;begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 if length(trim(person_name)) not between 1 and 200 or person_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or role_value not in ('manager','employee','viewer') or jsonb_typeof(module_values)<>'array' then raise exception 'Invalid invitation';end if;
 if exists(select 1 from auth.users u join public.employee_profiles e on e.id=u.id where lower(u.email)=lower(trim(person_email))) then raise exception 'Employee exists; edit the existing user';end if;
 -- Validate all module keys/booleans before sending any email.
 if exists(select 1 from jsonb_array_elements(module_values) v where v->>'module' not in ('directory','sales','marketing','operations','training','priorities','platform','events','alfikr-sales','alfikr-marketing','alfikr-content') or coalesce(v->>'read','false') not in ('true','false') or coalesce(v->>'write','false') not in ('true','false') or coalesce(v->>'delete','false') not in ('true','false')) then raise exception 'Invalid module permissions';end if;
 update public.team_invitations set status='Cancelled' where lower(email)=lower(trim(person_email)) and status='Pending' and expires_at<=now();
 insert into public.team_invitations(email,full_name,department_id,role_id,modules,supplier_access,invited_by) values(lower(trim(person_email)),trim(person_name),department_value,role_value,module_values,private_invoices,auth.uid()) returning id into result;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'team_invitations',result,'INSERT');return result;
end $$;
create function public.team_cancel_invitation(invitation uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 update public.team_invitations set status='Cancelled' where id=invitation and status='Pending';
end $$;
create function public.accept_crm_invitation() returns void language plpgsql security definer set search_path='' as $$declare i public.team_invitations;mail text;begin
 select lower(email) into mail from auth.users where id=(select auth.uid()) and email_confirmed_at is not null;
 if mail is null then raise exception 'A verified authenticated account is required' using errcode='42501';end if;
 select * into i from public.team_invitations where email=mail and status='Pending' and expires_at>now() for update;
 if not found then raise exception 'No pending invitation for this account';end if;
 if not exists(select 1 from public.team_admin_principal p join public.employee_profiles e on e.id=p.user_id join auth.users u on u.id=p.user_id where p.user_id=i.invited_by and p.activated_at is not null and e.status='active' and lower(u.email)=p.verified_email and u.email_confirmed_at is not null) then raise exception 'The invitation administrator is no longer active';end if;
 if exists(select 1 from public.employee_profiles where id=(select auth.uid())) then raise exception 'Employee already exists; ask the Super Admin to edit it';end if;
 insert into public.employee_profiles(id,full_name,status) values(auth.uid(),i.full_name,'active');
 insert into public.team_user_settings(user_id,role_id) values(auth.uid(),i.role_id);
 insert into public.user_roles values(auth.uid(),i.role_id);insert into public.user_departments values(auth.uid(),i.department_id);
 perform public.team_apply_modules(auth.uid(),i.role_id,i.modules);
 if i.supplier_access then insert into public.supplier_invoice_access(user_id,granted_by) values(auth.uid(),i.invited_by);end if;
 update public.team_invitations set status='Accepted',accepted_by=auth.uid(),accepted_at=now() where id=i.id;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'team_invitations',i.id,'UPDATE');
end $$;
create function public.team_users() returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 select coalesce(jsonb_agg(v order by v.full_name),'[]'::jsonb) into result from(select e.id,e.full_name,u.email,e.status,e.created_at as date_added,s.removed_at,
 case when p.user_id is not null then 'super_admin' else coalesce(s.role_id,'legacy') end as role_id,
 coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name)) from public.user_departments ud join public.departments d on d.id=ud.department_id where ud.user_id=e.id),'[]'::jsonb) as departments,
 coalesce((select string_agg(r.name,', ' order by r.name) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=e.id),'') as legacy_roles,
 coalesce((select jsonb_agg(jsonb_build_object('module',a.module,'read',a.can_read,'write',a.can_write,'delete',a.can_delete)) from public.team_module_access a where a.user_id=e.id),'[]'::jsonb) as modules,
 exists(select 1 from public.supplier_invoice_access a where a.user_id=e.id) as supplier_access
 from public.employee_profiles e join auth.users u on u.id=e.id left join public.team_user_settings s on s.user_id=e.id left join public.team_admin_principal p on p.user_id=e.id) v;return result;
end $$;
revoke all on function public.team_update_user(uuid,text,text,text,boolean,jsonb,boolean,boolean) from public;grant execute on function public.team_update_user(uuid,text,text,text,boolean,jsonb,boolean,boolean) to authenticated;
revoke all on function public.team_create_invitation(text,text,text,text,jsonb,boolean) from public;grant execute on function public.team_create_invitation(text,text,text,text,jsonb,boolean) to authenticated;
revoke all on function public.team_cancel_invitation(uuid) from public;grant execute on function public.team_cancel_invitation(uuid) to authenticated;
revoke all on function public.accept_crm_invitation() from public;grant execute on function public.accept_crm_invitation() to authenticated;
revoke all on function public.team_users() from public;grant execute on function public.team_users() to authenticated;
alter table public.team_admin_principal enable row level security;revoke all on public.team_admin_principal from anon,authenticated;grant select on public.team_admin_principal to authenticated;create policy team_read on public.team_admin_principal for select to authenticated using(public.is_super_admin());
alter table public.team_user_settings enable row level security;revoke all on public.team_user_settings from anon,authenticated;grant select on public.team_user_settings to authenticated;create policy team_read on public.team_user_settings for select to authenticated using(public.is_super_admin());
alter table public.team_module_access enable row level security;revoke all on public.team_module_access from anon,authenticated;grant select on public.team_module_access to authenticated;create policy team_read on public.team_module_access for select to authenticated using(public.is_super_admin());
alter table public.team_invitations enable row level security;revoke all on public.team_invitations from anon,authenticated;grant select on public.team_invitations to authenticated;create policy team_read on public.team_invitations for select to authenticated using(public.is_super_admin());
-- Preserve existing invoice grants. After verified activation only the designated Super Admin manages them.
create or replace function public.set_supplier_invoice_access(target uuid,allowed boolean) returns void language plpgsql security definer set search_path='' as $$begin
 lock table public.supplier_invoice_access in exclusive mode;
 if exists(select 1 from public.team_admin_principal where activated_at is not null) then
  if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 elsif not public.supplier_invoice_allowed(true) then raise exception 'Private invoice access manager required' using errcode='42501';end if;
 if target=(select auth.uid()) then raise exception 'Cannot grant or revoke your own permissions' using errcode='23514';end if;
 if allowed then
  if not exists(select 1 from public.employee_profiles where id=target and status='active') then raise exception 'Select an active employee';end if;
  insert into public.supplier_invoice_access(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;
 else delete from public.supplier_invoice_access where user_id=target;end if;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'supplier_invoice_access',target,case when allowed then 'INSERT' else 'DELETE' end);
end $$;
-- Only Super Admin can see team security audit entries.
alter policy audit_read on public.audit_records using((entity in ('team_admin_principal','team_user_settings','team_invitations') and public.is_super_admin()) or (entity not in ('team_admin_principal','team_user_settings','team_invitations','supplier_invoices','supplier_invoice_access') and public.has_permission('audit.read')) or (entity in ('supplier_invoices','supplier_invoice_access') and (public.supplier_invoice_allowed(true) or public.is_super_admin())));
create function public.crm_navigation_access() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('modules',coalesce((select jsonb_agg(m) from unnest(array['directory','sales','marketing','operations','training','priorities','platform','events','alfikr-sales','alfikr-marketing','alfikr-content']) m where public.has_permission(m||'.read')),'[]'::jsonb),'team',public.is_super_admin() or public.team_admin_activation_ready());$$;
revoke all on function public.crm_navigation_access() from public;grant execute on function public.crm_navigation_access() to authenticated;
create function public.supplier_invoice_can_write() returns boolean language sql stable security definer set search_path='' as $$select public.supplier_invoice_allowed() and (public.is_super_admin() or not exists(select 1 from public.team_user_settings where user_id=(select auth.uid())) or exists(select 1 from public.team_user_settings where user_id=(select auth.uid()) and removed_at is null and role_id in ('manager','employee')));$$;
revoke all on function public.supplier_invoice_can_write() from public;grant execute on function public.supplier_invoice_can_write() to authenticated;
create policy supplier_assigned_insert on public.supplier_invoices as restrictive for insert to authenticated with check(public.team_record_write_allowed(null,owner_id));
create policy supplier_assigned_update on public.supplier_invoices as restrictive for update to authenticated using(public.team_record_write_allowed(null,owner_id)) with check(public.team_record_write_allowed(null,owner_id));
create policy supplier_assigned_delete on public.supplier_invoices as restrictive for delete to authenticated using(public.team_record_write_allowed(null,owner_id));
create policy supplier_file_write_fence on storage.objects as restrictive for insert to authenticated with check(bucket_id<>'supplier-invoices' or (public.supplier_invoice_can_write() and exists(select 1 from public.supplier_invoices i where i.id::text=split_part(name,'/',1) and public.team_record_write_allowed(null,i.owner_id))));
create policy supplier_file_delete_fence on storage.objects as restrictive for delete to authenticated using(bucket_id<>'supplier-invoices' or (public.supplier_invoice_can_write() and (public.team_record_write_allowed(null,null) or exists(select 1 from public.supplier_invoices i where i.id::text=split_part(name,'/',1) and public.team_record_write_allowed(null,i.owner_id)) or (not exists(select 1 from public.supplier_invoices i where i.id::text=split_part(name,'/',1)) and to_jsonb(objects)->>'owner_id'=(select auth.uid())::text))));
commit;
