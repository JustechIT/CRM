-- Personal settings/profile, permission-aware Home, and real in-app work notifications.
begin;
alter table public.user_preferences add column notifications_enabled boolean not null default true,add column sidebar_collapsed boolean not null default false;
create function public.update_my_profile(person_name text) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required to edit user information' using errcode='42501';end if;
 if not public.is_employee() then raise exception 'Active employee required' using errcode='42501';end if;
 if length(trim(person_name)) not between 1 and 200 then raise exception 'Enter a full name';end if;
 update public.employee_profiles set full_name=trim(person_name),updated_at=now() where id=(select auth.uid());
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'employee_profiles',auth.uid(),'UPDATE');
end $$;
revoke all on function public.update_my_profile(text) from public;grant execute on function public.update_my_profile(text) to authenticated;
create table public.notification_reads(user_id uuid not null references public.employee_profiles(id) on delete cascade,event_key text not null check(length(event_key)<=200),read_at timestamptz not null default now(),primary key(user_id,event_key));
alter table public.notification_reads enable row level security;revoke all on public.notification_reads from anon,authenticated;grant select,insert on public.notification_reads to authenticated;
create policy own_reads on public.notification_reads for select to authenticated using(user_id=(select auth.uid()) and public.is_employee());
create policy own_read_insert on public.notification_reads for insert to authenticated with check(user_id=(select auth.uid()) and public.is_employee());
create function public.my_notifications() returns table(event_key text,title text,href text,due_date date,kind text,updated_at timestamptz,is_read boolean) language sql stable security invoker set search_path='' as $$
 select n.event_key,n.title,n.href,n.due_date,n.kind,n.updated_at,exists(select 1 from public.notification_reads r where r.user_id=(select auth.uid()) and r.event_key=n.event_key) from (
 select 'priority:'||a.id||':'||a.revision event_key,a.title,'/modules/workspace/priorities?record='||a.id href,(a.due_at at time zone 'UTC')::date due_date,'Assigned priority' kind,a.updated_at from public.activities a where a.workspace_kind='priorities' and a.assigned_to=(select auth.uid()) and a.status<>'Completed'
 union all select 'operations:'||a.id||':'||a.revision,a.title,'/modules/justech-operations/tasks?record='||a.id,(a.due_at at time zone 'UTC')::date,'Assigned task',a.updated_at from public.activities a where a.department='operations' and a.assigned_to=(select auth.uid()) and a.status not in ('Completed','Cancelled')
 union all select 'issue:'||i.id||':'||i.revision,i.title,'/modules/workspace/platform/issues?record='||i.id||'&project='||i.project_id,null::date,'Assigned IT task',i.updated_at from public.it_issues i where i.assigned_to=(select auth.uid()) and i.status<>'Completed'
 union all select 'followup:'||f.id||':'||f.revision,f.subject,'/modules/justech-operations/follow-ups?record='||f.id,f.follow_up_date,'Follow-up due',f.updated_at from public.operations_followups f where f.owner_id=(select auth.uid()) and f.follow_up_date<=current_date+7 and f.status not in ('Completed','Cancelled')
 union all select 'conference:'||c.id||':'||c.revision,c.contact_person,'/modules/workspace/events?section=conferences&record='||c.id,c.follow_up_date,'Conference follow-up',c.updated_at from public.conference_contacts c where c.responsible_id=(select auth.uid()) and c.follow_up_date<=current_date+7 and c.status<>'Closed'
 union all select 'content:'||c.id||':'||c.revision,c.title,'/modules/justech-marketing/content-calendar?record='||c.id,c.publish_date,'Content to publish',c.updated_at from public.marketing_content c where c.assigned_to=(select auth.uid()) and c.status not in ('Published','Cancelled')
 union all select 'alfikr-content:'||c.id||':'||c.revision,c.title,'/modules/alfikr-marketing/content-calendar?record='||c.id,c.publish_date,'Al-Fikr publication',c.updated_at from public.alfikr_marketing_content_calendar c where c.assigned_to=(select auth.uid()) and c.status not in ('Published','Cancelled')
 ) n where public.is_employee() order by (n.due_date<current_date) desc nulls last,n.updated_at desc,n.event_key limit 50;
