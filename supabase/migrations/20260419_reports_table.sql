-- Reports table for item moderation and admin review.
create extension if not exists pgcrypto;
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete
  set null,
    item_id uuid null references public.items(id) on delete
  set null,
    item_name text null,
    reason text not null,
    target text not null,
    body text null,
    severity text not null default 'medium',
    status text not null default 'open',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_reports_status_created_at on public.reports(status, created_at desc);
create index if not exists idx_reports_user_id on public.reports(user_id);
create index if not exists idx_reports_item_id on public.reports(item_id);
alter table public.reports enable row level security;
drop policy if exists "reports_select_authenticated" on public.reports;
create policy "reports_select_authenticated" on public.reports for
select using (auth.uid() is not null);
drop policy if exists "reports_insert_authenticated" on public.reports;
create policy "reports_insert_authenticated" on public.reports for
insert with check (auth.uid() is not null);
drop policy if exists "reports_update_authenticated" on public.reports;
create policy "reports_update_authenticated" on public.reports for
update using (auth.uid() is not null) with check (auth.uid() is not null);
drop policy if exists "reports_delete_authenticated" on public.reports;
create policy "reports_delete_authenticated" on public.reports for delete using (auth.uid() is not null);
alter table if exists public.items
add column if not exists custom_category text,
  add column if not exists custody_note text,
  add column if not exists contact_method text,
  add column if not exists contact_value text,
  add column if not exists notify_on_match boolean;
alter table if exists public.message_participants
add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz;
create or replace function public.handle_auth_user_deleted() returns trigger language plpgsql security definer
set search_path = public as $$ begin
delete from public.profiles
where id = old.id;
return old;
end;
$$;
drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
after delete on auth.users for each row execute function public.handle_auth_user_deleted();
create or replace function public.handle_profile_deleted() returns trigger language plpgsql security definer
set search_path = public as $$ begin
delete from auth.users
where id = old.id;
return old;
end;
$$;
drop trigger if exists on_profile_deleted on public.profiles;
create trigger on_profile_deleted
after delete on public.profiles for each row execute function public.handle_profile_deleted();
create or replace function public.admin_list_users() returns table (
    id uuid,
    full_name text,
    email text,
    college_dept text,
    year_section text,
    status text,
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
create or replace function public.admin_delete_user(target_user_id uuid) returns void language plpgsql security definer
set search_path = public as $$ begin if target_user_id is null then raise exception 'target_user_id is required.';
end if;
if not exists (
  select 1
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.role, 'user') = 'admin'
) then raise exception 'Admin access required.';
end if;
if target_user_id = auth.uid() then raise exception 'Admin cannot delete current signed-in account.';
end if;
delete from auth.users
where id = target_user_id;
end;
$$;
create or replace function public.messaging_start_contact(
    p_conversation_id text,
    p_item_id uuid,
    p_title text,
    p_context text,
    p_masked_identity text,
    p_other_user_id uuid
  ) returns table (
    id text,
    item_id uuid,
    title text,
    context text,
    masked_identity text,
    blocked boolean,
    reported boolean,
    updated_at timestamptz,
    created_at timestamptz,
    unread_count integer
  ) language plpgsql security definer
set search_path = public
set row_security = off as $$
declare v_uid uuid := auth.uid();
v_conversation_id text := coalesce(
  nullif(trim(p_conversation_id), ''),
  'conv-' || replace(gen_random_uuid()::text, '-', '')
);
begin if v_uid is null then raise exception 'Authentication required.';
end if;
insert into public.profiles (id, email, full_name, status)
select u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(u.email, '@', 1)
  ),
  'active'
from auth.users u
where u.id = v_uid on conflict on constraint profiles_pkey do nothing;
if p_other_user_id is not null then
insert into public.profiles (id, email, full_name, status)
select u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data->>'full_name', ''),
    split_part(u.email, '@', 1)
  ),
  'active'
from auth.users u
where u.id = p_other_user_id on conflict on constraint profiles_pkey do nothing;
end if;
insert into public.message_conversations (
    id,
    item_id,
    title,
    context,
    masked_identity,
    created_by,
    blocked,
    reported,
    updated_at
  )
