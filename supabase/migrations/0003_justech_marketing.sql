-- Additive Justech Marketing. Requires migrations 0001 and 0002.
begin;
insert into public.permissions values ('marketing.read','Read Justech marketing'),('marketing.write','Create and edit Justech marketing'),('marketing.delete','Delete Justech marketing');
insert into public.role_permissions select r.id,p.id from public.roles r cross join public.permissions p
 where (r.id in ('administrator','management','marketing') and p.id in ('marketing.read','marketing.write')) or (r.id='administrator' and p.id='marketing.delete');
insert into public.permissions values ('products.read','Read the shared Justech product catalog');
insert into public.role_permissions values ('administrator','products.read'),('management','products.read'),('marketing','products.read');
alter policy sales_read on public.products using((public.has_permission('sales.read') or public.has_permission('products.read')) and business in ('Justech','Both'));
create function public.department_reference_guard() returns trigger language plpgsql set search_path='' as $$
declare item jsonb:=to_jsonb(new); prior jsonb:='{}'::jsonb; k text;
begin
 if tg_op='UPDATE' then prior:=to_jsonb(old);end if;
 foreach k in array array['assigned_to','responsible_id','trainer_id'] loop
  if item ? k and item->>k is not null and (tg_op='INSERT' or item->>k is distinct from prior->>k) then
   if not exists(select 1 from public.employee_profiles where id=(item->>k)::uuid and status='active') then raise exception 'Choose an active employee' using errcode='23514';end if;
  end if;
 end loop;
 if item ? 'product_id' and item->>'product_id' is not null and (tg_op='INSERT' or item->>'product_id' is distinct from prior->>'product_id') then
  if not exists(select 1 from public.products where id=(item->>'product_id')::uuid and business in ('Justech','Both')) then raise exception 'Choose an accessible Justech product' using errcode='23514';end if;
 end if;
 if item ? 'account_id' and item->>'account_id' is not null and (tg_op='INSERT' or item->>'account_id' is distinct from prior->>'account_id') then
  if not exists(select 1 from public.accounts where id=(item->>'account_id')::uuid) then raise exception 'Choose an accessible institution' using errcode='23514';end if;
 end if;
 if item ? 'contact_id' and item->>'contact_id' is not null and (tg_op='INSERT' or item->>'contact_id' is distinct from prior->>'contact_id') then
  if not exists(select 1 from public.contacts where id=(item->>'contact_id')::uuid) then raise exception 'Choose an accessible contact' using errcode='23514';end if;
 end if;
 return new;
end; $$;
revoke all on function public.department_reference_guard() from public;
create table public.marketing_campaigns (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
name text not null check(length(trim(name)) between 1 and 200),platform text not null check(length(trim(platform)) between 1 and 100),start_date date not null,end_date date not null check(end_date>=start_date),status text not null check(status in ('Draft','Scheduled','Active','Completed','Cancelled')),assigned_to uuid not null references public.employee_profiles(id) on delete restrict
);
create table public.marketing_content (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
title text not null check(length(trim(title)) between 1 and 200),platform text not null check(length(trim(platform)) between 1 and 100),content_type text not null check(length(trim(content_type)) between 1 and 100),publish_date date not null,status text not null check(status in ('Draft','Awaiting approval','Scheduled','Published','Cancelled')),assigned_to uuid not null references public.employee_profiles(id) on delete restrict
);
create table public.marketing_assets (
id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
name text not null check(length(trim(name)) between 1 and 200),asset_type text not null check(length(trim(asset_type)) between 1 and 100),product_id uuid not null references public.products(id) on delete restrict,file_link text check(file_link is null or (length(file_link)<=2048 and file_link ~* '^https?://')),status text not null check(status in ('Planned','In progress','Awaiting approval','Approved','Archived')),assigned_to uuid not null references public.employee_profiles(id) on delete restrict
);
alter table public.marketing_campaigns enable row level security;
revoke all on public.marketing_campaigns from anon,authenticated;
grant select,delete on public.marketing_campaigns to authenticated;
grant insert(name,platform,start_date,end_date,status,assigned_to,owner_id),update(name,platform,start_date,end_date,status,assigned_to) on public.marketing_campaigns to authenticated;
create policy department_read on public.marketing_campaigns for select to authenticated using(public.has_permission('marketing.read'));
create policy department_insert on public.marketing_campaigns for insert to authenticated with check(public.has_permission('marketing.write') and owner_id=(select auth.uid()));
create policy department_update on public.marketing_campaigns for update to authenticated using(public.has_permission('marketing.write')) with check(public.has_permission('marketing.write'));
create policy department_delete on public.marketing_campaigns for delete to authenticated using(public.has_permission('marketing.delete'));
create trigger department_revision before update on public.marketing_campaigns for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.marketing_campaigns for each row execute function public.audit_business_change();
create index marketing_campaigns_owner_idx on public.marketing_campaigns(owner_id);
create index marketing_campaigns_assigned_idx on public.marketing_campaigns(assigned_to);
create view public.marketing_campaigns_list with (security_invoker=true) as
 select r.*,e.full_name as assigned_to_label,concat_ws(' ',e.full_name,r.name,r.platform,r.start_date,r.end_date,r.status) as search_text
 from public.marketing_campaigns r left join public.employee_profiles e on e.id=r.assigned_to;
