create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Profiles: user-facing identity separate from auth.users.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

-- Own profile, or profiles of people who share a group with the caller.
drop policy if exists "Users can view visible profiles" on public.profiles;
create policy "Users can view visible profiles"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members target_member
    join public.groups target_group
      on target_group.id = target_member.group_id
    where target_member.user_id = public.profiles.id
      and target_group.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members target_member
    join public.group_members my_member
      on my_member.group_id = target_member.group_id
    where target_member.user_id = public.profiles.id
      and my_member.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Keep updated_at current when a profile changes.
create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_profile_updated_at();

-- Create a public profile automatically for every new auth user.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do update
    set full_name = coalesce(
      excluded.full_name,
      public.profiles.full_name
    );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, full_name)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), '')
from auth.users u
on conflict (id) do update
  set full_name = coalesce(
    excluded.full_name,
    public.profiles.full_name
  );

-- ------------------------------------------------------------
-- Group membership status.
-- pending = invited but not yet accepted
-- active  = accepted member
-- ------------------------------------------------------------
alter table public.group_members
add column if not exists status text not null default 'active';

update public.group_members
set status = 'active'
where status is null;

alter table public.group_members
drop constraint if exists group_members_status_check;

alter table public.group_members
add constraint group_members_status_check
check (status in ('pending', 'active'));

-- Pending invitees must at least be able to see their own pending row.
drop policy if exists "Users can view group members" on public.group_members;
create policy "Users can view group members"
on public.group_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members my_member
    where my_member.group_id = group_members.group_id
      and my_member.user_id = auth.uid()
      and my_member.status = 'active'
  )
);

-- The owner remains the only person who can remove a member.
drop policy if exists "Owners can delete group members" on public.group_members;
create policy "Owners can delete group members"
on public.group_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.owner_id = auth.uid()
  )
);

-- The mobile client does not insert memberships directly anymore.
-- Secure server-side invite logic inserts them using the secret key.
drop policy if exists "Members can insert group members" on public.group_members;
drop policy if exists "Users can insert group members" on public.group_members;

-- ------------------------------------------------------------
-- Automatically make the group owner an active member.
-- ------------------------------------------------------------
create or replace function public.add_group_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email
  from auth.users
  where id = new.owner_id;

  if v_email is not null then
    insert into public.group_members (
      group_id,
      user_id,
      email,
      role,
      status
    )
    values (
      new.id,
      new.owner_id,
      lower(v_email),
      'owner',
      'active'
    )
    on conflict (group_id, email) do update
      set user_id = excluded.user_id,
          role = 'owner',
          status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists groups_add_owner_member on public.groups;
create trigger groups_add_owner_member
after insert on public.groups
for each row execute procedure public.add_group_owner_as_member();

-- Backfill owner membership for existing groups.
insert into public.group_members (
  group_id,
  user_id,
  email,
  role,
  status
)
select
  g.id,
  g.owner_id,
  lower(u.email),
  'owner',
  'active'
from public.groups g
join auth.users u
  on u.id = g.owner_id
where not exists (
  select 1
  from public.group_members gm
  where gm.group_id = g.id
    and gm.user_id = g.owner_id
)
on conflict (group_id, email) do update
  set user_id = excluded.user_id,
      role = 'owner',
      status = 'active';

-- ------------------------------------------------------------
-- Server-only lookup helper for the Edge Function.
-- It is not executable from the mobile client's roles.
-- ------------------------------------------------------------
create or replace function public.lookup_user_by_email(p_email text)
returns table (
  id uuid,
  email text,
  confirmed boolean
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.email,
    (u.email_confirmed_at is not null) as confirmed
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.lookup_user_by_email(text)
from public, anon, authenticated;

-- ------------------------------------------------------------
-- Accept invitation securely. The client can only activate
-- its own pending membership; group/role/user_id cannot be changed.
-- ------------------------------------------------------------
create or replace function public.accept_group_invitation(p_group_id uuid)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.group_members;
begin
  update public.group_members
  set status = 'active'
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'pending'
  returning * into v_member;

  if v_member.id is null then
    raise exception 'No pending invitation was found for this account';
  end if;

  return v_member;
end;
$$;

revoke all on function public.accept_group_invitation(uuid)
from public, anon;

grant execute on function public.accept_group_invitation(uuid)
to authenticated;
