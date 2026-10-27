-- Additive Justech Sales implementation. Existing CRM tables/policies are preserved.
begin;
insert into public.permissions(id,description) values
 ('sales.read','Read Justech Sales and its product catalog'),
 ('sales.write','Create and edit Justech Sales records and products'),
 ('sales.delete','Delete Justech Sales records');
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where (r.id in ('administrator','management','sales') and p.id in ('sales.read','sales.write'))
    or (r.id='administrator' and p.id='sales.delete');

create table public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 200),
 business text not null default 'Justech' check(business in ('Justech','Al-Fikr','Both')),
 subscription_kind text not null check(subscription_kind in ('Turnitin','Other')),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index products_name_business_idx on public.products(lower(trim(name)),business);
create index products_owner_idx on public.products(owner_id);
create table public.sales_opportunities (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 200),
 account_id uuid not null references public.accounts(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 date date not null,due_date date, value numeric(15,3) check(value>=0),
 stage text not null check(length(trim(stage)) between 1 and 100),
 action_type text not null default '' check(length(action_type)<=100),expected_close date,
 note text not null default '' check(length(note)<=5000),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(due_date is null or due_date>=date),check(expected_close is null or expected_close>=date)
);
create table public.sales_quotations (
 id uuid primary key default gen_random_uuid(),
 lcid text not null check(length(trim(lcid)) between 1 and 100),
 type text not null default '' check(length(type)<=100),client text not null default '' check(length(client)<=250),
 nom text not null default '' check(length(nom)<=250),ref_eng text not null default '' check(length(ref_eng)<=100),
 compte_no text not null default '' check(length(compte_no)<=100),ccy text not null check(ccy ~ '^[A-Z]{3}$'),
 amount numeric(15,3) not null check(amount>=0),drawings numeric(15,3) check(drawings>=0),
 liability_amount numeric(15,3) check(liability_amount>=0),total_lc numeric(15,3) check(total_lc>=0),
 total_liab numeric(15,3) check(total_liab>=0),total_drawings numeric(15,3) check(total_drawings>=0),
 account_id uuid not null references public.accounts(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 subscription_period text not null default '' check(length(subscription_period)<=250),
 decision_status text not null default 'Draft' check(decision_status in ('Draft','Pending','Accepted','Declined','Expired')),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index sales_quotations_lcid_idx on public.sales_quotations(lower(trim(lcid)));
create table public.sales_subscriptions (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 start_date date not null,end_date date not null check(end_date>=start_date),
 contract_duration text not null check(length(trim(contract_duration)) between 1 and 100),
 status text not null check(length(trim(status)) between 1 and 100),
 kind text not null check(kind in ('Turnitin','Other')),
 annual_amount numeric(15,3) check(annual_amount>=0),currency text not null default '' check(currency='' or currency ~ '^[A-Z]{3}$'),
 check(annual_amount is null or currency<>''),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(account_id,product_id,start_date,end_date)
);
create table public.sales_renewals (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 expiry_date date not null,
 renewal_stage text not null check(length(trim(renewal_stage)) between 1 and 100),
 next_action text not null default '' check(length(next_action)<=500),follow_up_date date,
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(account_id,product_id,expiry_date)
);

create function public.sales_touch_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1;new.updated_at=now();return new;end; $$;
revoke all on function public.sales_touch_revision() from public;
-- Do not let a product be reclassified into the wrong subscription section.
create function public.sales_check_product() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='products' then
  if new.subscription_kind<>old.subscription_kind and exists(select 1 from public.sales_subscriptions where product_id=old.id and kind<>new.subscription_kind) then
   raise exception 'This product has subscriptions in its current category.' using errcode='23514';
  end if;
 else
  if not exists(select 1 from public.products where id=new.product_id and business in ('Justech','Both')) then
   raise exception 'Choose a Justech product you can access.' using errcode='23514';
  end if;
  if tg_table_name='sales_subscriptions' then
   if not exists(select 1 from public.products where id=new.product_id and subscription_kind=new.kind) then
    raise exception 'The product does not belong to this subscription category.' using errcode='23514';
   end if;
  end if;
 end if;
 return new;
end; $$;
revoke all on function public.sales_check_product() from public;
create trigger products_category before update on public.products for each row execute function public.sales_check_product();

-- Apply consistent indexes, access policies and protected metadata to all Sales entities.
do $$
declare t text;
begin
 foreach t in array array['products','sales_opportunities','sales_quotations','sales_subscriptions','sales_renewals'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create trigger sales_revision before update on public.%I for each row execute function public.sales_touch_revision()',t);
  execute format('create trigger sales_audit after insert or update or delete on public.%I for each row execute function public.audit_business_change()',t);
  if t='products' then
   execute format('create policy sales_read on public.%I for select to authenticated using (public.has_permission(''sales.read'') and business in (''Justech'',''Both''))',t);
   execute format('create policy sales_insert on public.%I for insert to authenticated with check (public.has_permission(''sales.write'') and business=''Justech'' and owner_id=(select auth.uid()))',t);
   execute format('create policy sales_update on public.%I for update to authenticated using (public.has_permission(''sales.write'') and business in (''Justech'',''Both'')) with check (public.has_permission(''sales.write'') and business in (''Justech'',''Both''))',t);
  else
   execute format('create index %I on public.%I(account_id)',t||'_account_idx',t);
   execute format('create index %I on public.%I(product_id)',t||'_product_idx',t);
   execute format('create index %I on public.%I(owner_id)',t||'_owner_idx',t);
   execute format('create policy sales_read on public.%I for select to authenticated using (public.has_permission(''sales.read''))',t);
   execute format('create policy sales_insert on public.%I for insert to authenticated with check (public.has_permission(''sales.write'') and owner_id=(select auth.uid()) and exists(select 1 from public.accounts where id=account_id))',t);
   execute format('create policy sales_update on public.%I for update to authenticated using (public.has_permission(''sales.write'')) with check (public.has_permission(''sales.write'') and exists(select 1 from public.accounts where id=account_id))',t);
   execute format('create policy sales_delete on public.%I for delete to authenticated using (public.has_permission(''sales.delete''))',t);
   execute format('grant delete on public.%I to authenticated',t);
   execute format('create trigger sales_product before insert or update on public.%I for each row execute function public.sales_check_product()',t);
  end if;
 end loop;
end $$;
-- Explicit column grants prevent clients from editing IDs, owners, revision or timestamps.
grant insert(name,subscription_kind,owner_id),update(name,subscription_kind) on public.products to authenticated;
grant insert(name,account_id,product_id,date,due_date,value,stage,action_type,expected_close,note,owner_id),update(name,account_id,product_id,date,due_date,value,stage,action_type,expected_close,note) on public.sales_opportunities to authenticated;
grant insert(lcid,type,client,nom,ref_eng,compte_no,ccy,amount,drawings,liability_amount,total_lc,total_liab,total_drawings,account_id,product_id,subscription_period,decision_status,owner_id),update(lcid,type,client,nom,ref_eng,compte_no,ccy,amount,drawings,liability_amount,total_lc,total_liab,total_drawings,account_id,product_id,subscription_period,decision_status) on public.sales_quotations to authenticated;
grant insert(account_id,product_id,start_date,end_date,contract_duration,status,kind,annual_amount,currency,owner_id),update(account_id,product_id,start_date,end_date,contract_duration,status,kind,annual_amount,currency) on public.sales_subscriptions to authenticated;
grant insert(account_id,product_id,expiry_date,renewal_stage,next_action,follow_up_date,owner_id),update(account_id,product_id,expiry_date,renewal_stage,next_action,follow_up_date) on public.sales_renewals to authenticated;
create index sales_opportunities_stage_due_idx on public.sales_opportunities(lower(stage),due_date);
create index sales_quotations_decision_idx on public.sales_quotations(decision_status);
create index sales_subscriptions_kind_end_idx on public.sales_subscriptions(kind,end_date);
create index sales_renewals_follow_up_idx on public.sales_renewals(follow_up_date);
create index sales_renewals_expiry_idx on public.sales_renewals(expiry_date);

-- Invoker views preserve base-table RLS while supporting full-directory name search and sorting.
create view public.sales_opportunities_list with (security_invoker=true) as
 select s.*,a.name as account_name,p.name as product_name,
 (lower(trim(s.stage)) not in ('won','lost','closed')) as is_open,
 concat_ws(' ',a.name,p.name,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note) as search_text
 from public.sales_opportunities s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
revoke all on public.sales_opportunities_list from anon,authenticated;
grant select on public.sales_opportunities_list to authenticated;
-- Invoker views preserve base-table RLS while supporting full-directory name search and sorting.
create view public.sales_quotations_list with (security_invoker=true) as
 select s.*,a.name as account_name,p.name as product_name,
 concat_ws(' ',a.name,p.name,s.lcid,s.type,s.client,s.nom,s.ref_eng,s.compte_no,s.ccy,s.amount,s.drawings,s.liability_amount,s.total_lc,s.total_liab,s.total_drawings,s.subscription_period) as search_text
 from public.sales_quotations s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
revoke all on public.sales_quotations_list from anon,authenticated;
grant select on public.sales_quotations_list to authenticated;
-- Invoker views preserve base-table RLS while supporting full-directory name search and sorting.
create view public.sales_subscriptions_list with (security_invoker=true) as
 select s.*,a.name as account_name,p.name as product_name,
 concat_ws(' ',a.name,p.name,s.start_date,s.end_date,s.contract_duration,s.status,s.kind,s.annual_amount,s.currency) as search_text
 from public.sales_subscriptions s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
revoke all on public.sales_subscriptions_list from anon,authenticated;
grant select on public.sales_subscriptions_list to authenticated;
-- Invoker views preserve base-table RLS while supporting full-directory name search and sorting.
create view public.sales_renewals_list with (security_invoker=true) as
 select s.*,a.name as account_name,p.name as product_name,
 (lower(trim(s.renewal_stage)) not in ('renewed','not renewing','cancelled','closed')) as is_open,
 concat_ws(' ',a.name,p.name,s.expiry_date,s.renewal_stage,s.next_action,s.follow_up_date) as search_text
 from public.sales_renewals s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
revoke all on public.sales_renewals_list from anon,authenticated;
grant select on public.sales_renewals_list to authenticated;

create function public.sales_overview(as_of date default current_date,revenue_year integer default extract(year from current_date)::integer) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if not public.has_permission('sales.read') then raise exception 'Sales access required' using errcode='42501';end if;
 if revenue_year not between 1900 and 2200 then raise exception 'Choose a valid revenue year' using errcode='22023';end if;
 return jsonb_build_object(
  'active_opportunities',(select count(*) from public.sales_opportunities where lower(trim(stage)) not in ('won','lost','closed')),
  'pending_quotations',(select count(*) from public.sales_quotations where decision_status='Pending'),
  'active_subscriptions',(select count(*) from public.sales_subscriptions where lower(trim(status))='active' and start_date<=as_of and end_date>=as_of),
  'upcoming_renewals',(select count(*) from public.sales_subscriptions where lower(trim(status))='active' and start_date<=as_of and end_date between as_of and as_of+90),
  -- Use the latest confirmed term per customer/product intersecting the selected year.
  -- Renewal follow-up rows are never a second financial source; identical terms are unique.
  'annual_sales_revenue',jsonb_build_object('TND','0','EUR','0','USD','0') || coalesce((
   select jsonb_object_agg(currency,total::text) from (
    select currency,sum(annual_amount) as total from (
     select distinct on (account_id,product_id) account_id,product_id,annual_amount,currency
     from public.sales_subscriptions
     where lower(trim(status)) in ('active','confirmed','expired')
       and start_date<=make_date(revenue_year,12,31) and end_date>=make_date(revenue_year,1,1)
     order by account_id,product_id,start_date desc,end_date desc,created_at desc,id
    ) confirmed_terms where annual_amount is not null group by currency
   ) revenue
  ),'{}'::jsonb),
  'overdue_follow_ups',(
   (select count(*) from public.sales_opportunities where due_date<as_of and lower(trim(stage)) not in ('won','lost','closed'))+
   (select count(*) from public.sales_renewals where follow_up_date<as_of and lower(trim(renewal_stage)) not in ('renewed','not renewing','cancelled','closed'))
  )
 );
end; $$;
revoke all on function public.sales_overview(date,integer) from public;
grant execute on function public.sales_overview(date,integer) to authenticated;
commit;
