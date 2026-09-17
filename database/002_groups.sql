create table if not exists groups(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,
 name text not null,
 type text not null check(type in ('Trip','Home','Friends','Office','Other')),
 currency text not null default 'INR',
 description text,
 created_at timestamptz default now()
);

alter table groups enable row level security;

create policy "Owners manage own groups"
on groups
for all
using (auth.uid()=owner_id)
with check (auth.uid()=owner_id);
