-- Justech Operations; extend existing activities for scoped tasks, not a second task store.
begin;
insert into public.permissions values ('operations.read','Read Justech operations'),('operations.write','Create and edit Justech operations'),('operations.delete','Delete Justech operations');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p
 where (r.id in ('administrator','management','operations') and p.id in ('operations.read','operations.write')) or (r.id='administrator' and p.id='operations.delete');
create table public.operations_projects (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
name text not null check(length(trim(name)) between 1 and 200),objective text not null check(length(trim(objective)) between 1 and 5000),responsible_id uuid not null references public.employee_profiles(id) on delete restrict,deadline date not null,status text not null check(status in ('Planned','Active','On hold','Completed','Cancelled'))
);
create table public.operations_quality_checks (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
name text not null check(length(trim(name)) between 1 and 200),project_id uuid references public.operations_projects(id) on delete restrict,area text not null default '' check(length(area)<=200),assigned_to uuid not null references public.employee_profiles(id) on delete restrict,result text not null check(result in ('Pending','Passed','Needs changes','Failed')),status text not null check(status in ('Pending','In progress','Completed','Cancelled')),check((project_id is not null and length(trim(area))=0) or (project_id is null and length(trim(area))>0))
);
create table public.operations_followups (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
subject text not null check(length(trim(subject)) between 1 and 200),account_id uuid references public.accounts(id) on delete restrict,contact_id uuid references public.contacts(id) on delete restrict,last_contact date,next_action text not null check(length(trim(next_action)) between 1 and 500),follow_up_date date not null,status text not null check(status in ('Open','In progress','Completed','Cancelled')),check((account_id is not null)::integer+(contact_id is not null)::integer=1),check(last_contact is null or follow_up_date>=last_contact)
);
alter table public.activities add column department text,add column project_id uuid references public.operations_projects(id) on delete restrict,add column area text not null default '',add column status text not null default 'Open',add column owner_id uuid references public.employee_profiles(id) on delete restrict,add column revision integer not null default 1;
alter table public.activities add constraint operations_task_fields check(department is distinct from 'operations' or (owner_id is not null and due_at is not null and revision>0 and length(trim(title)) between 1 and 200 and length(area)<=200 and status in ('Open','In progress','Blocked','Completed','Cancelled') and ((project_id is not null and length(trim(area))=0) or (project_id is null and length(trim(area))>0))));
-- Pre-existing unscoped activities stay invisible and cannot be mutated by Operations policies.
grant select,delete on public.activities to authenticated;
grant insert(title,assigned_to,due_at,project_id,area,status,owner_id,department),update(title,assigned_to,due_at,project_id,area,status) on public.activities to authenticated;
create policy operations_read on public.activities for select to authenticated using(department='operations' and public.has_permission('operations.read'));
create policy operations_insert on public.activities for insert to authenticated with check(department='operations' and public.has_permission('operations.write') and owner_id=(select auth.uid()));
create policy operations_update on public.activities for update to authenticated using(department='operations' and public.has_permission('operations.write')) with check(department='operations' and public.has_permission('operations.write'));
create policy operations_delete on public.activities for delete to authenticated using(department='operations' and public.has_permission('operations.delete'));
create trigger operations_task_revision before update on public.activities for each row when (old.department='operations') execute function public.sales_touch_revision();
-- Keep the existing activities completion timestamp consistent with Operations status.
create function public.operations_task_completion() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='Completed' then
  if tg_op='INSERT' then new.completed_at=now();
  elsif old.status<>'Completed' then new.completed_at=now();
  else new.completed_at=old.completed_at;end if;
 else new.completed_at=null;end if;
 return new;
