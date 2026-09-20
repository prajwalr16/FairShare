create table if not exists expenses(
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references groups(id) on delete cascade,
 title text not null,
 amount numeric not null check(amount>0),
 split_type text not null default 'Equal',
 paid_by uuid references auth.users(id),
 created_at timestamptz default now()
);
alter table expenses enable row level security;
