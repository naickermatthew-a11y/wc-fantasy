-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists rooms (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  host_id text not null,
  match_id integer not null,
  status text not null default 'waiting',  -- waiting | drafting | playing | finished
  max_players integer not null default 4,
  draft_pick_index integer not null default 0,
  game_state jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists room_players (
  id uuid default gen_random_uuid() primary key,
  room_code text not null references rooms(code) on delete cascade,
  user_id text not null,
  display_name text not null,
  pick_order integer,
  picks jsonb not null default '[]'::jsonb,
  powerups jsonb not null default '{"doubleDown":false,"wildcard":false,"freeze":false}'::jsonb,
  joined_at timestamptz default now(),
  unique(room_code, user_id)
);

create table if not exists ticker_events (
  id uuid default gen_random_uuid() primary key,
  room_code text not null references rooms(code) on delete cascade,
  minute integer not null,
  event_type text,
  fantasy_player_name text,
  fantasy_player_id text,
  points integer default 0,
  owner_user_id text,
  is_system boolean default false,
  message text,
  is_frozen boolean default false,
  is_doubled boolean default false,
  created_at timestamptz default now()
);

-- RLS: allow full access via anon key (suitable for a demo app)
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table ticker_events enable row level security;

create policy "public_all_rooms" on rooms for all using (true) with check (true);
create policy "public_all_room_players" on room_players for all using (true) with check (true);
create policy "public_all_ticker_events" on ticker_events for all using (true) with check (true);

-- Enable Realtime for all three tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table ticker_events;
