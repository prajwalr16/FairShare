create extension if not exists pgcrypto;

create table if not exists users(
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  default_currency text default 'INR',
  created_at timestamptz default now()
);
