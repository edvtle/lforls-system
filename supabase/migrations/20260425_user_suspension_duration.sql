alter table if exists public.profiles
add column if not exists suspended_until timestamptz;
create index if not exists idx_profiles_suspended_until on public.profiles(suspended_until)
where status = 'suspended';
create or replace function public.admin_list_users() returns table (
    id uuid,
    full_name text,
    email text,
    college_dept text,
    year_section text,
    status text,
    suspended_until timestamptz,
    reports_count integer
  ) language plpgsql security definer
set search_path = public as $$ begin if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') = 'admin'
  ) then raise exception 'Admin access required.';
end if;
return query
select u.id,
  coalesce(
    nullif(p.full_name, ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(u.email, '@', 1),
    'Unnamed user'
  ) as full_name,
  coalesce(p.email, u.email, '') as email,
  coalesce(nullif(p.college_dept, ''), 'N/A') as college_dept,
  coalesce(nullif(p.year_section, ''), 'N/A') as year_section,
  coalesce(nullif(p.status, ''), 'active') as status,
  p.suspended_until,
  coalesce(i.items_count, 0)::int as reports_count
from auth.users u
  left join public.profiles p on p.id = u.id
  left join (
    select reporter_id,
      count(*)::int as items_count
    from public.items
    group by reporter_id
  ) i on i.reporter_id = u.id
order by lower(
    coalesce(
      nullif(p.full_name, ''),
      nullif(u.email, ''),
      'zzz'
    )
  ) asc;
end;
$$;
grant execute on function public.admin_list_users() to authenticated;