begin;
create table public.directory_import_jobs(id uuid primary key,user_id uuid not null references public.employee_profiles(id),entity text not null check(entity in ('accounts','contacts')),inserted integer not null check(inserted>=0),skipped integer not null check(skipped>=0),created_at timestamptz not null default now());
alter table public.directory_import_jobs enable row level security;revoke all on public.directory_import_jobs from anon,authenticated;grant select on public.directory_import_jobs to authenticated;
create policy own_imports on public.directory_import_jobs for select to authenticated using(user_id=(select auth.uid()) and public.is_employee());
create function public.import_directory(entity_value text,row_values jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare item jsonb;inserted_count integer:=0;skipped_count integer:=0;prior public.directory_import_jobs;account uuid;begin
 if not public.has_permission('directory.read') or not public.has_permission('directory.write') or not public.team_record_write_allowed(null,auth.uid()) then raise exception 'Directory write access required' using errcode='42501';end if;
 if entity_value not in ('accounts','contacts') or jsonb_typeof(row_values)<>'array' or jsonb_array_length(row_values) not between 1 and 500 or request_id is null then raise exception 'Invalid import batch';end if;
 -- Serialize import and ordinary directory inserts before rechecking duplicates.
 lock table public.accounts,public.contacts in share row exclusive mode;
 select * into prior from public.directory_import_jobs where id=request_id;
 if found then if prior.user_id<>auth.uid() or prior.entity<>entity_value then raise exception 'Import request is already used';end if;return jsonb_build_object('inserted',prior.inserted,'skipped',prior.skipped,'id',prior.id);end if;
 for item in select * from jsonb_array_elements(row_values) loop
  if entity_value='accounts' then
   if exists(select 1 from public.accounts a where lower(trim(a.name))=lower(trim(item->>'name')) and lower(trim(a.country))=lower(trim(coalesce(item->>'country',''))) and lower(trim(a.city))=lower(trim(coalesce(item->>'city','')))) then skipped_count=skipped_count+1;continue;end if;
   insert into public.accounts(name,institution_type,country,city,website,email,phone,status,business,notes,owner_id) values(trim(item->>'name'),item->>'institution_type',coalesce(item->>'country',''),coalesce(item->>'city',''),coalesce(item->>'website',''),coalesce(item->>'email',''),coalesce(item->>'phone',''),item->>'status',item->>'business',coalesce(item->>'notes',''),auth.uid());
  else
   account=(item->>'account_id')::uuid;
   if not exists(select 1 from public.accounts where id=account) then raise exception 'Institution no longer exists';end if;
   if exists(select 1 from public.contacts c where c.account_id=account and ((coalesce(item->>'email','')<>'' and lower(trim(c.email))=lower(trim(item->>'email'))) or (coalesce(item->>'email','')='' and lower(trim(c.first_name))=lower(trim(item->>'first_name')) and lower(trim(c.last_name))=lower(trim(item->>'last_name'))))) then skipped_count=skipped_count+1;continue;end if;
   insert into public.contacts(first_name,last_name,job_title,department,email,phone,account_id,notes,owner_id) values(trim(item->>'first_name'),trim(item->>'last_name'),coalesce(item->>'job_title',''),coalesce(item->>'department',''),coalesce(item->>'email',''),coalesce(item->>'phone',''),account,coalesce(item->>'notes',''),auth.uid());
  end if;inserted_count=inserted_count+1;
 end loop;
 insert into public.directory_import_jobs(id,user_id,entity,inserted,skipped) values(request_id,auth.uid(),entity_value,inserted_count,skipped_count);
 return jsonb_build_object('inserted',inserted_count,'skipped',skipped_count,'id',request_id);
end $$;
revoke all on function public.import_directory(text,jsonb,uuid) from public;grant execute on function public.import_directory(text,jsonb,uuid) to authenticated;
create function public.preview_directory_matches(entity_value text,row_values jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$declare item jsonb;data jsonb;result jsonb:='[]';seen text[]:='{}';k text;name_key text;err text;dup boolean;institution text;account uuid;matches integer;begin
 if not public.has_permission('directory.read') or not public.has_permission('directory.write') then raise exception 'Directory write access required' using errcode='42501';end if;
 if entity_value not in ('accounts','contacts') or jsonb_typeof(row_values)<>'array' or jsonb_array_length(row_values) not between 1 and 500 then raise exception 'Invalid preview';end if;
 for item in select * from jsonb_array_elements(row_values) loop
  data=item->'data';err=coalesce(item->>'error','');dup=false;
  if data is not null and data<>'null'::jsonb and err='' then
   if entity_value='contacts' then
    institution=trim(item->>'institution');account=null;
    if institution ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then select count(*) into matches from public.accounts a where a.id=institution::uuid;if matches=1 then account=institution::uuid;end if;
    else select count(*) into matches from public.accounts a where lower(trim(a.name))=lower(institution);if matches=1 then select a.id into account from public.accounts a where lower(trim(a.name))=lower(institution) limit 1;end if;end if;
    if account is null then err='Institution is missing or ambiguous. Import it first, or use its exact ID.';else data=data||jsonb_build_object('account_id',account);end if;
   end if;
   if err='' then
    if entity_value='accounts' then
     k=jsonb_build_array(lower(trim(data->>'name')),lower(trim(coalesce(data->>'country',''))),lower(trim(coalesce(data->>'city',''))))::text;
     dup=k=any(seen) or exists(select 1 from public.accounts a where lower(trim(a.name))=lower(trim(data->>'name')) and lower(trim(a.country))=lower(trim(coalesce(data->>'country',''))) and lower(trim(a.city))=lower(trim(coalesce(data->>'city',''))));seen=array_append(seen,k);
    else
     name_key=jsonb_build_array(account,'name',lower(trim(data->>'first_name')),lower(trim(data->>'last_name')))::text;
     k=case when coalesce(data->>'email','')<>'' then jsonb_build_array(account,'email',lower(trim(data->>'email')))::text else name_key end;
     dup=k=any(seen) or exists(select 1 from public.contacts c where c.account_id=account and ((coalesce(data->>'email','')<>'' and lower(trim(c.email))=lower(trim(data->>'email'))) or (coalesce(data->>'email','')='' and lower(trim(c.first_name))=lower(trim(data->>'first_name')) and lower(trim(c.last_name))=lower(trim(data->>'last_name')))));
     seen=array_append(array_append(seen,k),name_key);
    end if;
   end if;
  end if;
  result=result||jsonb_build_array(jsonb_build_object('row',item->'row','data',data,'error',err,'duplicate',dup));
 end loop;return result;
end $$;
revoke all on function public.preview_directory_matches(text,jsonb) from public;grant execute on function public.preview_directory_matches(text,jsonb) to authenticated;
commit;
