create table if not exists group_members(
id uuid primary key default gen_random_uuid(),
group_id uuid not null references groups(id) on delete cascade,
user_id uuid references auth.users(id) on delete cascade,
email text not null,
role text default 'member',
created_at timestamptz default now(),
unique(group_id,email)
);