end; $$;
revoke all on function public.operations_task_completion() from public;
create trigger operations_task_completed before insert or update on public.activities for each row when (new.department='operations') execute function public.operations_task_completion();
create function public.operations_activity_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='DELETE' and old.department='operations') or (tg_op<>'DELETE' and new.department='operations') then
  insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'operations_tasks',case when tg_op='DELETE' then old.id else new.id end,tg_op);
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end; $$;
revoke all on function public.operations_activity_audit() from public;
create trigger operations_task_audit after insert or update or delete on public.activities for each row execute function public.operations_activity_audit();
create trigger operations_task_references before insert or update on public.activities for each row when (new.department='operations') execute function public.department_reference_guard();
create index activities_operations_due_idx on public.activities(department,due_at,status);
create index activities_operations_project_idx on public.activities(project_id);
create index activities_operations_owner_idx on public.activities(owner_id);
alter table public.operations_projects enable row level security;
revoke all on public.operations_projects from anon,authenticated;
grant select,delete on public.operations_projects to authenticated;
grant insert(name,objective,responsible_id,deadline,status,owner_id),update(name,objective,responsible_id,deadline,status) on public.operations_projects to authenticated;
create policy department_read on public.operations_projects for select to authenticated using(public.has_permission('operations.read'));
create policy department_insert on public.operations_projects for insert to authenticated with check(public.has_permission('operations.write') and owner_id=(select auth.uid()));
create policy department_update on public.operations_projects for update to authenticated using(public.has_permission('operations.write')) with check(public.has_permission('operations.write'));
create policy department_delete on public.operations_projects for delete to authenticated using(public.has_permission('operations.delete'));
create trigger department_revision before update on public.operations_projects for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.operations_projects for each row execute function public.audit_business_change();
create index operations_projects_owner_idx on public.operations_projects(owner_id);
create trigger department_references before insert or update on public.operations_projects for each row execute function public.department_reference_guard();
alter table public.operations_quality_checks enable row level security;
revoke all on public.operations_quality_checks from anon,authenticated;
grant select,delete on public.operations_quality_checks to authenticated;
grant insert(name,project_id,area,assigned_to,result,status,owner_id),update(name,project_id,area,assigned_to,result,status) on public.operations_quality_checks to authenticated;
create policy department_read on public.operations_quality_checks for select to authenticated using(public.has_permission('operations.read'));
create policy department_insert on public.operations_quality_checks for insert to authenticated with check(public.has_permission('operations.write') and owner_id=(select auth.uid()));
create policy department_update on public.operations_quality_checks for update to authenticated using(public.has_permission('operations.write')) with check(public.has_permission('operations.write'));
create policy department_delete on public.operations_quality_checks for delete to authenticated using(public.has_permission('operations.delete'));
create trigger department_revision before update on public.operations_quality_checks for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.operations_quality_checks for each row execute function public.audit_business_change();
create index operations_quality_checks_owner_idx on public.operations_quality_checks(owner_id);
create trigger department_references before insert or update on public.operations_quality_checks for each row execute function public.department_reference_guard();
alter table public.operations_followups enable row level security;
revoke all on public.operations_followups from anon,authenticated;
grant select,delete on public.operations_followups to authenticated;
grant insert(subject,account_id,contact_id,last_contact,next_action,follow_up_date,status,owner_id),update(subject,account_id,contact_id,last_contact,next_action,follow_up_date,status) on public.operations_followups to authenticated;
create policy department_read on public.operations_followups for select to authenticated using(public.has_permission('operations.read'));
create policy department_insert on public.operations_followups for insert to authenticated with check(public.has_permission('operations.write') and owner_id=(select auth.uid()));
create policy department_update on public.operations_followups for update to authenticated using(public.has_permission('operations.write')) with check(public.has_permission('operations.write'));
create policy department_delete on public.operations_followups for delete to authenticated using(public.has_permission('operations.delete'));
create trigger department_revision before update on public.operations_followups for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.operations_followups for each row execute function public.audit_business_change();
create index operations_followups_owner_idx on public.operations_followups(owner_id);
create trigger department_references before insert or update on public.operations_followups for each row execute function public.department_reference_guard();
create function public.operations_project_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.project_id is not null and not exists(select 1 from public.operations_projects where id=new.project_id) then raise exception 'Choose an accessible project' using errcode='23514';end if;return new;
end; $$;
revoke all on function public.operations_project_guard() from public;
create trigger operations_task_project before insert or update on public.activities for each row when (new.department='operations') execute function public.operations_project_guard();
create trigger operations_quality_project before insert or update on public.operations_quality_checks for each row execute function public.operations_project_guard();
create view public.department_contact_choices with (security_invoker=true) as select c.id,concat_ws(' ',c.first_name,c.last_name,'·',a.name) as name from public.contacts c left join public.accounts a on a.id=c.account_id;
revoke all on public.department_contact_choices from anon,authenticated;grant select on public.department_contact_choices to authenticated;
create view public.operations_tasks_list with(security_invoker=true) as
 select r.*,e.full_name as assigned_to_label,p.name as project_id_label,coalesce(p.name,r.area) as project_area_label,concat_ws(' ',r.title,e.full_name,p.name,r.area,r.due_at,r.status) as search_text
 from public.activities r left join public.employee_profiles e on e.id=r.assigned_to left join public.operations_projects p on p.id=r.project_id where r.department='operations';
