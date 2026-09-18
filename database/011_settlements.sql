-- FairShare Sprint 5.16
-- Settlement records, secure recording, settlement-aware balances.

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint settlements_different_users check (from_user_id <> to_user_id),
  constraint settlements_note_length check (note is null or length(trim(note)) <= 200)
);

create index if not exists idx_settlements_group_created
  on public.settlements(group_id, created_at desc);

create index if not exists idx_settlements_group_from
  on public.settlements(group_id, from_user_id);

create index if not exists idx_settlements_group_to
  on public.settlements(group_id, to_user_id);

alter table public.settlements enable row level security;

revoke all on public.settlements from anon;
revoke insert, update, delete on public.settlements from authenticated;
grant select on public.settlements to authenticated;

drop policy if exists "Users can view group settlements" on public.settlements;
create policy "Users can view group settlements"
on public.settlements
for select
to authenticated
using (
  private.is_group_member_or_owner(group_id, auth.uid())
);

-- Refresh the balance function so recorded settlements affect each member's net.
create or replace function public.get_group_balances(
  p_group_id uuid
)
returns table (
  user_id uuid,
  full_name text,
  email text,
  role text,
  total_paid numeric,
  total_owed numeric,
  net_balance numeric
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

  if p_group_id is null then
    raise exception 'Group information is missing';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and (
        g.owner_id = v_caller
        or exists (
          select 1
          from public.group_members gm
          where gm.group_id = g.id
            and gm.user_id = v_caller
            and gm.status = 'active'
        )
      )
  ) then
    raise exception 'You are not an active member of this group';
  end if;

  return query
  with paid as (
    select
      e.paid_by as user_id,
      sum(e.amount)::numeric as total_paid
    from public.expenses e
    where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    select
      es.user_id,
      sum(es.amount)::numeric as total_owed
    from public.expense_splits es
    join public.expenses e
      on e.id = es.expense_id
    where e.group_id = p_group_id
    group by es.user_id
  ),
  received as (
    select
      s.to_user_id as user_id,
      sum(s.amount)::numeric as total_received
    from public.settlements s
    where s.group_id = p_group_id
    group by s.to_user_id
  ),
  sent as (
    select
      s.from_user_id as user_id,
      sum(s.amount)::numeric as total_sent
    from public.settlements s
    where s.group_id = p_group_id
    group by s.from_user_id
  )
  select
    gm.user_id,
    nullif(trim(p.full_name), ''),
    gm.email,
    gm.role,
    coalesce(paid.total_paid, 0)::numeric,
    coalesce(owed.total_owed, 0)::numeric,
    (
      coalesce(paid.total_paid, 0)
      - coalesce(owed.total_owed, 0)
      + coalesce(received.total_received, 0)
      - coalesce(sent.total_sent, 0)
    )::numeric as net_balance
  from public.group_members gm
  left join public.profiles p
    on p.id = gm.user_id
  left join paid
    on paid.user_id = gm.user_id
  left join owed
    on owed.user_id = gm.user_id
  left join received
    on received.user_id = gm.user_id
  left join sent
    on sent.user_id = gm.user_id
  where gm.group_id = p_group_id
    and gm.status = 'active'
  order by
    case when gm.user_id = v_caller then 0 else 1 end,
    coalesce(nullif(trim(p.full_name), ''), gm.email, '') asc;
end;
$$;

revoke all on function public.get_group_balances(uuid)
from public, anon;

grant execute on function public.get_group_balances(uuid)
to authenticated;

-- Record a payment atomically and prevent over-settling the current net debt.
create or replace function public.record_group_settlement(
  p_group_id uuid,
  p_from_user_id uuid,
  p_to_user_id uuid,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_from_net numeric;
  v_to_net numeric;
  v_settlement_id uuid;
  v_note text := nullif(trim(p_note), '');
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null then
    raise exception 'Group information is missing';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and (
        g.owner_id = v_caller
        or exists (
          select 1
          from public.group_members gm
          where gm.group_id = g.id
            and gm.user_id = v_caller
            and gm.status = 'active'
        )
      )
  ) then
    raise exception 'You are not an active member of this group';
  end if;

  if p_from_user_id is null or p_to_user_id is null then
    raise exception 'Both settlement members are required';
  end if;

  if p_from_user_id = p_to_user_id then
    raise exception 'A settlement must have different payer and recipient';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Settlement amount must be greater than 0';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'Settlement amount supports up to 2 decimal places';
  end if;

  if v_note is not null and length(v_note) > 200 then
    raise exception 'Settlement note must be 200 characters or less';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_from_user_id
      and gm.status = 'active'
  ) then
    raise exception 'The payer must be an active member of the group';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_to_user_id
      and gm.status = 'active'
  ) then
    raise exception 'The recipient must be an active member of the group';
  end if;

  select
    (
      coalesce((
        select sum(e.amount)
        from public.expenses e
        where e.group_id = p_group_id
          and e.paid_by = p_from_user_id
      ), 0)
      - coalesce((
        select sum(es.amount)
        from public.expense_splits es
        join public.expenses e on e.id = es.expense_id
        where e.group_id = p_group_id
          and es.user_id = p_from_user_id
      ), 0)
      + coalesce((
        select sum(s.amount)
        from public.settlements s
        where s.group_id = p_group_id
          and s.to_user_id = p_from_user_id
      ), 0)
      - coalesce((
        select sum(s.amount)
        from public.settlements s
        where s.group_id = p_group_id
          and s.from_user_id = p_from_user_id
      ), 0)
    ),
    (
      coalesce((
        select sum(e.amount)
        from public.expenses e
        where e.group_id = p_group_id
          and e.paid_by = p_to_user_id
      ), 0)
      - coalesce((
        select sum(es.amount)
        from public.expense_splits es
        join public.expenses e on e.id = es.expense_id
        where e.group_id = p_group_id
          and es.user_id = p_to_user_id
      ), 0)
      + coalesce((
        select sum(s.amount)
        from public.settlements s
        where s.group_id = p_group_id
          and s.to_user_id = p_to_user_id
      ), 0)
      - coalesce((
        select sum(s.amount)
        from public.settlements s
        where s.group_id = p_group_id
          and s.from_user_id = p_to_user_id
      ), 0)
    )
  into v_from_net, v_to_net;

  if v_from_net >= -0.005 then
    raise exception 'The selected payer does not currently owe money in this group';
  end if;

  if v_to_net <= 0.005 then
    raise exception 'The selected recipient is not currently owed money in this group';
  end if;

  if p_amount > round(abs(v_from_net), 2) + 0.000001 then
    raise exception 'Settlement amount exceeds the payer current balance';
  end if;

  if p_amount > round(v_to_net, 2) + 0.000001 then
    raise exception 'Settlement amount exceeds the recipient current balance';
  end if;

  insert into public.settlements (
    group_id,
    from_user_id,
    to_user_id,
    amount,
    note,
    created_by
  )
  values (
    p_group_id,
    p_from_user_id,
    p_to_user_id,
    round(p_amount, 2),
    v_note,
    v_caller
  )
  returning id into v_settlement_id;

  return v_settlement_id;
end;
$$;

revoke all on function public.record_group_settlement(uuid, uuid, uuid, numeric, text)
from public, anon;

grant execute on function public.record_group_settlement(uuid, uuid, uuid, numeric, text)
to authenticated;