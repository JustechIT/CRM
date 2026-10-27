-- Initial schema. Apply once to a fresh Supabase project via migrations.
begin;

create table public.employee_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 1 and 200),
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.departments (id text primary key, name text not null unique);
create table public.roles (id text primary key, name text not null unique);
create table public.permissions (id text primary key, description text not null);
create table public.role_permissions (
 role_id text references public.roles(id) on delete cascade,
 permission_id text references public.permissions(id) on delete cascade, primary key(role_id,permission_id)
);
create table public.user_roles (
 user_id uuid references public.employee_profiles(id) on delete cascade,
 role_id text references public.roles(id) on delete cascade, primary key(user_id,role_id)
);
create table public.user_departments (
 user_id uuid references public.employee_profiles(id) on delete cascade,
 department_id text references public.departments(id) on delete cascade, primary key(user_id,department_id)
);
create index user_roles_role_idx on public.user_roles(role_id);
create index user_departments_department_idx on public.user_departments(department_id);
create table public.accounts (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 2 and 200),
 institution_type text not null check(institution_type in ('University','Faculty','Research institution','Library','Other')),
 country text not null default '' check(length(country)<=100), city text not null default '' check(length(city)<=100),
 website text not null default '' check(website='' or website ~ '^https?://'),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=60),
 status text not null default 'Prospect' check(status in ('Prospect','Active','Inactive')),
 business text not null default 'Justech' check(business in ('Justech','Al-Fikr','Both')),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 notes text not null default '' check(length(notes)<=5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index accounts_name_idx on public.accounts(lower(name));
create index accounts_status_business_idx on public.accounts(status,business);
create index accounts_owner_idx on public.accounts(owner_id);
create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 first_name text not null check(length(trim(first_name)) between 1 and 100),
 last_name text not null check(length(trim(last_name)) between 1 and 100),
 job_title text not null default '' check(length(job_title)<=250), department text not null default '' check(length(department)<=250),
 email text not null default '' check(length(email)<=254), phone text not null default '' check(length(phone)<=60),
 account_id uuid not null references public.accounts(id) on delete restrict,
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 notes text not null default '' check(length(notes)<=5000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index contacts_account_email_unique on public.contacts(account_id,lower(email)) where email<>'';
create index contacts_account_idx on public.contacts(account_id);
create index contacts_owner_idx on public.contacts(owner_id);
create index contacts_name_idx on public.contacts(lower(last_name),lower(first_name));
create table public.user_preferences (
 user_id uuid primary key references public.employee_profiles(id) on delete cascade,
 pinned_pages text[] not null default '{}', theme text not null default 'light' check(theme in ('light','dark')),
 updated_at timestamptz not null default now()
);
create table public.activities (
 id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 250),
 account_id uuid references public.accounts(id) on delete set null,
 contact_id uuid references public.contacts(id) on delete set null,
 assigned_to uuid not null references public.employee_profiles(id) on delete restrict,
 due_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index activities_assignee_due_idx on public.activities(assigned_to,due_at);
create index activities_account_idx on public.activities(account_id);
create index activities_contact_idx on public.activities(contact_id);
create table public.audit_records (
 id bigint generated always as identity primary key,
 actor_id uuid, entity text not null, record_id uuid not null,
 action text not null check(action in ('INSERT','UPDATE','DELETE')), occurred_at timestamptz not null default now()
);
create index audit_entity_record_idx on public.audit_records(entity,record_id,occurred_at desc);

-- Definers only expose boolean capability results, never employee or credential data.
create function public.is_employee() returns boolean language sql stable security definer set search_path=''
 as $$ select exists(select 1 from public.employee_profiles where id=(select auth.uid()) and status='active'); $$;
create function public.has_permission(requested text) returns boolean language sql stable security definer set search_path=''
 as $$ select public.is_employee() and exists(
 select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
 where ur.user_id=(select auth.uid()) and rp.permission_id=requested); $$;
revoke all on function public.is_employee(), public.has_permission(text) from public;
grant execute on function public.is_employee(), public.has_permission(text) to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create function public.audit_business_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),tg_table_name,case when tg_op='DELETE' then old.id else new.id end,tg_op);
 if tg_op='DELETE' then return old; else return new; end if;
