-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Topics table for Chameleon cards
create table topics (
  id bigserial primary key,
  category text not null,
  topic text not null,
  word1 text not null,
  word2 text not null,
  word3 text not null,
  word4 text not null,
  word5 text not null,
  word6 text not null,
  word7 text not null,
  word8 text not null,
  family_safe boolean default true,
  created_at timestamptz default now()
);

-- Rooms table
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (char_length(code) = 6),
  created_at timestamptz default now(),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'ended')),
  max_players int not null default 12,
  win_target int not null default 5,
  current_round int not null default 0,
  family_safe_only boolean default true
);

-- Players table
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  name text not null check (char_length(name) <= 20),
  avatar text not null default '🦀',
  is_host boolean not null default false,
  device_id uuid not null,
  write_token text not null,
  total_score int not null default 0,
  joined_at timestamptz default now(),
  last_seen timestamptz default now(),
  unique(room_id, device_id)
);

-- Rounds table
create table rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  round_number int not null,
  topic_id bigint references topics(id),
  secret_word_index int not null check (secret_word_index between 1 and 8),
  phase text not null default 'role_reveal' 
    check (phase in ('role_reveal', 'clue', 'reveal_clues', 'vote', 'reveal', 'done')),
  imposter_id uuid references players(id),
  imposter_guess_index int check (imposter_guess_index between 1 and 8),
  imposter_caught boolean,
  started_at timestamptz default now(),
  phase_deadline timestamptz,
  unique(room_id, round_number)
);

-- Clues table
create table clues (
  id bigserial primary key,
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  word text not null check (char_length(word) <= 25),
  submitted_at timestamptz default now(),
  unique(round_id, player_id)
);

-- Votes table
create table votes (
  id bigserial primary key,
  round_id uuid references rounds(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete set null,
  created_at timestamptz default now(),
  unique(round_id, voter_id)
);

-- Indexes for performance
create index idx_rooms_code on rooms(code);
create index idx_rooms_status on rooms(status);
create index idx_players_room_id on players(room_id);
create index idx_players_device_id on players(device_id);
create index idx_rounds_room_id on rounds(room_id);
create index idx_clues_round_id on clues(round_id);
create index idx_votes_round_id on votes(round_id);
create index idx_topics_family_safe on topics(family_safe);

-- Enable Row Level Security
alter table topics enable row level security;
alter table rooms enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;
alter table clues enable row level security;
alter table votes enable row level security;

-- Topics policies (read-only for all authenticated users)
create policy "Topics are viewable by everyone"
  on topics for select
  using (true);

-- Rooms policies
create policy "Rooms are viewable by everyone"
  on rooms for select
  using (true);

create policy "Rooms can be created by anyone"
  on rooms for insert
  with check (true);

create policy "Rooms can be updated by players in the room"
  on rooms for update
  using (
    exists (
      select 1 from players 
      where players.room_id = rooms.id
    )
  );

-- Players policies
create policy "Players are viewable by everyone in the same room"
  on players for select
  using (true);

create policy "Players can insert themselves"
  on players for insert
  with check (true);

create policy "Players can update themselves with valid token"
  on players for update
  using (
    write_token = current_setting('app.write_token', true)
    or is_host = true
  );

create policy "Players can delete themselves or be deleted by host"
  on players for delete
  using (
    write_token = current_setting('app.write_token', true)
    or exists (
      select 1 from players p
      where p.room_id = players.room_id
      and p.is_host = true
      and p.write_token = current_setting('app.write_token', true)
    )
  );

-- Rounds policies
create policy "Rounds are viewable by players in the room"
  on rounds for select
  using (
    exists (
      select 1 from players
      where players.room_id = rounds.room_id
    )
  );

create policy "Rounds can be created by host"
  on rounds for insert
  with check (
    exists (
      select 1 from players
      where players.room_id = rounds.room_id
      and players.is_host = true
      and players.write_token = current_setting('app.write_token', true)
    )
  );

create policy "Rounds can be updated by host"
  on rounds for update
  using (
    exists (
      select 1 from players
      where players.room_id = rounds.room_id
      and players.is_host = true
      and players.write_token = current_setting('app.write_token', true)
    )
  );

-- Clues policies
create policy "Clues are viewable by players in the round"
  on clues for select
  using (
    exists (
      select 1 from rounds
      join players on players.room_id = rounds.room_id
      where rounds.id = clues.round_id
    )
  );

create policy "Players can submit their own clue"
  on clues for insert
  with check (
    exists (
      select 1 from players
      where players.id = clues.player_id
      and players.write_token = current_setting('app.write_token', true)
    )
  );

-- Votes policies
create policy "Votes are viewable after voting phase"
  on votes for select
  using (
    exists (
      select 1 from rounds
      where rounds.id = votes.round_id
      and rounds.phase in ('reveal', 'done')
    )
  );

create policy "Players can submit their own vote"
  on votes for insert
  with check (
    exists (
      select 1 from players
      where players.id = votes.voter_id
      and players.write_token = current_setting('app.write_token', true)
    )
  );

-- Helper functions
create or replace function generate_room_code()
returns text as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql volatile;

-- Function to clean up old rooms (older than 24 hours)
create or replace function cleanup_old_rooms()
returns void as $$
begin
  delete from rooms 
  where created_at < now() - interval '24 hours'
  and status = 'ended';
end;
$$ language plpgsql security definer;

-- Function to update player last_seen
create or replace function update_last_seen(player_id uuid, token text)
returns void as $$
begin
  update players 
  set last_seen = now()
  where id = player_id 
  and write_token = token;
end;
$$ language plpgsql security definer;