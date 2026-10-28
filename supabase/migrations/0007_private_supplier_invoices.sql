-- Deny by default. No role, including Administrator, receives automatic access.
begin;
create table public.supplier_invoice_access(
 user_id uuid primary key references public.employee_profiles(id) on delete cascade,
 can_manage_access boolean not null default false,
 granted_by uuid references public.employee_profiles(id) on delete set null,
 granted_at timestamptz not null default now()
);
alter table public.supplier_invoice_access enable row level security;
revoke all on public.supplier_invoice_access from anon,authenticated;
grant select on public.supplier_invoice_access to authenticated;
create function public.supplier_invoice_allowed(manage boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.supplier_invoice_access a join public.employee_profiles e on e.id=a.user_id where a.user_id=(select auth.uid()) and e.status='active' and (not manage or a.can_manage_access));
$$;
revoke all on function public.supplier_invoice_allowed(boolean) from public;
grant execute on function public.supplier_invoice_allowed(boolean) to authenticated;
create policy invoice_access_read on public.supplier_invoice_access for select to authenticated using(user_id=(select auth.uid()) or public.supplier_invoice_allowed(true));
create table public.supplier_invoices(
 id uuid primary key default gen_random_uuid(),invoice_number text not null check(length(trim(invoice_number)) between 1 and 250),
 supplier text not null check(length(trim(supplier)) between 1 and 250),product_service text not null check(length(trim(product_service)) between 1 and 250),
 invoice_date date not null,due_date date not null check(due_date>=invoice_date),
 amount numeric(15,3) not null check(amount>=0),currency text not null check(currency ~ '^[A-Z]{3}$'),
 payment_status text not null check(payment_status in ('Invoice sent','Unpaid','Partially Paid','Paid')),
 file_path text, file_name text, notes text not null default '' check(length(notes)<=5000),
 owner_id uuid not null references public.employee_profiles(id) on delete restrict,
 revision integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((file_path is null and file_name is null) or (file_path is not null and file_name is not null and file_path like id::text||'/%' and length(file_name) between 1 and 250))
);
alter table public.supplier_invoices enable row level security;
revoke all on public.supplier_invoices from anon,authenticated;
grant select,delete on public.supplier_invoices to authenticated;
grant insert(invoice_number,supplier,product_service,invoice_date,due_date,amount,currency,payment_status,notes,owner_id),update(invoice_number,supplier,product_service,invoice_date,due_date,amount,currency,payment_status,notes,file_path,file_name) on public.supplier_invoices to authenticated;
create policy supplier_read on public.supplier_invoices for select to authenticated using(public.supplier_invoice_allowed());
create policy supplier_insert on public.supplier_invoices for insert to authenticated with check(public.supplier_invoice_allowed() and owner_id=(select auth.uid()));
create policy supplier_update on public.supplier_invoices for update to authenticated using(public.supplier_invoice_allowed()) with check(public.supplier_invoice_allowed());
create policy supplier_delete on public.supplier_invoices for delete to authenticated using(public.supplier_invoice_allowed());
create trigger supplier_revision before update on public.supplier_invoices for each row execute function public.sales_touch_revision();
create trigger supplier_audit after insert or update or delete on public.supplier_invoices for each row execute function public.audit_business_change();
-- General audit readers cannot enumerate private invoice IDs or access grants.
alter policy audit_read on public.audit_records using(public.has_permission('audit.read') and entity not in ('supplier_invoices','supplier_invoice_access') or (entity in ('supplier_invoices','supplier_invoice_access') and public.supplier_invoice_allowed(true)));
create function public.set_supplier_invoice_access(target uuid, allowed boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize grants/revocations and recheck authorization after acquiring the lock.
 lock table public.supplier_invoice_access in exclusive mode;
 if not public.supplier_invoice_allowed(true) then raise exception 'Private invoice access manager required' using errcode='42501';end if;
 if target=(select auth.uid()) then raise exception 'You cannot revoke your own access' using errcode='23514';end if;
 if allowed then
  if not exists(select 1 from public.employee_profiles where id=target and status='active') then raise exception 'Select an active employee' using errcode='23514';end if;
  insert into public.supplier_invoice_access(user_id,granted_by) values(target,auth.uid()) on conflict(user_id) do nothing;
 else delete from public.supplier_invoice_access where user_id=target;
 end if;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'supplier_invoice_access',target,case when allowed then 'INSERT' else 'DELETE' end);
end $$;
revoke all on function public.set_supplier_invoice_access(uuid,boolean) from public;
grant execute on function public.set_supplier_invoice_access(uuid,boolean) to authenticated;
commit;