end; $$;
revoke all on function public.touch_updated_at(),public.audit_business_change() from public;
create trigger accounts_timestamp before update on public.accounts for each row execute function public.touch_updated_at();
create trigger contacts_timestamp before update on public.contacts for each row execute function public.touch_updated_at();
create trigger profiles_timestamp before update on public.employee_profiles for each row execute function public.touch_updated_at();
create trigger preferences_timestamp before update on public.user_preferences for each row execute function public.touch_updated_at();
create trigger activities_timestamp before update on public.activities for each row execute function public.touch_updated_at();
create trigger accounts_audit after insert or update or delete on public.accounts for each row execute function public.audit_business_change();
create trigger contacts_audit after insert or update or delete on public.contacts for each row execute function public.audit_business_change();

insert into public.departments values ('sales','Sales'),('marketing','Marketing'),('operations','Operations'),('training','Training'),('it','IT'),('management','Management');
insert into public.roles values ('administrator','Administrator'),('management','Management'),('sales','Sales'),('marketing','Marketing'),('operations','Operations'),('training','Training'),('it','IT');
insert into public.permissions values ('directory.read','Read shared institutions and contacts'),('directory.write','Create and edit shared institutions and contacts'),('directory.delete','Delete institutions and contacts'),('team.manage','Manage employees and assignments'),('audit.read','Read business audit metadata');
insert into public.role_permissions select 'administrator',id from public.permissions;
insert into public.role_permissions values ('management','directory.read'),('management','directory.write'),('management','audit.read'),('sales','directory.read'),('sales','directory.write'),('marketing','directory.read'),('operations','directory.read'),('operations','directory.write'),('training','directory.read'),('it','directory.read');

alter table public.employee_profiles enable row level security;
alter table public.departments enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_departments enable row level security;
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.user_preferences enable row level security;
alter table public.activities enable row level security;
alter table public.audit_records enable row level security;
-- Revoke Supabase default grants, then explicitly expose supported capabilities.
revoke all on public.employee_profiles,public.departments,public.roles,public.permissions,public.role_permissions,public.user_roles,public.user_departments,public.accounts,public.contacts,public.user_preferences,public.activities,public.audit_records from anon,authenticated;
grant select on public.employee_profiles,public.departments,public.roles,public.permissions,public.role_permissions,public.user_roles,public.user_departments,public.accounts,public.contacts,public.audit_records to authenticated;
grant insert(name,institution_type,country,city,website,email,phone,status,business,owner_id,notes),update(name,institution_type,country,city,website,email,phone,status,business,notes),delete on public.accounts to authenticated;
grant insert(first_name,last_name,job_title,department,email,phone,account_id,owner_id,notes),update(first_name,last_name,job_title,department,email,phone,account_id,notes),delete on public.contacts to authenticated;
grant select,insert,update,delete on public.user_preferences to authenticated;
-- No browser writes to employee, role, or department assignments, even for admins.
-- An audited administrator-only management service can be added separately.
create policy profiles_read on public.employee_profiles for select to authenticated using (public.is_employee());
create policy departments_read on public.departments for select to authenticated using (public.is_employee());
create policy roles_read on public.roles for select to authenticated using (public.is_employee());
create policy permissions_read on public.permissions for select to authenticated using (public.is_employee());
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.is_employee());
create policy user_roles_read on public.user_roles for select to authenticated using (user_id=(select auth.uid()) or public.has_permission('team.manage'));
create policy user_departments_read on public.user_departments for select to authenticated using (public.is_employee());
create policy accounts_read on public.accounts for select to authenticated using (public.has_permission('directory.read'));
create policy accounts_create on public.accounts for insert to authenticated with check (public.has_permission('directory.write') and owner_id=(select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated using (public.has_permission('directory.write')) with check (public.has_permission('directory.write'));
create policy accounts_delete on public.accounts for delete to authenticated using (public.has_permission('directory.delete'));
create policy contacts_read on public.contacts for select to authenticated using (public.has_permission('directory.read'));
create policy contacts_create on public.contacts for insert to authenticated with check (public.has_permission('directory.write') and owner_id=(select auth.uid()) and exists(select 1 from public.accounts where id=account_id));
create policy contacts_update on public.contacts for update to authenticated using (public.has_permission('directory.write')) with check (public.has_permission('directory.write') and exists(select 1 from public.accounts where id=account_id));
create policy contacts_delete on public.contacts for delete to authenticated using (public.has_permission('directory.delete'));
create policy own_preferences on public.user_preferences for all to authenticated using (user_id=(select auth.uid()) and public.is_employee()) with check (user_id=(select auth.uid()) and public.is_employee());
create policy audit_read on public.audit_records for select to authenticated using (public.has_permission('audit.read'));
-- Activities intentionally have no application grants or policies until their workflow is implemented.
commit;
