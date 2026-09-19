create or replace function public.get_group_settings(
  p_group_id uuid
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  type text,
  currency text,
  description text,
  created_at timestamptz,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null then
    raise exception 'Group information is missing';
  end if;

  select g.owner_id
  into v_owner_id
  from public.groups g
  where g.id = p_group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  if not private.is_group_member_or_owner(p_group_id, v_caller) then
    raise exception 'You are not an active member of this group';
  end if;

  return query
  select
    g.id,
    g.owner_id,
    g.name,
    g.type,
    g.currency,
    g.description,
    g.created_at,
    (g.owner_id = v_caller)
  from public.groups g
  where g.id = p_group_id;
end;
$$;

revoke all on function public.get_group_settings(uuid)
from public, anon;
grant execute on function public.get_group_settings(uuid)
to authenticated;

-- FairShare Sprint 5.20
-- Group settings, owner edit, member leave, owner delete.

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

  update public.groups
  set
    name = v_name,
    type = v_type,
    currency = v_currency,
    description = v_description
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$$;

revoke all on function public.update_group_settings(uuid, text, text, text, text)
from public, anon;
grant execute on function public.update_group_settings(uuid, text, text, text, text)
to authenticated;

create or replace function public.leave_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner_id uuid;
  v_status text;
  v_net numeric;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select owner_id
  into v_owner_id
  from public.groups
  where id = p_group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id = v_caller then
    raise exception 'The group owner cannot leave the group';
  end if;

  select status
  into v_status
  from public.group_members
  where group_id = p_group_id
    and user_id = v_caller
  limit 1;

  if v_status is null then
    raise exception 'You are not a member of this group';
  end if;

  if v_status <> 'active' then
    raise exception 'You do not have an active membership in this group';
  end if;

  select coalesce(net_balance, 0)
  into v_net
  from public.get_group_balances(p_group_id)
  where user_id = v_caller;

  if coalesce(abs(v_net), 0) > 0.005 then
    raise exception 'You must settle your balance before leaving the group';
  end if;

  delete from public.group_members
  where group_id = p_group_id
    and user_id = v_caller;
end;
$$;

revoke all on function public.leave_group(uuid)
from public, anon;
grant execute on function public.leave_group(uuid)
to authenticated;

create or replace function public.delete_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  select owner_id
  into v_owner_id
  from public.groups
  where id = p_group_id;

  if not found then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> v_caller then
    raise exception 'Only the group owner can delete the group';
  end if;

  delete from public.groups
  where id = p_group_id;
end;
$$;

revoke all on function public.delete_group(uuid)
from public, anon;
grant execute on function public.delete_group(uuid)
to authenticated;
