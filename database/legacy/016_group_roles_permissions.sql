-- FairShare Sprint 5.21
-- Group roles and permissions.
-- Roles:
--   owner  = full access
--   admin  = member management + money management; no role assignment/group deletion
--   member = normal money management; no member management/group settings
--   viewer = read-only

alter table public.group_members
drop constraint if exists group_members_role_check;

alter table public.group_members
add constraint group_members_role_check
check (role in ('owner','admin','member','viewer'));

update public.group_members gm
set role = 'owner'
from public.groups g
where g.id = gm.group_id
  and g.owner_id = gm.user_id;

-- Resolve a member's role without invoking group_members RLS recursively.
create or replace function private.get_group_role(
  p_group_id uuid,
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.groups g
      where g.id = p_group_id
        and g.owner_id = p_user_id
    ) then 'owner'
    else (
      select gm.role
      from public.group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = p_user_id
        and gm.status = 'active'
      limit 1
    )
  end;
$$;

revoke all on function private.get_group_role(uuid,uuid) from public, anon, authenticated;

create or replace function private.is_group_write_member(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.get_group_role(p_group_id, p_user_id) in ('owner','admin','member'), false);
$$;

revoke all on function private.is_group_write_member(uuid,uuid) from public, anon, authenticated;

create or replace function private.can_manage_group_members(
  p_group_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.get_group_role(p_group_id, p_user_id) in ('owner','admin'), false);
$$;

revoke all on function private.can_manage_group_members(uuid,uuid) from public, anon, authenticated;

create or replace function private.can_remove_group_member(
  p_group_id uuid,
  p_caller_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case private.get_group_role(p_group_id, p_caller_id)
      when 'owner' then not exists (
        select 1
        from public.groups g
        where g.id = p_group_id
          and g.owner_id = p_target_user_id
      )
      when 'admin' then coalesce(
        (
          select gm.role
          from public.group_members gm
          where gm.group_id = p_group_id
            and gm.user_id = p_target_user_id
            and gm.status = 'active'
          limit 1
        ) in ('member','viewer'),
        false
      )
      else false
    end;
$$;

revoke all on function private.can_remove_group_member(uuid,uuid,uuid) from public, anon, authenticated;

-- Owner is the only role administrator. It is intentionally impossible to
-- assign owner through this function.
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

  if v_role not in ('admin','member','viewer') then
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

  update public.group_members
  set role = v_role
  where group_id = p_group_id
    and user_id = p_user_id
    and status = 'active';

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
    and gm.user_id = p_user_id;
end;
$$;

revoke all on function public.update_group_member_role(uuid,uuid,text)
from public, anon;
grant execute on function public.update_group_member_role(uuid,uuid,text)
to authenticated;

create or replace function public.get_group_member_roles(
  p_group_id uuid
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
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_group_member_or_owner(p_group_id, v_caller) then
    raise exception 'You are not an active member of this group';
  end if;

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
  order by
    case gm.role
      when 'owner' then 0
      when 'admin' then 1
      when 'member' then 2
      when 'viewer' then 3
      else 4
    end,
    gm.created_at asc;
end;
$$;

revoke all on function public.get_group_member_roles(uuid)
from public, anon;
grant execute on function public.get_group_member_roles(uuid)
to authenticated;

-- Extend the group settings response with the caller's role.
drop function if exists public.get_group_settings(uuid);
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
  is_owner boolean,
  role text
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
    (g.owner_id = v_caller),
    coalesce(private.get_group_role(g.id, v_caller), 'member')
  from public.groups g
  where g.id = p_group_id;
end;
$$;

revoke all on function public.get_group_settings(uuid)
from public, anon;
grant execute on function public.get_group_settings(uuid)
to authenticated;

-- Admins may remove normal members/viewers, but cannot remove admins/owner.
drop policy if exists "Owners can delete group members" on public.group_members;
create policy "Owners and admins can delete group members"
on public.group_members
for delete
to authenticated
using (
  private.can_remove_group_member(group_id, auth.uid(), user_id)
);

-- Viewer users remain read-only at the SQL security boundary. These triggers
-- protect SECURITY DEFINER expense/settlement functions as well as direct writes.
create or replace function private.block_viewer_expense_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not private.is_group_write_member(old.group_id, auth.uid()) then
      raise exception 'Viewers cannot create, edit, or delete expenses';
    end if;
    return old;
  end if;

  if not private.is_group_write_member(new.group_id, auth.uid()) then
    raise exception 'Viewers cannot create, edit, or delete expenses';
  end if;

  return new;
end;
$$;

revoke all on function private.block_viewer_expense_write() from public, anon, authenticated;

drop trigger if exists prevent_viewer_expense_write on public.expenses;
create trigger prevent_viewer_expense_write
before insert or update or delete on public.expenses
for each row execute function private.block_viewer_expense_write();

create or replace function private.block_viewer_settlement_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if not private.is_group_write_member(old.group_id, auth.uid()) then
      raise exception 'Viewers cannot create, edit, or delete settlements';
    end if;
    return old;
  end if;

  if not private.is_group_write_member(new.group_id, auth.uid()) then
    raise exception 'Viewers cannot create, edit, or delete settlements';
  end if;

  return new;
end;
$$;

revoke all on function private.block_viewer_settlement_write() from public, anon, authenticated;

drop trigger if exists prevent_viewer_settlement_write on public.settlements;
create trigger prevent_viewer_settlement_write
before insert or update or delete on public.settlements
for each row execute function private.block_viewer_settlement_write();

-- Keep invitation/removal UI permission aligned with the database role model.
-- Existing invite Edge Function checks owner/admin using the service role.
