-- Run AFTER migrations 0009 and 0010 in the trusted Supabase SQL Editor.
-- This only stages an existing verified identity. It does NOT grant privileges.
-- Then sign in as souhail@justech.tn and activate Super Admin in Team Management.
do $$
declare target uuid; matches integer;
begin
 select count(*) into matches from auth.users u join public.employee_profiles e on e.id=u.id where lower(u.email)='souhail@justech.tn' and u.email_confirmed_at is not null and e.status='active';
 if matches<>1 then raise exception 'Verify exactly one confirmed active souhail@justech.tn account in Authentication first';end if;
 select u.id into target from auth.users u join public.employee_profiles e on e.id=u.id where lower(u.email)='souhail@justech.tn' and u.email_confirmed_at is not null and e.status='active';
 if target is null then raise exception 'Verify souhail@justech.tn in Supabase Authentication and its active employee profile before continuing';end if;
 perform public.configure_team_super_admin(target,'souhail@justech.tn');
end $$;
