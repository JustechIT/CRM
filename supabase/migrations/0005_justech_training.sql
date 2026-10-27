-- Justech Training: canonical sessions, registrations and delivered-history records.
begin;
insert into public.permissions values ('training.read','Read Justech training'),('training.write','Create and edit Justech training'),('training.delete','Delete Justech training');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p
 where (r.id in ('administrator','management','training') and p.id in ('training.read','training.write')) or (r.id='administrator' and p.id='training.delete');
insert into public.role_permissions values ('training','products.read');
create table public.training_sessions (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
name text not null check(length(trim(name)) between 1 and 200),product_id uuid not null references public.products(id) on delete restrict,trainer_id uuid not null references public.employee_profiles(id) on delete restrict,date date not null,format text not null check(format in ('Online','In person','Hybrid')),status text not null check(status in ('Draft','Scheduled','Completed','Cancelled'))
);
create table public.training_registrations (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
participant_name text not null check(length(trim(participant_name)) between 1 and 200),account_id uuid not null references public.accounts(id) on delete restrict,session_id uuid not null references public.training_sessions(id) on delete restrict,email text not null check(length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),registration_status text not null check(registration_status in ('Pending','Confirmed','Attended','Cancelled')),contact_id uuid references public.contacts(id) on delete set null
);
create table public.training_history (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
session_id uuid not null references public.training_sessions(id) on delete restrict,account_id uuid not null references public.accounts(id) on delete restrict,date date not null,participants integer not null check(participants>=0),trainer_id uuid not null references public.employee_profiles(id) on delete restrict,outcome text not null check(length(trim(outcome)) between 1 and 5000),unique(session_id,account_id,date)
);
create unique index training_registration_email_idx on public.training_registrations(session_id,lower(trim(email)));
alter table public.training_sessions enable row level security;
revoke all on public.training_sessions from anon,authenticated;
grant select,delete on public.training_sessions to authenticated;
grant insert(name,product_id,trainer_id,date,format,status,owner_id),update(name,product_id,trainer_id,date,format,status) on public.training_sessions to authenticated;
create policy department_read on public.training_sessions for select to authenticated using(public.has_permission('training.read'));
create policy department_insert on public.training_sessions for insert to authenticated with check(public.has_permission('training.write') and owner_id=(select auth.uid()));
create policy department_update on public.training_sessions for update to authenticated using(public.has_permission('training.write')) with check(public.has_permission('training.write'));
create policy department_delete on public.training_sessions for delete to authenticated using(public.has_permission('training.delete'));
create trigger department_revision before update on public.training_sessions for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.training_sessions for each row execute function public.audit_business_change();
create index training_sessions_owner_idx on public.training_sessions(owner_id);
create trigger department_references before insert or update on public.training_sessions for each row execute function public.department_reference_guard();
alter table public.training_registrations enable row level security;
revoke all on public.training_registrations from anon,authenticated;
grant select,delete on public.training_registrations to authenticated;
grant insert(participant_name,account_id,session_id,email,registration_status,contact_id,owner_id),update(participant_name,account_id,session_id,email,registration_status,contact_id) on public.training_registrations to authenticated;
create policy department_read on public.training_registrations for select to authenticated using(public.has_permission('training.read'));
create policy department_insert on public.training_registrations for insert to authenticated with check(public.has_permission('training.write') and owner_id=(select auth.uid()));
create policy department_update on public.training_registrations for update to authenticated using(public.has_permission('training.write')) with check(public.has_permission('training.write'));
create policy department_delete on public.training_registrations for delete to authenticated using(public.has_permission('training.delete'));
create trigger department_revision before update on public.training_registrations for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.training_registrations for each row execute function public.audit_business_change();
create index training_registrations_owner_idx on public.training_registrations(owner_id);
create trigger department_references before insert or update on public.training_registrations for each row execute function public.department_reference_guard();
alter table public.training_history enable row level security;
revoke all on public.training_history from anon,authenticated;
grant select,delete on public.training_history to authenticated;
grant insert(session_id,account_id,date,participants,trainer_id,outcome,owner_id),update(session_id,account_id,date,participants,trainer_id,outcome) on public.training_history to authenticated;
create policy department_read on public.training_history for select to authenticated using(public.has_permission('training.read'));
create policy department_insert on public.training_history for insert to authenticated with check(public.has_permission('training.write') and owner_id=(select auth.uid()));
create policy department_update on public.training_history for update to authenticated using(public.has_permission('training.write')) with check(public.has_permission('training.write'));
create policy department_delete on public.training_history for delete to authenticated using(public.has_permission('training.delete'));
create trigger department_revision before update on public.training_history for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.training_history for each row execute function public.audit_business_change();
create index training_history_owner_idx on public.training_history(owner_id);
create trigger department_references before insert or update on public.training_history for each row execute function public.department_reference_guard();
create function public.training_relationship_guard() returns trigger language plpgsql set search_path='' as $$
declare session_status text;
begin
 if tg_table_name='training_sessions' then
  if new.status<>'Completed' and exists(select 1 from public.training_history where session_id=old.id) then raise exception 'History exists for this completed session' using errcode='23514';end if;
 else
  if tg_op='INSERT' or new.session_id is distinct from old.session_id or tg_table_name='training_history' then
   select status into session_status from public.training_sessions where id=new.session_id for share;
   if session_status is null then raise exception 'Choose an accessible session' using errcode='23514';end if;
   if tg_table_name='training_history' and session_status<>'Completed' then raise exception 'History requires a completed session' using errcode='23514';end if;
   if tg_table_name='training_registrations' and session_status='Cancelled' then raise exception 'Cancelled sessions cannot accept registrations' using errcode='23514';end if;
  end if;
  if tg_table_name='training_registrations' then
   if new.contact_id is not null and not exists(select 1 from public.contacts where id=new.contact_id and account_id=new.account_id) then raise exception 'Contact does not belong to the selected institution' using errcode='23514';end if;
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.training_relationship_guard() from public;
create trigger training_session_history before update on public.training_sessions for each row execute function public.training_relationship_guard();
create trigger training_registration_session before insert or update on public.training_registrations for each row execute function public.training_relationship_guard();
create trigger training_history_session before insert or update on public.training_history for each row execute function public.training_relationship_guard();
create view public.training_sessions_list with (security_invoker=true) as
 select r.*,p.name as product_id_label,e.full_name as trainer_id_label,concat_ws(' ',r.name,p.name,e.full_name,r.date,r.format,r.status) as search_text
 from public.training_sessions r left join public.products p on p.id=r.product_id left join public.employee_profiles e on e.id=r.trainer_id;