revoke all on public.operations_tasks_list from anon,authenticated;grant select on public.operations_tasks_list to authenticated;
create view public.operations_projects_list with (security_invoker=true) as
 select r.*,e.full_name as responsible_id_label,concat_ws(' ',r.name,r.objective,e.full_name,r.deadline,r.status) as search_text
 from public.operations_projects r left join public.employee_profiles e on e.id=r.responsible_id;
revoke all on public.operations_projects_list from anon,authenticated;
grant select on public.operations_projects_list to authenticated;
create view public.operations_quality_checks_list with (security_invoker=true) as
 select r.*,e.full_name as assigned_to_label,p.name as project_id_label,coalesce(p.name,r.area) as project_area_label,concat_ws(' ',r.name,p.name,r.area,e.full_name,r.result,r.status) as search_text
 from public.operations_quality_checks r left join public.employee_profiles e on e.id=r.assigned_to left join public.operations_projects p on p.id=r.project_id;
revoke all on public.operations_quality_checks_list from anon,authenticated;
grant select on public.operations_quality_checks_list to authenticated;
create view public.operations_followups_list with (security_invoker=true) as
 select r.*,coalesce(a.name,c.name) as party_label,concat_ws(' ',r.subject,a.name,c.name,r.last_contact,r.next_action,r.follow_up_date,r.status) as search_text
 from public.operations_followups r left join public.accounts a on a.id=r.account_id left join public.department_contact_choices c on c.id=r.contact_id;
revoke all on public.operations_followups_list from anon,authenticated;
grant select on public.operations_followups_list to authenticated;
create index operations_projects_responsible_id_idx on public.operations_projects(responsible_id);
create index operations_quality_checks_assigned_to_idx on public.operations_quality_checks(assigned_to);
create index operations_quality_checks_project_id_idx on public.operations_quality_checks(project_id);
create index operations_followups_account_id_idx on public.operations_followups(account_id);
create index operations_followups_contact_id_idx on public.operations_followups(contact_id);
create index operations_followups_date_idx on public.operations_followups(follow_up_date,status);
create or replace function public.department_overview(module text,as_of date default current_date) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if module not in ('marketing','operations','training') then raise exception 'Invalid department' using errcode='22023';end if;
 if not public.has_permission(module||'.read') then raise exception 'Department access required' using errcode='42501';end if;
 if module='marketing' then return jsonb_build_object(
'active_campaigns',(select count(*) from public.marketing_campaigns where status='Active' and start_date<=as_of and end_date>=as_of),
'scheduled_content',(select count(*) from public.marketing_content where status='Scheduled'),
'content_awaiting_approval',(select count(*) from public.marketing_content where status='Awaiting approval'),
'assets_in_progress',(select count(*) from public.marketing_assets where status='In progress'),
'upcoming_campaigns',(select count(*) from public.marketing_campaigns where status not in ('Completed','Cancelled') and start_date>as_of and start_date<=as_of+30),
'overdue_content',(select count(*) from public.marketing_content where status not in ('Published','Cancelled') and publish_date<as_of)
);end if;
if module='operations' then return jsonb_build_object(
 'total_tasks',(select count(*) from public.activities where department='operations'),
 'open_tasks',(select count(*) from public.activities where department='operations' and status not in ('Completed','Cancelled')),
 'active_projects',(select count(*) from public.operations_projects where status='Active'),
 'pending_quality_checks',(select count(*) from public.operations_quality_checks where status not in ('Completed','Cancelled')),
 'upcoming_followups',(select count(*) from public.operations_followups where status not in ('Completed','Cancelled') and follow_up_date between as_of and as_of+30),
 'overdue_followups',(select count(*) from public.operations_followups where status not in ('Completed','Cancelled') and follow_up_date<as_of)
);end if;
 raise exception 'Department is not installed' using errcode='22023';
end; $$;
revoke all on function public.department_overview(text,date) from public;
grant execute on function public.department_overview(text,date) to authenticated;
commit;
