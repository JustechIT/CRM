-- Free-text organization only for the two opportunity tables.
-- Keep legacy account references and all existing row data/versions unchanged.
alter table public.sales_opportunities add column organization_name text not null default '' check(length(organization_name)<=250);
alter table public.alfikr_sales_opportunities add column organization_name text not null default '' check(length(organization_name)<=250);
alter table public.sales_opportunities alter column account_id drop not null;
alter table public.alfikr_sales_opportunities alter column account_id drop not null;
alter table public.sales_opportunities add constraint opportunity_organization_required check(account_id is not null or length(trim(organization_name))>0);
alter table public.alfikr_sales_opportunities add constraint opportunity_organization_required check(account_id is not null or length(trim(organization_name))>0);
grant insert(organization_name),update(organization_name) on public.sales_opportunities,public.alfikr_sales_opportunities to authenticated;

-- Only the opportunity policy's mandatory account check changes; module,
-- actor, ownership/assignment restrictions and all other table policies remain.
alter policy sales_insert on public.sales_opportunities with check (
 public.has_permission('sales.write') and owner_id=(select auth.uid())
 and (account_id is null or exists(select 1 from public.accounts where id=account_id)));
alter policy sales_update on public.sales_opportunities with check (
 public.has_permission('sales.write')
 and (account_id is null or exists(select 1 from public.accounts where id=account_id)));

-- Preserve existing view column order and types; append the new display field.
-- Legacy names remain live fallbacks without a bulk update or audit/revision churn.
create or replace view public.sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note,s.owner_id,s.revision,s.created_at,s.updated_at,
 a.name as account_name,p.name as product_name,
 (lower(trim(s.stage)) not in ('won','lost','closed')) as is_open,
 concat_ws(' ',s.organization_name,a.name,p.name,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note) as search_text,
 coalesce(nullif(s.organization_name,''),a.name,'') as organization_name
 from public.sales_opportunities s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
create or replace view public.alfikr_sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,s.owner_id,s.revision,s.created_at,s.updated_at,
 r0.name as account_id_label,r1.name as product_id_label,
 concat_ws(' ',s.organization_name,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,r0.name,r1.name) as search_text,
 coalesce(nullif(s.organization_name,''),r0.name,'') as organization_name
 from public.alfikr_sales_opportunities s left join public.accounts r0 on r0.id=s.account_id left join public.products r1 on r1.id=s.product_id;
