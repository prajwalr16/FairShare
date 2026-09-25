create index if not exists idx_groups_owner_created
on groups(owner_id,created_at desc);
