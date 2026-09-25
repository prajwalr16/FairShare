create table if not exists groups (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    type text not null check (type in ('Trip','Home','Friends','Office','Other')),
    currency text not null default 'INR',
    description text,
    created_at timestamptz default now()
);

alter table groups enable row level security;

create policy "Users can view own groups"
on groups
for select
using (auth.uid() = owner_id);

create policy "Users can insert own groups"
on groups
for insert
with check (auth.uid() = owner_id);

create policy "Users can update own groups"
on groups
for update
using (auth.uid() = owner_id);

create policy "Users can delete own groups"
on groups
for delete
using (auth.uid() = owner_id);