revoke all on public.marketing_campaigns_list from anon,authenticated;
grant select on public.marketing_campaigns_list to authenticated;
alter table public.marketing_content enable row level security;
revoke all on public.marketing_content from anon,authenticated;
grant select,delete on public.marketing_content to authenticated;
grant insert(title,platform,content_type,publish_date,status,assigned_to,owner_id),update(title,platform,content_type,publish_date,status,assigned_to) on public.marketing_content to authenticated;
create policy department_read on public.marketing_content for select to authenticated using(public.has_permission('marketing.read'));
create policy department_insert on public.marketing_content for insert to authenticated with check(public.has_permission('marketing.write') and owner_id=(select auth.uid()));
create policy department_update on public.marketing_content for update to authenticated using(public.has_permission('marketing.write')) with check(public.has_permission('marketing.write'));
create policy department_delete on public.marketing_content for delete to authenticated using(public.has_permission('marketing.delete'));
create trigger department_revision before update on public.marketing_content for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.marketing_content for each row execute function public.audit_business_change();
create index marketing_content_owner_idx on public.marketing_content(owner_id);
create index marketing_content_assigned_idx on public.marketing_content(assigned_to);
create view public.marketing_content_list with (security_invoker=true) as
 select r.*,e.full_name as assigned_to_label,concat_ws(' ',e.full_name,r.title,r.platform,r.content_type,r.publish_date,r.status) as search_text
 from public.marketing_content r left join public.employee_profiles e on e.id=r.assigned_to;
revoke all on public.marketing_content_list from anon,authenticated;
grant select on public.marketing_content_list to authenticated;
alter table public.marketing_assets enable row level security;
revoke all on public.marketing_assets from anon,authenticated;
grant select,delete on public.marketing_assets to authenticated;
grant insert(name,asset_type,product_id,file_link,status,assigned_to,owner_id),update(name,asset_type,product_id,file_link,status,assigned_to) on public.marketing_assets to authenticated;
create policy department_read on public.marketing_assets for select to authenticated using(public.has_permission('marketing.read'));
create policy department_insert on public.marketing_assets for insert to authenticated with check(public.has_permission('marketing.write') and owner_id=(select auth.uid()));
create policy department_update on public.marketing_assets for update to authenticated using(public.has_permission('marketing.write')) with check(public.has_permission('marketing.write'));
create policy department_delete on public.marketing_assets for delete to authenticated using(public.has_permission('marketing.delete'));
create trigger department_revision before update on public.marketing_assets for each row execute function public.sales_touch_revision();
create trigger department_audit after insert or update or delete on public.marketing_assets for each row execute function public.audit_business_change();
create index marketing_assets_owner_idx on public.marketing_assets(owner_id);
create index marketing_assets_assigned_idx on public.marketing_assets(assigned_to);
create index marketing_assets_product_idx on public.marketing_assets(product_id);
create view public.marketing_assets_list with (security_invoker=true) as
 select r.*,e.full_name as assigned_to_label,p.name as product_id_label,concat_ws(' ',e.full_name,r.name,r.asset_type,r.file_link,r.status,p.name) as search_text
 from public.marketing_assets r left join public.employee_profiles e on e.id=r.assigned_to left join public.products p on p.id=r.product_id;
revoke all on public.marketing_assets_list from anon,authenticated;
grant select on public.marketing_assets_list to authenticated;
create trigger department_references before insert or update on public.marketing_campaigns for each row execute function public.department_reference_guard();
create trigger department_references before insert or update on public.marketing_content for each row execute function public.department_reference_guard();
create trigger department_references before insert or update on public.marketing_assets for each row execute function public.department_reference_guard();
create index marketing_campaigns_dates_idx on public.marketing_campaigns(start_date,end_date,status);
create index marketing_content_publish_idx on public.marketing_content(publish_date,status);
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
 raise exception 'Department is not installed' using errcode='22023';
end; $$;
revoke all on function public.department_overview(text,date) from public;
grant execute on function public.department_overview(text,date) to authenticated;
commit;
