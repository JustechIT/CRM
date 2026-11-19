begin;

-- Name-only contacts can be linked to an organization later.
alter table public.contacts alter column account_id drop not null;
alter table public.contacts drop constraint contacts_last_name_check;
alter table public.contacts add constraint contacts_last_name_check check(length(trim(last_name)) <= 200);
alter table public.contacts drop constraint contacts_first_name_check;
alter table public.contacts add constraint contacts_first_name_check check(length(trim(first_name)) between 1 and 200);
alter table public.accounts drop constraint accounts_name_check;
alter table public.accounts add constraint accounts_name_check check(length(trim(name)) between 1 and 250);
alter table public.accounts add column address text not null default '' check(length(address) <= 250);
alter table public.contacts add column address text not null default '' check(length(address) <= 250);
grant insert(address),update(address) on public.accounts,public.contacts to authenticated;
-- A volatile invoker check can see an account created earlier by the same
-- statement's trigger. Account visibility still uses the caller's RLS.
create function public.directory_account_visible(account uuid) returns boolean
language sql volatile set search_path='' as $$
 select exists(select 1 from public.accounts where id=account);
$$;
revoke all on function public.directory_account_visible(uuid) from public;
grant execute on function public.directory_account_visible(uuid) to authenticated;

alter policy contacts_create on public.contacts with check (
 public.has_permission('directory.write') and owner_id=(select auth.uid())
 and (account_id is null or public.directory_account_visible(account_id)));
alter policy contacts_update on public.contacts with check (
 public.has_permission('directory.write') and (account_id is null or public.directory_account_visible(account_id)));

alter policy sales_insert on public.sales_opportunities with check (
 public.has_permission('sales.write') and owner_id=(select auth.uid())
 and (account_id is null or public.directory_account_visible(account_id)));
alter policy sales_update on public.sales_opportunities with check (
 public.has_permission('sales.write') and (account_id is null or public.directory_account_visible(account_id)));

do $$
declare t text;
begin
 foreach t in array array['sales_subscriptions','sales_renewals'] loop
  execute format('alter policy sales_insert on public.%I with check (
   public.has_permission(''sales.write'') and owner_id=(select auth.uid()) and public.directory_account_visible(account_id))',t);
  execute format('alter policy sales_update on public.%I with check (
   public.has_permission(''sales.write'') and public.directory_account_visible(account_id))',t);
 end loop;
end;
$$;

create function public.directory_name_key(name text) returns text language sql immutable strict set search_path='' as $$
 select lower(trim(regexp_replace(name,'[[:space:]]+',' ','g')));
$$;
create index accounts_exact_name on public.accounts(public.directory_name_key(name));
create index contacts_exact_name on public.contacts(public.directory_name_key(first_name || ' ' || last_name));

-- Invoker rights retain directory RLS. An advisory lock serializes concurrent
-- name resolutions, and the calling record write and any insert are atomic.
create function public.directory_resolve_name(kind text, typed text, previous uuid, organization uuid, association text)
returns uuid language plpgsql set search_path='' as $$
declare
 name text := trim(regexp_replace(typed,'[[:space:]]+',' ','g'));
 name_key text := public.directory_name_key(typed);
 matches uuid[];
 result uuid;
begin
 if kind not in ('organization','contact') or name is null or length(name) not between 1 and
    (case when kind='organization' then 250 else 200 end) then
  raise exception 'Enter a valid contact or organization name.' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('crm-directory:' || kind || ':' || name_key,0));
 if kind='organization' then
  select array_agg(id) into matches from public.accounts a where public.directory_name_key(a.name)=name_key;
 else
  select array_agg(id) into matches from public.contacts c
  where public.directory_name_key(c.first_name || ' ' || c.last_name)=name_key;
 end if;
 if previous=any(matches) then return previous; end if;
 if cardinality(matches)=1 then return matches[1]; end if;
 if cardinality(matches)>1 then
  raise exception 'Several directory records have this name. Update the names in Accounts & Contacts before linking a new record.' using errcode='P0001';
 end if;
 if not public.has_permission('directory.write') then
  raise exception 'Creating a new contact or organization requires directory write permission.' using errcode='42501';
 end if;
 if kind='organization' then
  insert into public.accounts(name,institution_type,business,owner_id)
  values(name,'Other',association,auth.uid()) returning id into result;
 else
  insert into public.contacts(first_name,last_name,account_id,owner_id)
  values(split_part(name,' ',1),substr(name,length(split_part(name,' ',1))+2),organization,auth.uid())
  returning id into result;
 end if;
 return result;