revoke all on public.training_sessions_list from anon,authenticated;
grant select on public.training_sessions_list to authenticated;
create view public.training_registrations_list with (security_invoker=true) as
 select r.*,a.name as account_id_label,s.name as session_id_label,concat_ws(' ',r.participant_name,a.name,s.name,r.email,r.registration_status) as search_text
 from public.training_registrations r left join public.accounts a on a.id=r.account_id left join public.training_sessions s on s.id=r.session_id;
revoke all on public.training_registrations_list from anon,authenticated;
grant select on public.training_registrations_list to authenticated;
create view public.training_history_list with (security_invoker=true) as
 select r.*,s.name as session_id_label,a.name as account_id_label,e.full_name as trainer_id_label,concat_ws(' ',s.name,a.name,r.date,r.participants,e.full_name,r.outcome) as search_text
 from public.training_history r left join public.training_sessions s on s.id=r.session_id left join public.accounts a on a.id=r.account_id left join public.employee_profiles e on e.id=r.trainer_id;
revoke all on public.training_history_list from anon,authenticated;
grant select on public.training_history_list to authenticated;
create index training_sessions_product_id_idx on public.training_sessions(product_id);
create index training_sessions_trainer_id_idx on public.training_sessions(trainer_id);
create index training_registrations_account_id_idx on public.training_registrations(account_id);
create index training_registrations_session_id_idx on public.training_registrations(session_id);
create index training_registrations_contact_id_idx on public.training_registrations(contact_id);
create index training_history_account_id_idx on public.training_history(account_id);
create index training_history_session_id_idx on public.training_history(session_id);
create index training_history_trainer_id_idx on public.training_history(trainer_id);
create index training_sessions_dates_idx on public.training_sessions(date,status);
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
if module='training' then return jsonb_build_object(
 'total_sessions',(select count(*) from public.training_sessions),
 'upcoming_sessions',(select count(*) from public.training_sessions where date>=as_of and status='Scheduled'),
 'completed_sessions',(select count(*) from public.training_sessions where status='Completed'),
 'total_registrations',(select count(*) from public.training_registrations),
 'pending_registrations',(select count(*) from public.training_registrations where registration_status='Pending'),
 'training_history',(select count(*) from public.training_history)
);end if;
 raise exception 'Department is not installed' using errcode='22023';
end; $$;
revoke all on function public.department_overview(text,date) from public;
grant execute on function public.department_overview(text,date) to authenticated;
commit;
