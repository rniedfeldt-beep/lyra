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

-- Spell cards (/cards tool) — one row per (character, spell), so the same
-- spell can carry a different card for Lyra vs. Vaelith. mech/card are the
-- same shapes the card composer already works with (see
-- src/cards/cardRender.js): mech is the card's own mechanical fields
-- (level, school, casting time, …), card is the description block
-- (flavor/primary/secondary/note/table/continued). No login: same
-- permissive-policy tradeoff as character_state, for the same reason —
-- two trusted people, no data worth gating behind auth.
create table if not exists spell_cards (
  id bigint generated always as identity primary key,
  character text not null,
  spell_name text not null,
  mech jsonb not null default '{}'::jsonb,
  card jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (character, spell_name)
);

alter table spell_cards enable row level security;

create policy "anon full access to spell_cards"
  on spell_cards
  for all
  to anon
  using (true)
  with check (true);