end;
$$;
revoke all on function public.directory_resolve_name(text,text,uuid,uuid,text) from public;
grant execute on function public.directory_resolve_name(text,text,uuid,uuid,text) to authenticated;

create index conference_contacts_contact_idx on public.conference_contacts(contact_id);

-- The input column is consumed by the trigger and never stored. Use the
-- old links for unchanged names, including pre-existing homonyms.
create function public.resolve_record_directory_names() returns trigger language plpgsql set search_path='' as $$
declare
 names jsonb := new.directory_names;
 prior jsonb := '{}';
 previous_account uuid;
 association text := tg_argv[0];
begin
 if names is null then return new; end if;
 if tg_op='UPDATE' then prior := to_jsonb(old); end if;
 new.directory_names := null;
 previous_account := (prior->>'account_id')::uuid;
 if tg_table_name='sales_payments' and previous_account is null then
  select account_id into previous_account from public.sales_subscriptions where id=new.subscription_id;
 end if;
 if names ? 'organization' then
  if names->>'organization'='' and tg_table_name in ('contacts','operations_followups') then
   new.account_id := null;
  else
   if tg_table_name='contacts' then
    select coalesce((select business from public.accounts where id=(prior->>'account_id')::uuid),'Both') into association;
   end if;
   new.account_id := public.directory_resolve_name('organization',names->>'organization',previous_account,null,association);
  end if;
 end if;
 if names ? 'contact' and tg_table_name in ('operations_followups','conference_contacts','training_registrations') then
  if names->>'contact'='' and tg_table_name='operations_followups' then
   new.contact_id := null;
  else
   new.contact_id := public.directory_resolve_name('contact',names->>'contact',(prior->>'contact_id')::uuid,
    case when tg_table_name in ('conference_contacts','training_registrations') then new.account_id else null end,association);
  end if;
 end if;
 return new;
end;
$$;
revoke all on function public.resolve_record_directory_names() from public;

do $$
declare t text;
begin
 foreach t in array array[
  'sales_opportunities','sales_subscriptions','sales_renewals','sales_payments','sales_quotations',
  'alfikr_sales_opportunities','alfikr_sales_quotations','alfikr_sales_subscriptions',
  'operations_followups','training_registrations','training_history','conference_contacts','contacts'
 ] loop
  execute format('alter table public.%I add column directory_names jsonb check(directory_names is null)',t);
  execute format('grant insert(directory_names),update(directory_names) on public.%I to authenticated',t);
  execute format('create trigger a_resolve_directory_names before insert or update on public.%I for each row execute function public.resolve_record_directory_names(%L)',
   t,case when t like 'alfikr_%' then 'Al-Fikr' when t='conference_contacts' then 'Both' else 'Justech' end);
 end loop;
end;
$$;

-- Linked records read the current directory name. Legacy text stays available.
create or replace view public.sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note,s.owner_id,s.revision,s.created_at,s.updated_at,
 a.name as account_name,p.name as product_name,
 (lower(trim(s.stage)) not in ('won','lost','closed')) as is_open,
 concat_ws(' ',coalesce(a.name,s.organization_name),s.product_text,p.name,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note) as search_text,
 coalesce(a.name,nullif(s.organization_name,''),'') as organization_name,
 coalesce(nullif(s.product_text,''),p.name,'') as product_text
 from public.sales_opportunities s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
