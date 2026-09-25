create table if not exists expense_splits(
 id uuid primary key default gen_random_uuid(),
 expense_id uuid not null references expenses(id) on delete cascade,
 user_id uuid references auth.users(id),
 amount numeric not null check(amount>=0),
 created_at timestamptz default now()
);
alter table expense_splits enable row level security;