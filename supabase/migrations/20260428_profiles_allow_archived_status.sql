alter table if exists public.profiles
drop constraint if exists profiles_status_check;

alter table if exists public.profiles
add constraint profiles_status_check
check (status in ('active', 'suspended', 'banned', 'archived'));
