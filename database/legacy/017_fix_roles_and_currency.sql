-- FairShare Sprint 5.21.1
-- Fix role update ambiguity and protect the group's base currency.
-- Base currency is currently the currency used by all expense/settlement amounts
-- in the group. Until per-expense currencies are implemented, changing the base
-- currency after financial records exist would relabel historical amounts.

create or replace function public.update_group_member_role(
  p_group_id uuid,
  p_user_id uuid,
  p_role text
)
returns table (
  id uuid,
  group_id uuid,
  user_id uuid,
  email text,
  role text,
  status text,
  created_at timestamptz,
  full_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_role text := lower(trim(p_role));
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = v_caller
  ) then
    raise exception 'Only the group owner can change member roles';
  end if;

  if p_user_id is null then
    raise exception 'Member information is missing';
  end if;

  if v_role not in ('admin', 'member', 'viewer') then
    raise exception 'Invalid member role';
  end if;

  if exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_id = p_user_id
  ) then
    raise exception 'The group owner must keep the owner role';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'active'
  ) then
    raise exception 'The target user is not an active group member';
  end if;

  update public.group_members gm
  set role = v_role
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id
    and gm.status = 'active';

  return query
  select
    gm.id,
    gm.group_id,
    gm.user_id,
    gm.email,
    gm.role,
    gm.status,
    gm.created_at,
    nullif(trim(p.full_name), '')
  from public.group_members gm
  left join public.profiles p on p.id = gm.user_id
  where gm.group_id = p_group_id
    and gm.user_id = p_user_id
    and gm.status = 'active';
end;
$$;

revoke all on function public.update_group_member_role(uuid, uuid, text)
from public, anon;
grant execute on function public.update_group_member_role(uuid, uuid, text)
to authenticated;

-- Recreate the settings update function so base currency is mutable only
-- while the group has no expenses or settlements.
create or replace function public.update_group_settings(
  p_group_id uuid,
  p_name text,
  p_type text,
  p_currency text,
  p_description text default null
)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_name text := nullif(trim(p_name), '');
  v_type text := nullif(trim(p_type), '');
  v_currency text := upper(nullif(trim(p_currency), ''));
  v_description text := nullif(trim(p_description), '');
  v_group public.groups;
  v_has_financial_records boolean := false;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null then
    raise exception 'Group information is missing';
  end if;

  if v_name is null then
    raise exception 'Group name is required';
  end if;

  if length(v_name) > 80 then
    raise exception 'Group name must be 80 characters or less';
  end if;

  if v_type is null or v_type not in ('Trip', 'Home', 'Friends', 'Office', 'Other') then
    raise exception 'Invalid group type';
  end if;

  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be a valid 3-letter code';
  end if;

  if v_description is not null and length(v_description) > 500 then
    raise exception 'Group description must be 500 characters or less';
  end if;

  select g.*
  into v_group
  from public.groups g
  where g.id = p_group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_group.owner_id <> v_caller then
    raise exception 'Only the group owner can edit group settings';
  end if;

  if v_currency <> upper(coalesce(v_group.currency, 'INR')) then
    select exists (
      select 1 from public.expenses e where e.group_id = p_group_id
    )
    or exists (
      select 1 from public.settlements s where s.group_id = p_group_id
    )
    into v_has_financial_records;

    if v_has_financial_records then
      raise exception 'Base currency cannot be changed after expenses or settlements have been recorded';
    end if;
  end if;

  update public.groups g
  set
    name = v_name,
    type = v_type,
    currency = v_currency,
    description = v_description
  where g.id = p_group_id
  returning g.* into v_group;

  return v_group;
end;
$$;

revoke all on function public.update_group_settings(uuid, text, text, text, text)
from public, anon;
grant execute on function public.update_group_settings(uuid, text, text, text, text)
to authenticated;
