-- Run this once in the Supabase SQL editor for the project backing this app.
-- Matches the schema and RLS tradeoff documented in CLAUDE.md > Persistence and sync.

create table if not exists character_state (
  id bigint primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table character_state enable row level security;

-- Permissive by design: the anon key ships in the client bundle and this app
-- has no auth flow. The data at risk is a druid's hit points.
create policy "anon full access to character_state"
  on character_state
  for all
  to anon
  using (true)
  with check (true);