create or replace view public.alfikr_sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,s.owner_id,s.revision,s.created_at,s.updated_at,
 r0.name as account_id_label,r1.name as product_id_label,
 concat_ws(' ',coalesce(r0.name,s.organization_name),s.product_text,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,r1.name) as search_text,
 coalesce(r0.name,nullif(s.organization_name,''),'') as organization_name,
 coalesce(nullif(s.product_text,''),r1.name,'') as product_text
 from public.alfikr_sales_opportunities s left join public.accounts r0 on r0.id=s.account_id left join public.products r1 on r1.id=s.product_id;

create or replace view public.department_contact_choices with (security_invoker=true) as
 select c.id,concat_ws(' · ',trim(c.first_name || ' ' || c.last_name),a.name) as name
 from public.contacts c left join public.accounts a on a.id=c.account_id;

create or replace view public.operations_followups_list with (security_invoker=true) as
 select r.id,r.owner_id,r.revision,r.created_at,r.updated_at,r.subject,r.account_id,r.contact_id,r.last_contact,r.next_action,r.follow_up_date,r.status,
 coalesce(a.name,c.name) as party_label,concat_ws(' ',r.subject,a.name,c.name,r.last_contact,r.next_action,r.follow_up_date,r.status) as search_text,
 case when d.id is not null then trim(d.first_name || ' ' || d.last_name) end as contact_name
 from public.operations_followups r left join public.accounts a on a.id=r.account_id
 left join public.department_contact_choices c on c.id=r.contact_id
 left join public.contacts d on d.id=r.contact_id;

create or replace view public.conference_contacts_list with (security_invoker=true) as
 select c.id,c.account_id,c.contact_type,c.contact_id,
 coalesce(trim(d.first_name || ' ' || d.last_name),c.contact_person) as contact_person,
 c.email_phone,c.country,c.status,c.date_contacted,c.topic,c.next_step,c.follow_up_date,c.responsible_id,c.owner_id,c.revision,c.created_at,c.updated_at,
 a.name as account_id_label,e.full_name as responsible_id_label,
 concat_ws(' ',coalesce(trim(d.first_name || ' ' || d.last_name),c.contact_person),c.email_phone,c.country,c.contact_type,c.status,c.topic,c.next_step,a.name,e.full_name) as search_text
 from public.conference_contacts c left join public.accounts a on a.id=c.account_id
 left join public.employee_profiles e on e.id=c.responsible_id left join public.contacts d on d.id=c.contact_id;

create or replace view public.training_registrations_list with (security_invoker=true) as
 select r.id,r.owner_id,r.revision,r.created_at,r.updated_at,
 coalesce(trim(d.first_name || ' ' || d.last_name),r.participant_name) as participant_name,
 r.account_id,r.session_id,r.email,r.registration_status,r.contact_id,
 a.name as account_id_label,s.name as session_id_label,
 concat_ws(' ',coalesce(trim(d.first_name || ' ' || d.last_name),r.participant_name),a.name,s.name,r.email,r.registration_status) as search_text
 from public.training_registrations r left join public.accounts a on a.id=r.account_id
 left join public.training_sessions s on s.id=r.session_id left join public.contacts d on d.id=r.contact_id;

create or replace function public.training_relationship_guard() returns trigger language plpgsql set search_path='' as $$
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
   if new.contact_id is not null and not exists(select 1 from public.contacts where id=new.contact_id and (account_id is null or account_id=new.account_id)) then raise exception 'Contact does not belong to the selected institution' using errcode='23514';end if;
  end if;
 end if;
 return new;
end; $$;

create or replace function public.conference_reference_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.contact_id is not null and not exists(
  select 1 from public.contacts where id=new.contact_id and (account_id is null or account_id=new.account_id)
 ) then
  raise exception 'Contact must belong to the selected institution' using errcode='23514';
 end if;
 return new;
end;
$$;

create view public.directory_contacts_list with (security_invoker=true) as
 select id,first_name,last_name,job_title,department,email,
 trim(first_name || ' ' || last_name) as display_name from public.contacts;
grant select on public.directory_contacts_list to authenticated;

commit;
