-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.

-- 1) The table that remembers each photo's details.
create table if not exists public.photos (
  id          uuid primary key,
  title       text        not null default '',
  taken_at    timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  width       integer     not null,
  height      integer     not null,
  full_path   text        not null,
  thumb_path  text        not null
);

-- Lock the table down. The website talks to it only from the server (with the secret
-- service key), so nobody on the internet can read or change it directly.
alter table public.photos enable row level security;

-- 2) The storage bucket for the photo files. Public = anyone can view a photo if they
--    have its link (that is how the website shows them). Only the server can add/delete.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;
