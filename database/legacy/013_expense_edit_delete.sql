-- FairShare Sprint 5.17
-- Secure expense editing and deletion.
-- Any active group member may edit/delete an expense because the current
-- expenses table does not track a creator/owner for each expense.

create or replace function public.update_expense_with_splits(
  p_expense_id uuid,
  p_title text,
  p_amount numeric,
  p_paid_by uuid,
  p_split_type text,
  p_splits jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_group_id uuid;
  v_type text := initcap(trim(coalesce(p_split_type, '')));
  v_total_cents bigint;
  v_member_count integer := 0;
  v_input_count integer := 0;
  v_active_count integer := 0;
  v_value numeric;
  v_total_value_cents bigint := 0;
  v_total_percentage_bp bigint := 0;
  v_total_shares bigint := 0;
  v_allocated_cents bigint := 0;
  v_item jsonb;
  v_expense_id uuid := p_expense_id;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_expense_id is null then
    raise exception 'Expense information is missing';
  end if;

  select e.group_id
    into v_group_id
  from public.expenses e
  where e.id = p_expense_id;

  if v_group_id is null then
    raise exception 'Expense not found';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = v_group_id
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

  if v_type not in ('Equal', 'Exact', 'Percentage', 'Shares') then
    raise exception 'Unsupported split type';
  end if;

  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'At least one split participant is required';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = v_group_id
      and gm.user_id = p_paid_by
      and gm.status = 'active'
  ) then
    raise exception 'The payer must be an active member of the group';
  end if;

  select count(*)
    into v_input_count
  from jsonb_array_elements(p_splits);

  select count(*)
    into v_active_count
  from public.group_members gm
  where gm.group_id = v_group_id
    and gm.status = 'active'
    and gm.user_id = any (
      array(
        select distinct (item.value->>'user_id')::uuid
        from jsonb_array_elements(p_splits) as item(value)
      )
    );

  select count(*)
    into v_member_count
  from (
    select distinct (item.value->>'user_id')::uuid as user_id
    from jsonb_array_elements(p_splits) as item(value)
  ) selected_users;

  if v_member_count = 0 then
    raise exception 'At least one active group member must be selected';
  end if;

  if v_input_count <> v_member_count then
    raise exception 'Each participant can appear only once in a split';
  end if;

  if v_active_count <> v_member_count then
    raise exception 'Every selected participant must be an active member of the group';
  end if;

  v_total_cents := round(p_amount * 100)::bigint;

  if v_type = 'Exact' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_splits) as item(value)
    loop
      if v_item ? 'user_id' = false or v_item ? 'value' = false then
        raise exception 'Every split entry must contain user_id and value';
      end if;

      v_value := (v_item->>'value')::numeric;
      if v_value is null or v_value < 0 then
        raise exception 'Exact amounts must be zero or greater';
      end if;

      if v_value <> round(v_value, 2) then
        raise exception 'Exact amounts support up to 2 decimal places';
      end if;

      v_total_value_cents := v_total_value_cents + round(v_value * 100)::bigint;
    end loop;

    if v_total_value_cents <> v_total_cents then
      raise exception 'Exact amounts must add up to the expense total';
    end if;

  elsif v_type = 'Percentage' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_splits) as item(value)
    loop
      v_value := (v_item->>'value')::numeric;
      if v_value is null or v_value < 0 or v_value > 100 then
        raise exception 'Percentages must be between 0 and 100';
      end if;

      if v_value <> round(v_value, 2) then
        raise exception 'Percentages support up to 2 decimal places';
      end if;

      v_total_percentage_bp := v_total_percentage_bp + round(v_value * 100)::bigint;
    end loop;

    if v_total_percentage_bp <> 10000 then
      raise exception 'Percentages must add up to exactly 100%%';
    end if;

  elsif v_type = 'Shares' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_splits) as item(value)
    loop
      v_value := (v_item->>'value')::numeric;
      if v_value is null or v_value <= 0 then
        raise exception 'Shares must be greater than 0';
      end if;

      if v_value <> trunc(v_value) then
        raise exception 'Shares must be whole numbers';
      end if;

      v_total_shares := v_total_shares + v_value::bigint;
    end loop;

    if v_total_shares <= 0 then
      raise exception 'Total shares must be greater than 0';
    end if;
  end if;

  update public.expenses
  set
    title = trim(p_title),
    amount = p_amount,
    split_type = v_type,
    paid_by = p_paid_by
  where id = p_expense_id;

  delete from public.expense_splits
  where expense_id = p_expense_id;

  if v_type = 'Exact' then
    for v_item in
      select item.value
      from jsonb_array_elements(p_splits) as item(value)
    loop
      insert into public.expense_splits (
        expense_id,
        user_id,
        amount
      )
      values (
        v_expense_id,
        (v_item->>'user_id')::uuid,
        round((v_item->>'value')::numeric, 2)
      );
    end loop;

  elsif v_type = 'Equal' then
    insert into public.expense_splits (
      expense_id,
      user_id,
      amount
    )
    with items as (
      select
        (item.value->>'user_id')::uuid as user_id,
        item.ordinality as item_order
      from jsonb_array_elements(p_splits) with ordinality as item(value, ordinality)
    ), base as (
      select
        user_id,
        item_order,
        floor(v_total_cents::numeric / v_member_count)::bigint as base_cents
      from items
    ), ranked as (
      select
        user_id,
        item_order,
        base_cents,
        row_number() over (order by item_order) as allocation_rank,
        v_total_cents - sum(base_cents) over () as remaining_cents
      from base
    )
    select
      v_expense_id,
      user_id,
      (
        base_cents
        + case when allocation_rank <= remaining_cents then 1 else 0 end
      ) / 100.0
    from ranked
    order by item_order;

    select coalesce(sum(round(amount * 100)::bigint), 0)
      into v_allocated_cents
    from public.expense_splits
    where expense_id = v_expense_id;

  elsif v_type = 'Percentage' then
    insert into public.expense_splits (
      expense_id,
      user_id,
      amount
    )
    with items as (
      select
        (item.value->>'user_id')::uuid as user_id,
        round((item.value->>'value')::numeric * 100)::bigint as weight,
        item.ordinality as item_order
      from jsonb_array_elements(p_splits) with ordinality as item(value, ordinality)
    ), base as (
      select
        user_id,
        item_order,
        weight,
        floor((v_total_cents::numeric * weight) / 10000)::bigint as base_cents,
        (
          (v_total_cents::numeric * weight)
          - floor((v_total_cents::numeric * weight) / 10000) * 10000
        )::numeric as fractional_remainder
      from items
    ), ranked as (
      select
        user_id,
        item_order,
        base_cents,
        row_number() over (
          order by fractional_remainder desc, item_order
        ) as allocation_rank,
        v_total_cents - sum(base_cents) over () as remaining_cents
      from base
      where weight > 0
    ), all_items as (
      select
        (item.value->>'user_id')::uuid as user_id,
        item.ordinality as item_order
      from jsonb_array_elements(p_splits) with ordinality as item(value, ordinality)
    )
    select
      v_expense_id,
      all_items.user_id,
      (
        coalesce(ranked.base_cents, 0)
        + case
            when ranked.allocation_rank <= ranked.remaining_cents then 1
            else 0
          end
      ) / 100.0
    from all_items
    left join ranked
      on ranked.user_id = all_items.user_id
    order by all_items.item_order;

    select coalesce(sum(round(amount * 100)::bigint), 0)
      into v_allocated_cents
    from public.expense_splits
    where expense_id = v_expense_id;

  else
    insert into public.expense_splits (
      expense_id,
      user_id,
      amount
    )
    with items as (
      select
        (item.value->>'user_id')::uuid as user_id,
        (item.value->>'value')::bigint as weight,
        item.ordinality as item_order
      from jsonb_array_elements(p_splits) with ordinality as item(value, ordinality)
    ), base as (
      select
        user_id,
        item_order,
        weight,
        floor((v_total_cents::numeric * weight) / v_total_shares)::bigint as base_cents,
        (
          (v_total_cents::numeric * weight)
          - floor((v_total_cents::numeric * weight) / v_total_shares) * v_total_shares
        )::numeric as fractional_remainder
      from items
    ), ranked as (
      select
        user_id,
        item_order,
        base_cents,
        row_number() over (
          order by fractional_remainder desc, item_order
        ) as allocation_rank,
        v_total_cents - sum(base_cents) over () as remaining_cents
      from base
      where weight > 0
    )
    select
      v_expense_id,
      ranked.user_id,
      (
        ranked.base_cents
        + case
            when ranked.allocation_rank <= ranked.remaining_cents then 1
            else 0
          end
      ) / 100.0
    from ranked
    order by item_order;

    select coalesce(sum(round(amount * 100)::bigint), 0)
      into v_allocated_cents
    from public.expense_splits
    where expense_id = v_expense_id;
  end if;

  if v_allocated_cents = 0 then
    select coalesce(sum(round(amount * 100)::bigint), 0)
      into v_allocated_cents
    from public.expense_splits
    where expense_id = v_expense_id;
  end if;

  if v_type = 'Exact' then
    v_allocated_cents := v_total_value_cents;
  end if;

  if v_allocated_cents <> v_total_cents then
    raise exception 'Calculated splits do not equal the expense total';
  end if;

  return v_expense_id;
end;
$$;

revoke all on function public.update_expense_with_splits(uuid, text, numeric, uuid, text, jsonb)
from public, anon;

grant execute on function public.update_expense_with_splits(uuid, text, numeric, uuid, text, jsonb)
to authenticated;

create or replace function public.delete_expense(
  p_expense_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_group_id uuid;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;

  if p_expense_id is null then
    raise exception 'Expense information is missing';
  end if;

  select e.group_id
    into v_group_id
  from public.expenses e
  where e.id = p_expense_id;

  if v_group_id is null then
    raise exception 'Expense not found';
  end if;

  if not exists (
    select 1
    from public.groups g
    where g.id = v_group_id
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

  delete from public.expenses
  where id = p_expense_id;

  return p_expense_id;
end;
$$;

revoke all on function public.delete_expense(uuid)
from public, anon;

grant execute on function public.delete_expense(uuid)
to authenticated;