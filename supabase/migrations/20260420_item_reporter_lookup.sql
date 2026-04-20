create or replace function public.list_item_reporters(reporter_ids uuid []) returns table (
    id uuid,
    full_name text,
    email text,
    college_dept text,
    program text,
    year_section text
  ) language sql security definer
set search_path = public
set row_security = off as $$ with ids as (
    select unnest(coalesce(reporter_ids, array []::uuid [])) as id
  )
select ids.id,
  coalesce(
    nullif(p.full_name, ''),
    nullif(u.raw_user_meta_data->>'full_name', ''),
    nullif(
      split_part(coalesce(p.email, u.email, ''), '@', 1),
      ''
    ),
    'Unknown reporter'
  ) as full_name,
  coalesce(nullif(p.email, ''), coalesce(u.email, ''), '') as email,
  coalesce(nullif(p.college_dept, ''), 'Not provided') as college_dept,
  coalesce(nullif(p.program, ''), 'Not provided') as program,
  coalesce(nullif(p.year_section, ''), 'Not provided') as year_section
from ids
  left join public.profiles p on p.id = ids.id
  left join auth.users u on u.id = ids.id;
$$;
grant execute on function public.list_item_reporters(uuid []) to authenticated;