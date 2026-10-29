-- Product is free text only in opportunities; retain every legacy product link.
alter table public.sales_opportunities add column product_text text not null default '' check(length(product_text)<=250);
alter table public.alfikr_sales_opportunities add column product_text text not null default '' check(length(product_text)<=250);
alter table public.sales_opportunities alter column product_id drop not null;
alter table public.alfikr_sales_opportunities alter column product_id drop not null;
alter table public.sales_opportunities add constraint opportunity_product_required check(product_id is not null or length(trim(product_text))>0);
alter table public.alfikr_sales_opportunities add constraint opportunity_product_required check(product_id is not null or length(trim(product_text))>0);
grant insert(product_text),update(product_text) on public.sales_opportunities,public.alfikr_sales_opportunities to authenticated;

-- Replace only this table's trigger. All other Sales product validation remains.
create function public.sales_opportunity_product_guard() returns trigger language plpgsql set search_path='' as $$begin
 if new.product_id is not null and not exists(select 1 from public.products where id=new.product_id and business in ('Justech','Both')) then
  raise exception 'Choose a Justech product you can access.' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function public.sales_opportunity_product_guard() from public;
drop trigger sales_product on public.sales_opportunities;
create trigger sales_product before insert or update on public.sales_opportunities for each row execute function public.sales_opportunity_product_guard();

-- Append the text display column without rewriting old rows or dependent views.
create or replace view public.sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note,s.owner_id,s.revision,s.created_at,s.updated_at,
 a.name as account_name,p.name as product_name,
 (lower(trim(s.stage)) not in ('won','lost','closed')) as is_open,
 concat_ws(' ',s.organization_name,s.product_text,a.name,p.name,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.note) as search_text,
 coalesce(nullif(s.organization_name,''),a.name,'') as organization_name,
 coalesce(nullif(s.product_text,''),p.name,'') as product_text
 from public.sales_opportunities s left join public.accounts a on a.id=s.account_id left join public.products p on p.id=s.product_id;
create or replace view public.alfikr_sales_opportunities_list with(security_invoker=true) as
 select s.id,s.name,s.account_id,s.product_id,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,s.owner_id,s.revision,s.created_at,s.updated_at,
 r0.name as account_id_label,r1.name as product_id_label,
 concat_ws(' ',s.organization_name,s.product_text,s.name,s.date,s.due_date,s.value,s.stage,s.action_type,s.expected_close,s.notes,r0.name,r1.name) as search_text,
 coalesce(nullif(s.organization_name,''),r0.name,'') as organization_name,
 coalesce(nullif(s.product_text,''),r1.name,'') as product_text
 from public.alfikr_sales_opportunities s left join public.accounts r0 on r0.id=s.account_id left join public.products r1 on r1.id=s.product_id;
