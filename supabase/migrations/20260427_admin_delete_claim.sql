create or replace function public.admin_delete_claim(target_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_claim_id is null then
    raise exception 'target_claim_id is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.role, 'user') = 'admin'
  ) then
    raise exception 'Admin access required.';
  end if;

  delete from public.claims
  where id = target_claim_id;
end;
$$;

grant execute on function public.admin_delete_claim(uuid) to authenticated;