values (
    v_conversation_id,
    p_item_id,
    coalesce(nullif(trim(p_title), ''), 'Secure conversation'),
    coalesce(nullif(trim(p_context), ''), 'Item discussion'),
    coalesce(nullif(trim(p_masked_identity), ''), 'user_***'),
    v_uid,
    false,
    false,
    now()
  ) on conflict on constraint message_conversations_pkey do
update
set updated_at = now();
insert into public.message_participants (
    conversation_id,
    user_id,
    unread_count,
    last_read_at
  )
values (v_conversation_id, v_uid, 0, now()) on conflict (conversation_id, user_id) do
update
set last_read_at = excluded.last_read_at;
if p_other_user_id is not null
and p_other_user_id <> v_uid then
insert into public.message_participants (
    conversation_id,
    user_id,
    unread_count,
    last_read_at
  )
values (v_conversation_id, p_other_user_id, 0, now()) on conflict (conversation_id, user_id) do nothing;
end if;
return query
select c.id as id,
  c.item_id,
  c.title,
  c.context,
  c.masked_identity,
  c.blocked,
  c.reported,
  c.updated_at,
  c.created_at,
  coalesce(mp.unread_count, 0)
from public.message_conversations c
  left join public.message_participants mp on mp.conversation_id = c.id
  and mp.user_id = v_uid
where c.id = v_conversation_id;
end;
$$;
create or replace function public.messaging_send_message(p_conversation_id text, p_body text) returns void language plpgsql security definer
set search_path = public
set row_security = off as $$
declare v_uid uuid := auth.uid();
v_body text := nullif(trim(coalesce(p_body, '')), '');
begin if v_uid is null then raise exception 'Authentication required.';
end if;
if p_conversation_id is null
or trim(p_conversation_id) = '' then raise exception 'Conversation id is required.';
end if;
if v_body is null then raise exception 'Message body is required.';
end if;
if not exists (
  select 1
  from public.message_participants mp
  where mp.conversation_id = p_conversation_id
    and mp.user_id = v_uid
) then raise exception 'You are not a participant in this conversation.';
end if;
insert into public.message_messages (conversation_id, sender_id, body, created_at)
values (p_conversation_id, v_uid, v_body, now());
update public.message_conversations
set updated_at = now()
where message_conversations.id = p_conversation_id;
update public.message_participants
set unread_count = coalesce(unread_count, 0) + 1
where conversation_id = p_conversation_id
  and user_id <> v_uid;
end;
$$;
create or replace function public.messaging_archive_conversation(p_conversation_id text) returns void language plpgsql security definer
set search_path = public
set row_security = off as $$
declare v_uid uuid := auth.uid();
begin if v_uid is null then raise exception 'Authentication required.';
end if;
if p_conversation_id is null
or trim(p_conversation_id) = '' then raise exception 'Conversation id is required.';
end if;
if not exists (
  select 1
  from public.message_participants mp
  where mp.conversation_id = p_conversation_id
    and mp.user_id = v_uid
) then raise exception 'You are not a participant in this conversation.';
end if;
update public.message_participants
set archived_at = now(),
  deleted_at = null,
  last_read_at = now()
where conversation_id = p_conversation_id
  and user_id = v_uid;
end;
$$;
create or replace function public.messaging_delete_conversation(p_conversation_id text) returns void language plpgsql security definer
set search_path = public
set row_security = off as $$
declare v_uid uuid := auth.uid();
begin if v_uid is null then raise exception 'Authentication required.';
end if;
if p_conversation_id is null
or trim(p_conversation_id) = '' then raise exception 'Conversation id is required.';
end if;
if not exists (
  select 1
  from public.message_participants mp
  where mp.conversation_id = p_conversation_id
    and mp.user_id = v_uid
) then raise exception 'You are not a participant in this conversation.';
end if;
update public.message_participants
set deleted_at = now(),
  last_read_at = now()
where conversation_id = p_conversation_id
  and user_id = v_uid;
end;
$$;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.messaging_start_contact(text, uuid, text, text, text, uuid) to authenticated;
grant execute on function public.messaging_send_message(text, text) to authenticated;
grant execute on function public.messaging_archive_conversation(text) to authenticated;
grant execute on function public.messaging_delete_conversation(text) to authenticated;