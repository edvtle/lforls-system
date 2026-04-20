create or replace function public.admin_delete_report(target_report_id uuid) returns void language plpgsql security definer
set search_path = public as $$ begin if target_report_id is null then raise exception 'target_report_id is required.';
end if;
if not exists (
  select 1
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.role, 'user') = 'admin'
) then raise exception 'Admin access required.';
end if;
delete from public.reports
where id = target_report_id;
end;
$$;