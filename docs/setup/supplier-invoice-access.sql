-- Run once in the trusted Supabase SQL Editor AFTER 0007 and employee onboarding.
-- Accounts explicitly identified by the user. Only Souhail may manage access.
begin;
do $$
declare mail text; uid uuid;
begin
 foreach mail in array array['souhail@justech.tn','bj@justech.tn','ahmed.hammami@justech.tn'] loop
  select u.id into uid from auth.users u join public.employee_profiles e on e.id=u.id where lower(u.email)=mail and e.status='active';
  if uid is null then raise exception 'Create and onboard the active employee account % before granting access',mail;end if;
  insert into public.supplier_invoice_access(user_id,can_manage_access) values(uid,mail='souhail@justech.tn') on conflict(user_id) do update set can_manage_access=excluded.can_manage_access;
 end loop;
end $$;
commit;
