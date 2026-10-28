-- Preserve quotation/subscription/renewal rows and IDs. Apply once after 0005.
begin;
alter table public.sales_subscriptions add column creation_date date;
update public.sales_subscriptions set creation_date=(created_at at time zone 'UTC')::date;
alter table public.sales_subscriptions alter column creation_date set not null, alter column creation_date set default current_date;
alter table public.sales_subscriptions add column payment_status text not null default 'Unpaid' check(payment_status in ('Invoice sent','Unpaid','Partially Paid','Paid'));
grant insert(creation_date,payment_status),update(creation_date,payment_status) on public.sales_subscriptions to authenticated;
-- Existing currency values and all legacy quotation fields remain untouched.
-- New Caution records have no currency field; empty means unspecified, never an assumed currency.
alter table public.sales_quotations drop constraint sales_quotations_ccy_check;
alter table public.sales_quotations alter column ccy set default '';
alter table public.sales_quotations add constraint sales_quotations_ccy_check check(ccy='' or ccy ~ '^[A-Z]{3}$');
alter table public.sales_quotations add column refunded text not null default 'No' check(refunded in ('Yes','No'));
drop policy sales_read on public.sales_quotations;
drop policy sales_insert on public.sales_quotations;
drop policy sales_update on public.sales_quotations;
drop policy sales_delete on public.sales_quotations;
create policy caution_read on public.sales_quotations for select to authenticated using(public.has_permission('operations.read'));
create policy caution_insert on public.sales_quotations for insert to authenticated with check(public.has_permission('operations.write') and owner_id=(select auth.uid()));
create policy caution_update on public.sales_quotations for update to authenticated using(public.has_permission('operations.write')) with check(public.has_permission('operations.write'));
create policy caution_delete on public.sales_quotations for delete to authenticated using(public.has_permission('operations.delete'));
revoke insert,update on public.sales_quotations from authenticated;
-- Revoke old per-column grants as well as table privileges.
do $$ declare cols text;begin
 select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='sales_quotations';
 execute 'revoke insert('||cols||'),update('||cols||') on public.sales_quotations from authenticated';
end $$;
grant insert(lcid,nom,compte_no,amount,account_id,product_id,subscription_period,refunded,owner_id),update(lcid,nom,compte_no,amount,account_id,product_id,subscription_period,refunded) on public.sales_quotations to authenticated;
insert into public.role_permissions values('operations','products.read') on conflict do nothing;
create view public.operations_caution_list with(security_invoker=true) as select q.id,q.lcid,q.nom,q.compte_no,q.amount,q.account_id,q.product_id,q.subscription_period,q.refunded,q.owner_id,q.revision,q.created_at,q.updated_at,a.name as account_id_label,p.name as product_id_label,concat_ws(' ',q.lcid,q.nom,q.compte_no,q.amount,a.name,p.name,q.subscription_period,q.refunded) as search_text from public.sales_quotations q left join public.accounts a on a.id=q.account_id left join public.products p on p.id=q.product_id;
grant select on public.operations_caution_list to authenticated;
create table public.sales_payments(
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 subscription_id uuid references public.sales_subscriptions(id) on delete restrict,
 invoice_reference text not null check(length(trim(invoice_reference)) between 1 and 250),
 amount numeric(15,3) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),
 payment_date date not null,payment_method text not null check(length(trim(payment_method)) between 1 and 100),
 payment_status text not null check(payment_status in ('Invoice sent','Unpaid','Partially Paid','Paid')),
 notes text not null default '' check(length(notes)<=5000),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index sales_payments_subscription_idx on public.sales_payments(subscription_id);
create index sales_payments_account_idx on public.sales_payments(account_id);
create function public.payment_subscription_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='sales_payments' then
  if not exists(select 1 from public.products where id=new.product_id and business in ('Justech','Both')) then raise exception 'Choose an accessible Justech product' using errcode='23514'; end if;
  if new.subscription_id is not null then
   perform 1 from public.sales_subscriptions where id=new.subscription_id and account_id=new.account_id and product_id=new.product_id and currency=new.currency for share;
   if not found then raise exception 'Payment must match subscription customer, product and currency' using errcode='23514'; end if;
  end if;
 else
  if (new.account_id,new.product_id,new.currency) is distinct from (old.account_id,old.product_id,old.currency) and exists(select 1 from public.sales_payments where subscription_id=old.id) then raise exception 'Reassign linked payments before changing subscription references or currency' using errcode='23514';end if;
 end if;return new;
end $$;
revoke all on function public.payment_subscription_guard() from public;
create trigger payment_guard before insert or update on public.sales_payments for each row execute function public.payment_subscription_guard();
create trigger subscription_payment_guard before update on public.sales_subscriptions for each row execute function public.payment_subscription_guard();
alter table public.sales_payments enable row level security;
revoke all on public.sales_payments from anon,authenticated;
grant select,delete on public.sales_payments to authenticated;
grant insert(account_id,product_id,subscription_id,invoice_reference,amount,currency,payment_date,payment_method,payment_status,notes,owner_id),update(account_id,product_id,subscription_id,invoice_reference,amount,currency,payment_date,payment_method,payment_status,notes) on public.sales_payments to authenticated;
create policy payment_read on public.sales_payments for select to authenticated using(public.has_permission('sales.read'));
create policy payment_insert on public.sales_payments for insert to authenticated with check(public.has_permission('sales.write') and owner_id=(select auth.uid()));
create policy payment_update on public.sales_payments for update to authenticated using(public.has_permission('sales.write')) with check(public.has_permission('sales.write'));
create policy payment_delete on public.sales_payments for delete to authenticated using(public.has_permission('sales.delete'));
create trigger payment_revision before update on public.sales_payments for each row execute function public.sales_touch_revision();
create trigger payment_audit after insert or update or delete on public.sales_payments for each row execute function public.audit_business_change();
create view public.sales_payments_list with(security_invoker=true) as select x.*,a.name as account_name,p.name as product_name,concat_ws(' · ',a.name,p.name,s.start_date||' – '||s.end_date) as subscription_label,concat_ws(' ',a.name,p.name,x.invoice_reference,x.amount,x.currency,x.payment_date,x.payment_method,x.payment_status,x.notes,s.start_date,s.end_date) as search_text from public.sales_payments x left join public.accounts a on a.id=x.account_id left join public.products p on p.id=x.product_id left join public.sales_subscriptions s on s.id=x.subscription_id;
grant select on public.sales_payments_list to authenticated;
-- Append view columns without changing existing column order.
create or replace view public.sales_subscriptions_list with(security_invoker=true) as select s.id,s.account_id,s.product_id,s.start_date,s.end_date,s.contract_duration,s.status,s.kind,s.annual_amount,s.currency,s.owner_id,s.revision,s.created_at,s.updated_at,a.name as account_name,p.name as product_name,concat_ws(' ',a.name,p.name,s.start_date,s.end_date,s.contract_duration,s.status,s.kind,s.annual_amount,s.currency,s.creation_date,s.payment_status) as search_text,s.creation_date,s.payment_status,coalesce(v.received,0) as received_amount,case when s.annual_amount is null then null else greatest(s.annual_amount-coalesce(v.received,0),0) end as remaining_balance from public.sales_subscriptions s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id left join lateral(select sum(amount) as received from public.sales_payments where subscription_id=s.id and currency=s.currency and payment_status in ('Paid','Partially Paid')) v on true;
commit;
