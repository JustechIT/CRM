-- Renew the same invitation, preserving its explicitly approved permissions.
alter table public.team_invitations add column last_attempt_at timestamptz;
create function public.team_prepare_invitation_resend(invitation uuid) returns text
language plpgsql security definer set search_path='' as $$
declare i public.team_invitations;
begin
 if not public.is_super_admin() then raise exception 'Verified Super Admin required' using errcode='42501';end if;
 select * into i from public.team_invitations where id=invitation for update;
 if not found or i.status='Accepted' then raise exception 'Invitation unavailable';end if;
 if exists(select 1 from auth.users u join public.employee_profiles e on e.id=u.id where lower(u.email)=lower(i.email)) then raise exception 'Employee exists; restore or edit the existing user';end if;
 if greatest(i.last_attempt_at,i.mailed_at)>clock_timestamp()-interval '60 seconds' then raise exception 'Wait one minute before resending' using errcode='P0002';end if;
 update public.team_invitations set status='Pending',expires_at=now()+interval '7 days',last_attempt_at=clock_timestamp(),invited_by=auth.uid() where id=i.id;
 insert into public.audit_records(actor_id,entity,record_id,action) values(auth.uid(),'team_invitations',i.id,'UPDATE');
 return i.email;
end $$;
revoke all on function public.team_prepare_invitation_resend(uuid) from public;
grant execute on function public.team_prepare_invitation_resend(uuid) to authenticated;
