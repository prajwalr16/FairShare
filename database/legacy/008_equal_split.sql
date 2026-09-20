-- FairShare Sprint 5.12
-- Equal Split: secure, atomic expense + split creation.

create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (expense_id, user_id)
);

alter table public.expense_splits enable row level security;

grant select on public.expense_splits to authenticated;

drop policy if exists "Users can view group expense splits" on public.expense_splits;
create policy "Users can view group expense splits"
on public.expense_splits
for select
to authenticated
using (
  exists (
    select 1
    from public.expenses e
    where e.id = public.expense_splits.expense_id
      and private.is_group_member_or_owner(
        e.group_id,
        (select auth.uid())
      )
  )
);

create or replace function public.create_equal_expense(
  p_group_id uuid,
  p_title text,
  p_amount numeric,
  p_paid_by uuid,
  p_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_participants uuid[];
  v_input_count integer;
  v_member_count integer;
  v_expense_id uuid;
  v_total_cents bigint;
  v_base_cents bigint;
  v_share_cents bigint;
  i integer;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_group_id is null then
    raise exception 'Group information is missing';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Expense title is required';
  end if;

  if length(trim(p_title)) > 120 then
    raise exception 'Expense title must be 120 characters or less';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Expense amount must be greater than 0';
  end if;

  if p_amount <> round(p_amount, 2) then
    raise exception 'Expense amount supports up to 2 decimal places';
  end if;

  if p_paid_by is null then
    raise exception 'Payer information is missing';
  end if;

  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    raise exception 'At least one split participant is required';
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
      and gm.user_id = p_paid_by
      and gm.status = 'active'
  ) then
    raise exception 'The payer must be an active member of the group';
  end if;

  select count(*)
    into v_input_count
  from (
    select distinct unnest(p_user_ids) as user_id
  ) input_users;

  select
    array_agg(gm.user_id order by gm.user_id),
    count(*)
    into v_participants, v_member_count
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.status = 'active'
    and gm.user_id = any(p_user_ids);

  if v_member_count is null or v_member_count = 0 then
    raise exception 'At least one active group member must be selected';
  end if;

  if v_input_count <> v_member_count then
    raise exception 'Every selected participant must be an active member of the group';
  end if;

  v_total_cents := round(p_amount * 100)::bigint;
  v_base_cents := v_total_cents / v_member_count;

  insert into public.expenses (
    group_id,
    title,
    amount,
    split_type,
    paid_by
  )
  values (
    p_group_id,
    trim(p_title),
    p_amount,
    'Equal',
    p_paid_by
  )
  returning id into v_expense_id;

  for i in 1..v_member_count loop
    if i = v_member_count then
      v_share_cents := v_total_cents - (v_base_cents * (v_member_count - 1));
    else
      v_share_cents := v_base_cents;
    end if;

    insert into public.expense_splits (
      expense_id,
      user_id,
      amount
    )
    values (
      v_expense_id,
      v_participants[i],
      v_share_cents / 100.0
    );
  end loop;

  return v_expense_id;
end;
$$;

revoke all on function public.create_equal_expense(uuid, text, numeric, uuid, uuid[])
from public, anon;

grant execute on function public.create_equal_expense(uuid, text, numeric, uuid, uuid[])
to authenticated;