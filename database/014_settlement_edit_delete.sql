-- FairShare Sprint 5.18
-- Secure settlement details, edit, and delete operations.

create or replace function public.update_group_settlement(
  p_group_id uuid,
  p_settlement_id uuid,
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
  v_owner_id uuid;
  v_from_user_id uuid;
  v_to_user_id uuid;
  v_created_by uuid;
  v_from_net numeric;
  v_to_net numeric;
  v_max_amount numeric;
  v_note text := nullif(trim(p_note), '');
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null or p_settlement_id is null then
    raise exception 'Settlement information is missing';
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

  select
    s.from_user_id,
    s.to_user_id,
    s.created_by,
    g.owner_id
  into
    v_from_user_id,
    v_to_user_id,
    v_created_by,
    v_owner_id
  from public.settlements s
  join public.groups g
    on g.id = s.group_id
  where s.id = p_settlement_id
    and s.group_id = p_group_id;

  if not found then
    raise exception 'Settlement not found';
  end if;

  if not (
    v_owner_id = v_caller
    or v_created_by = v_caller
  ) then
    raise exception 'Only the settlement creator or group owner can edit this settlement';
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

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = v_from_user_id
      and gm.status = 'active'
  ) then
    raise exception 'The payer is no longer an active member of the group';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = v_to_user_id
      and gm.status = 'active'
  ) then
    raise exception 'The recipient is no longer an active member of the group';
  end if;

  -- Calculate each party's net balance with this settlement temporarily excluded.
  -- A -> B is valid only while A is negative and B is positive.
  with paid as (
    select e.paid_by as user_id, sum(e.amount)::numeric as total_paid
    from public.expenses e
    where e.group_id = p_group_id
    group by e.paid_by
  ),
  owed as (
    select es.user_id, sum(es.amount)::numeric as total_owed
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where e.group_id = p_group_id
    group by es.user_id
  ),
  received as (
    select s.to_user_id as user_id, sum(s.amount)::numeric as total_received
    from public.settlements s
    where s.group_id = p_group_id
      and s.id <> p_settlement_id
    group by s.to_user_id
  ),
  sent as (
    select s.from_user_id as user_id, sum(s.amount)::numeric as total_sent
    from public.settlements s
    where s.group_id = p_group_id
      and s.id <> p_settlement_id
    group by s.from_user_id
  ),
  party_nets as (
    select
      u.user_id,
      (
        coalesce(paid.total_paid, 0)
        - coalesce(owed.total_owed, 0)
        + coalesce(sent.total_sent, 0)
        - coalesce(received.total_received, 0)
      )::numeric as net_balance
    from (
      select v_from_user_id as user_id
      union
      select v_to_user_id as user_id
    ) u
    left join paid on paid.user_id = u.user_id
    left join owed on owed.user_id = u.user_id
    left join received on received.user_id = u.user_id
    left join sent on sent.user_id = u.user_id
  )
  select
    max(case when user_id = v_from_user_id then net_balance end),
    max(case when user_id = v_to_user_id then net_balance end)
  into v_from_net, v_to_net
  from party_nets;

  if coalesce(v_from_net, 0) >= -0.005 then
    raise exception 'The payer does not currently owe money in this group';
  end if;

  if coalesce(v_to_net, 0) <= 0.005 then
    raise exception 'The recipient is not currently owed money in this group';
  end if;

  v_max_amount := least(
    round(abs(v_from_net), 2),
    round(v_to_net, 2)
  );

  if p_amount > v_max_amount + 0.000001 then
    raise exception 'Settlement amount exceeds the outstanding debt of %', to_char(v_max_amount, 'FM999999990.00');
  end if;

  update public.settlements
  set
    amount = round(p_amount, 2),
    note = v_note
  where id = p_settlement_id
    and group_id = p_group_id;

  return p_settlement_id;
end;
$$;

revoke all on function public.update_group_settlement(uuid, uuid, numeric, text)
from public, anon;

grant execute on function public.update_group_settlement(uuid, uuid, numeric, text)
to authenticated;

create or replace function public.delete_group_settlement(
  p_group_id uuid,
  p_settlement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_owner_id uuid;
  v_created_by uuid;
  v_deleted_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null or p_settlement_id is null then
    raise exception 'Settlement information is missing';
  end if;

  select
    s.created_by,
    g.owner_id
  into
    v_created_by,
    v_owner_id
  from public.settlements s
  join public.groups g
    on g.id = s.group_id
  where s.id = p_settlement_id
    and s.group_id = p_group_id;

  if not found then
    raise exception 'Settlement not found';
  end if;

  if not (
    v_owner_id = v_caller
    or v_created_by = v_caller
  ) then
    raise exception 'Only the settlement creator or group owner can delete this settlement';
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

  delete from public.settlements
  where id = p_settlement_id
    and group_id = p_group_id
  returning id into v_deleted_id;

  return v_deleted_id;
end;
$$;

revoke all on function public.delete_group_settlement(uuid, uuid)
from public, anon;

grant execute on function public.delete_group_settlement(uuid, uuid)
to authenticated;