$$;
revoke all on function public.my_notifications() from public;grant execute on function public.my_notifications() to authenticated;
create function public.mark_notifications_read(keys text[]) returns void language plpgsql security invoker set search_path='' as $$begin
 if not public.is_employee() then raise exception 'Active employee required' using errcode='42501';end if;
 if coalesce(array_length(keys,1),0)>50 then raise exception 'Too many notifications';end if;
 insert into public.notification_reads(user_id,event_key) select auth.uid(),n.event_key from public.my_notifications() n where n.event_key=any(keys) on conflict do nothing;
end $$;
revoke all on function public.mark_notifications_read(text[]) from public;grant execute on function public.mark_notifications_read(text[]) to authenticated;
alter table public.team_invitations add column mailed_at timestamptz,add column delivery_error text;
create function public.record_invitation_delivery(invitation uuid,sent boolean,error_code text default null) returns void language plpgsql security definer set search_path='' as $$begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 update public.team_invitations set mailed_at=case when sent then now() else null end,delivery_error=case when sent then null else left(coalesce(error_code,'send_failed'),100) end,status=case when not sent and status='Pending' then 'Cancelled' else status end where id=invitation;
end $$;
revoke all on function public.record_invitation_delivery(uuid,boolean,text) from public;grant execute on function public.record_invitation_delivery(uuid,boolean,text) to authenticated;
create function public.home_dashboard() returns jsonb language plpgsql stable security invoker set search_path='' as $$declare result jsonb;begin
 if not public.is_employee() then raise exception 'Active employee required' using errcode='42501';end if;
 result=jsonb_build_object(
 'opportunities',case when public.has_permission('sales.read') or public.has_permission('alfikr-sales.read') then (select count(*) from public.sales_opportunities where lower(stage) not in ('won','lost','closed'))+(select count(*) from public.alfikr_sales_opportunities where stage not in ('Won','Lost')) else null end,
 'caution',case when public.has_permission('operations.read') then (select count(*) from public.sales_quotations) else null end,
 'renewals',case when public.has_permission('sales.read') or public.has_permission('alfikr-sales.read') then (select count(*) from public.sales_subscriptions where status in ('Active','Confirmed') and end_date between current_date and current_date+90)+(select count(*) from public.alfikr_sales_subscriptions where status in ('Active','Confirmed') and end_date between current_date and current_date+90) else null end,
 'tasks',case when public.has_permission('priorities.read') or public.has_permission('platform.read') or public.has_permission('operations.read') then (select count(*) from public.activities where (workspace_kind='priorities' or department='operations') and status not in ('Completed','Cancelled'))+(select count(*) from public.it_issues where status<>'Completed') else null end,
 'priorities',coalesce((select jsonb_agg(p) from(select id,title,due_at,priority,status from public.activities where workspace_kind='priorities' and assigned_to=(select auth.uid()) and status<>'Completed' order by due_at limit 5) p),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(e) from(select id,name,event_date,status from public.workspace_events where event_date between current_date and current_date+30 and status not in ('Completed','Cancelled') order by event_date limit 5) e),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(a) from(select id,entity,action,occurred_at from public.audit_records where entity not in ('supplier_invoices','supplier_invoice_access','team_admin_principal','team_user_settings','team_invitations','employee_profiles') order by occurred_at desc limit 8) a),'[]'::jsonb));
 return result;end $$;
revoke all on function public.home_dashboard() from public;grant execute on function public.home_dashboard() to authenticated;
-- Validate the recipient BEFORE password setup, not after an existing session is changed.
create function public.invitation_for_me() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('email',i.email,'full_name',i.full_name,'expires_at',i.expires_at)
 from public.team_invitations i join auth.users u on lower(u.email)=i.email join public.team_admin_principal p on p.user_id=i.invited_by join public.employee_profiles e on e.id=p.user_id join auth.users administrator on administrator.id=p.user_id
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and i.status='Pending' and i.expires_at>now() and not exists(select 1 from public.employee_profiles member where member.id=u.id)
 and p.activated_at is not null and e.status='active' and lower(administrator.email)=p.verified_email and administrator.email_confirmed_at is not null limit 1;
$$;
revoke all on function public.invitation_for_me() from public;grant execute on function public.invitation_for_me() to authenticated;
commit;
