create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_ids uuid[];
  v_target_email text;
  v_target_user_id uuid := target_user_id;
begin
  if v_target_user_id is null then
    raise exception 'target_user_id is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;

  if v_target_user_id = auth.uid() then
    raise exception 'Admin cannot delete current signed-in account.';
  end if;

  select lower(u.email)
  into v_target_email
  from auth.users u
  where u.id = v_target_user_id
  limit 1;

  if v_target_email is not null
     and to_regclass('public.password_reset_codes') is not null then
    delete from public.password_reset_codes
    where email = v_target_email;
  end if;

  if to_regclass('public.claims') is not null then
    begin
      delete from public.claims
      where reviewed_by = v_target_user_id;
    exception
      when undefined_column then
        null;
    end;
  end if;

  if to_regclass('public.reports') is not null then
    begin
      delete from public.reports
      where user_id = v_target_user_id;
    exception
      when undefined_column then
        null;
    end;
  end if;

  if to_regclass('public.flags') is not null then
    begin
      delete from public.flags
      where reporter_id = v_target_user_id
         or target_user_id = v_target_user_id;
    exception
      when undefined_column then
        null;
    end;
  end if;

  if to_regclass('public.notifications') is not null then
    delete from public.notifications
    where user_id = v_target_user_id;
  end if;

  if to_regclass('public.message_messages') is not null then
    delete from public.message_messages
    where sender_id = v_target_user_id;
  end if;

  if to_regclass('public.messages') is not null then
    delete from public.messages
    where sender_id = v_target_user_id;
  end if;

  if to_regclass('public.message_participants') is not null then
    delete from public.message_participants
    where user_id = v_target_user_id;
  end if;

  if to_regclass('public.items') is not null then
    select coalesce(array_agg(i.id), array[]::uuid[])
    into v_item_ids
    from public.items i
    where i.reporter_id = v_target_user_id;

    if coalesce(array_length(v_item_ids, 1), 0) > 0 then
      if to_regclass('public.reports') is not null then
        begin
          delete from public.reports
          where item_id = any(v_item_ids);
        exception
          when undefined_column then
            null;
        end;
      end if;

      if to_regclass('public.flags') is not null then
        begin
          delete from public.flags
          where item_id = any(v_item_ids);
        exception
          when undefined_column then
            null;
        end;
      end if;

      delete from public.items
      where id = any(v_item_ids);
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    delete from public.profiles
    where id = v_target_user_id;
  end if;

  delete from auth.users
  where id = v_target_user_id;

  if not exists (
    select 1 from auth.users where id = v_target_user_id
  ) and not exists (
    select 1 from public.profiles where id = v_target_user_id
  ) then
    return;
  end if;

  raise exception 'User deletion did not complete.';
end;
$$;
