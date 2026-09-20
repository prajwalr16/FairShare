-- FairShare Sprint 5.14
-- Group balance overview derived from expenses and expense_splits.
-- Positive net_balance = member is owed money by the group.
-- Negative net_balance = member owes money to the group.

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
    )::numeric as net_balance
  from public.group_members gm
  left join public.profiles p
    on p.id = gm.user_id
  left join paid
    on paid.user_id = gm.user_id
  left join owed
    on owed.user_id = gm.user_id
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