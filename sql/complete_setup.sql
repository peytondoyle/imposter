-- Complete setup script for Chameleon-style topic card format
-- This creates the entire schema from scratch

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS clues CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;

-- Topics table for Chameleon cards
CREATE TABLE topics (
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
CREATE TABLE rooms (
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
CREATE TABLE players (
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
CREATE TABLE rounds (
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
CREATE TABLE clues (
  id bigserial primary key,
  round_id uuid references rounds(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  word text not null check (char_length(word) <= 25),
  submitted_at timestamptz default now(),
  unique(round_id, player_id)
);

-- Votes table
CREATE TABLE votes (
  id bigserial primary key,
  round_id uuid references rounds(id) on delete cascade,
  voter_id uuid references players(id) on delete cascade,
  target_id uuid references players(id) on delete set null,
  created_at timestamptz default now(),
  unique(round_id, voter_id)
);

-- Game states table (for backward compatibility)
CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'role',
  topic JSONB,
  players JSONB DEFAULT '[]'::jsonb,
  clues JSONB DEFAULT '{}'::jsonb,
  votes JSONB DEFAULT '{}'::jsonb,
  imposter_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_device_id ON players(device_id);
CREATE INDEX idx_rounds_room_id ON rounds(room_id);
CREATE INDEX idx_clues_round_id ON clues(round_id);
CREATE INDEX idx_votes_round_id ON votes(round_id);
CREATE INDEX idx_topics_family_safe ON topics(family_safe);
CREATE INDEX idx_game_states_room_id ON game_states(room_id);

-- Enable Row Level Security
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Topics policies (read-only for all authenticated users)
CREATE POLICY "Topics are viewable by everyone"
  ON topics FOR SELECT
  USING (true);

-- Rooms policies
CREATE POLICY "Rooms are viewable by everyone"
  ON rooms FOR SELECT
  USING (true);

CREATE POLICY "Rooms can be created by anyone"
  ON rooms FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Rooms can be updated by players in the room"
  ON rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players 
      WHERE players.room_id = rooms.id
    )
  );

-- Players policies
CREATE POLICY "Players are viewable by everyone in the same room"
  ON players FOR SELECT
  USING (true);

CREATE POLICY "Players can insert themselves"
  ON players FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Players can update themselves with valid token"
  ON players FOR UPDATE
  USING (
    write_token = current_setting('app.write_token', true)
    OR is_host = true
  );

CREATE POLICY "Players can delete themselves or be deleted by host"
  ON players FOR DELETE
  USING (
    write_token = current_setting('app.write_token', true)
    OR EXISTS (
      SELECT 1 FROM players p
      WHERE p.room_id = players.room_id
      AND p.is_host = true
      AND p.write_token = current_setting('app.write_token', true)
    )
  );

-- Rounds policies
CREATE POLICY "Rounds are viewable by players in the room"
  ON rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = rounds.room_id
    )
  );

CREATE POLICY "Rounds can be created by host"
  ON rounds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = rounds.room_id
      AND players.is_host = true
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

CREATE POLICY "Rounds can be updated by host"
  ON rounds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = rounds.room_id
      AND players.is_host = true
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

-- Clues policies
CREATE POLICY "Clues are viewable by players in the round"
  ON clues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN players ON players.room_id = rounds.room_id
      WHERE rounds.id = clues.round_id
    )
  );

CREATE POLICY "Players can submit their own clue"
  ON clues FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = clues.player_id
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

-- Votes policies
CREATE POLICY "Votes are viewable after voting phase"
  ON votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      WHERE rounds.id = votes.round_id
      AND rounds.phase IN ('reveal', 'done')
    )
  );

CREATE POLICY "Players can submit their own vote"
  ON votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = votes.voter_id
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

-- Game states policies (very permissive for testing)
CREATE POLICY "Allow all operations" ON game_states
  FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL ON topics TO authenticated;
GRANT ALL ON topics TO anon;
GRANT ALL ON topics TO service_role;
GRANT ALL ON rooms TO authenticated;
GRANT ALL ON rooms TO anon;
GRANT ALL ON rooms TO service_role;
GRANT ALL ON players TO authenticated;
GRANT ALL ON players TO anon;
GRANT ALL ON players TO service_role;
GRANT ALL ON rounds TO authenticated;
GRANT ALL ON rounds TO anon;
GRANT ALL ON rounds TO service_role;
GRANT ALL ON clues TO authenticated;
GRANT ALL ON clues TO anon;
GRANT ALL ON clues TO service_role;
GRANT ALL ON votes TO authenticated;
GRANT ALL ON votes TO anon;
GRANT ALL ON votes TO service_role;
GRANT ALL ON game_states TO authenticated;
GRANT ALL ON game_states TO anon;
GRANT ALL ON game_states TO service_role;

-- Helper functions
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to clean up old rooms (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms 
  WHERE created_at < now() - interval '24 hours'
  AND status = 'ended';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update player last_seen
CREATE OR REPLACE FUNCTION update_last_seen(player_id uuid, token text)
RETURNS void AS $$
BEGIN
  UPDATE players 
  SET last_seen = now()
  WHERE id = player_id 
  AND write_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_game_states_updated_at 
  BEFORE UPDATE ON game_states 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get random topic respecting family_safe filter
CREATE OR REPLACE FUNCTION get_random_topic(family_safe_only boolean)
RETURNS SETOF topics AS $$
BEGIN
  IF family_safe_only THEN
    RETURN QUERY 
    SELECT * FROM topics 
    WHERE family_safe = true 
    ORDER BY random() 
    LIMIT 1;
  ELSE
    RETURN QUERY 
    SELECT * FROM topics 
    ORDER BY random() 
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert sample topics data
INSERT INTO topics (category, topic, word1, word2, word3, word4, word5, word6, word7, word8, family_safe) VALUES
-- Food & Drink
('Pizza Toppings', 'Pizza Toppings', 'Pepperoni', 'Mushrooms', 'Pineapple', 'Sausage', 'Olives', 'Onions', 'Bacon', 'Peppers', true),
('Ice Cream Flavors', 'Ice Cream Flavors', 'Vanilla', 'Chocolate', 'Strawberry', 'Mint', 'Cookie Dough', 'Rocky Road', 'Pistachio', 'Caramel', true),
('Breakfast Foods', 'Breakfast Foods', 'Pancakes', 'Eggs', 'Bacon', 'Toast', 'Cereal', 'Oatmeal', 'Waffles', 'Yogurt', true),
('Fruits', 'Fruits', 'Apple', 'Banana', 'Orange', 'Strawberry', 'Grape', 'Watermelon', 'Mango', 'Pineapple', true),
('Vegetables', 'Vegetables', 'Carrot', 'Broccoli', 'Tomato', 'Potato', 'Onion', 'Lettuce', 'Cucumber', 'Corn', true),

-- Beach & Ocean
('Beach Gear', 'Beach Gear', 'Surfboard', 'Towel', 'Sunscreen', 'Flip-Flops', 'Beach Ball', 'Cooler', 'Chair', 'Swimsuit', true),
('Ocean Animals', 'Ocean Animals', 'Shark', 'Dolphin', 'Whale', 'Octopus', 'Jellyfish', 'Sea Turtle', 'Starfish', 'Crab', true),
('Beach Activities', 'Beach Activities', 'Swimming', 'Surfing', 'Volleyball', 'Sandcastle', 'Sunbathing', 'Snorkeling', 'Fishing', 'Walking', true),

-- Sports & Games
('Sports', 'Sports', 'Soccer', 'Basketball', 'Tennis', 'Baseball', 'Golf', 'Football', 'Hockey', 'Swimming', true),
('Board Games', 'Board Games', 'Monopoly', 'Chess', 'Checkers', 'Scrabble', 'Risk', 'Clue', 'Sorry', 'Life', true),
('Video Games', 'Video Games', 'Mario', 'Zelda', 'Minecraft', 'Fortnite', 'Pokemon', 'Tetris', 'Pac-Man', 'Sonic', true),

-- Animals
('Pets', 'Pets', 'Dog', 'Cat', 'Fish', 'Bird', 'Hamster', 'Rabbit', 'Snake', 'Turtle', true),
('Farm Animals', 'Farm Animals', 'Cow', 'Pig', 'Chicken', 'Horse', 'Sheep', 'Goat', 'Duck', 'Turkey', true),
('Zoo Animals', 'Zoo Animals', 'Lion', 'Elephant', 'Giraffe', 'Monkey', 'Zebra', 'Bear', 'Tiger', 'Penguin', true),
('Birds', 'Birds', 'Eagle', 'Owl', 'Parrot', 'Robin', 'Hawk', 'Crow', 'Flamingo', 'Peacock', true),

-- Places & Travel
('Countries', 'Countries', 'USA', 'Canada', 'Mexico', 'Brazil', 'France', 'Japan', 'Australia', 'Egypt', true),
('US Cities', 'US Cities', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle', 'Boston', 'Denver', true),
('Vacation Spots', 'Vacation Spots', 'Beach', 'Mountains', 'Cruise', 'Disney', 'Paris', 'Hawaii', 'Vegas', 'Camping', true),
('Room in House', 'Room in House', 'Kitchen', 'Bedroom', 'Bathroom', 'Living Room', 'Garage', 'Basement', 'Attic', 'Office', true),

-- School & Work
('School Subjects', 'School Subjects', 'Math', 'Science', 'English', 'History', 'Art', 'Music', 'PE', 'Geography', true),
('School Supplies', 'School Supplies', 'Pencil', 'Paper', 'Eraser', 'Backpack', 'Notebook', 'Ruler', 'Glue', 'Scissors', true),
('Jobs', 'Jobs', 'Doctor', 'Teacher', 'Police', 'Firefighter', 'Chef', 'Pilot', 'Artist', 'Farmer', true),

-- Entertainment
('Movies', 'Movies', 'Star Wars', 'Harry Potter', 'Marvel', 'Disney', 'Jurassic Park', 'Toy Story', 'Frozen', 'Avatar', true),
('Music Genres', 'Music Genres', 'Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Country', 'Electronic', 'Blues', true),
('Instruments', 'Instruments', 'Piano', 'Guitar', 'Drums', 'Violin', 'Trumpet', 'Flute', 'Saxophone', 'Bass', true),
('TV Shows', 'TV Shows', 'Friends', 'The Office', 'Simpsons', 'SpongeBob', 'Stranger Things', 'Game of Thrones', 'Breaking Bad', 'Mandalorian', true),

-- Everyday Items
('Clothing', 'Clothing', 'Shirt', 'Pants', 'Shoes', 'Hat', 'Jacket', 'Socks', 'Dress', 'Gloves', true),
('Colors', 'Colors', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Black', 'White', true),
('Weather', 'Weather', 'Sunny', 'Rainy', 'Cloudy', 'Snowy', 'Windy', 'Foggy', 'Stormy', 'Hot', true),
('Emotions', 'Emotions', 'Happy', 'Sad', 'Angry', 'Scared', 'Excited', 'Nervous', 'Surprised', 'Confused', true),
('Body Parts', 'Body Parts', 'Head', 'Arm', 'Leg', 'Hand', 'Foot', 'Eye', 'Ear', 'Nose', true),

-- Technology
('Social Media', 'Social Media', 'Facebook', 'Instagram', 'Twitter', 'TikTok', 'Snapchat', 'YouTube', 'LinkedIn', 'Reddit', true),
('Computer Parts', 'Computer Parts', 'Monitor', 'Keyboard', 'Mouse', 'CPU', 'RAM', 'Hard Drive', 'Graphics Card', 'Motherboard', true),
('Phone Apps', 'Phone Apps', 'Messages', 'Camera', 'Maps', 'Email', 'Calendar', 'Music', 'Games', 'Weather', true),

-- Holidays & Seasons
('Holidays', 'Holidays', 'Christmas', 'Halloween', 'Thanksgiving', 'Easter', 'July 4th', 'Valentines', 'New Years', 'Birthday', true),
('Seasons', 'Seasons', 'Spring', 'Summer', 'Fall', 'Winter', 'Rainy', 'Dry', 'Hurricane', 'Monsoon', true),
('Christmas', 'Christmas', 'Tree', 'Santa', 'Presents', 'Reindeer', 'Stockings', 'Cookies', 'Snow', 'Lights', true),
('Halloween', 'Halloween', 'Pumpkin', 'Costume', 'Candy', 'Ghost', 'Witch', 'Vampire', 'Skeleton', 'Spider', true),

-- Transportation
('Vehicles', 'Vehicles', 'Car', 'Truck', 'Motorcycle', 'Bus', 'Train', 'Airplane', 'Boat', 'Bicycle', true),
('Car Brands', 'Car Brands', 'Toyota', 'Ford', 'Honda', 'Tesla', 'BMW', 'Mercedes', 'Jeep', 'Chevrolet', true),

-- More Fun Topics
('Superheroes', 'Superheroes', 'Superman', 'Batman', 'Spider-Man', 'Iron Man', 'Wonder Woman', 'Hulk', 'Thor', 'Captain America', true),
('Disney Movies', 'Disney Movies', 'Lion King', 'Frozen', 'Moana', 'Aladdin', 'Beauty Beast', 'Little Mermaid', 'Toy Story', 'Finding Nemo', true),
('Candy', 'Candy', 'Chocolate', 'Gummies', 'Lollipop', 'Skittles', 'M&Ms', 'Snickers', 'Twix', 'Sour Patch', true),
('Fast Food', 'Fast Food', 'McDonalds', 'Burger King', 'Subway', 'KFC', 'Taco Bell', 'Wendys', 'Chipotle', 'Pizza Hut', true),
('Drinks', 'Drinks', 'Water', 'Soda', 'Juice', 'Coffee', 'Tea', 'Milk', 'Smoothie', 'Lemonade', true),
('Desserts', 'Desserts', 'Cake', 'Ice Cream', 'Cookies', 'Pie', 'Brownies', 'Donuts', 'Pudding', 'Candy', true),
('Hobbies', 'Hobbies', 'Reading', 'Gaming', 'Cooking', 'Gardening', 'Painting', 'Dancing', 'Fishing', 'Photography', true),
('Tools', 'Tools', 'Hammer', 'Screwdriver', 'Wrench', 'Drill', 'Saw', 'Pliers', 'Tape Measure', 'Level', true),
('Kitchen Items', 'Kitchen Items', 'Stove', 'Refrigerator', 'Microwave', 'Toaster', 'Blender', 'Dishwasher', 'Oven', 'Sink', true),
('Bathroom Items', 'Bathroom Items', 'Toilet', 'Shower', 'Sink', 'Mirror', 'Towel', 'Soap', 'Toothbrush', 'Shampoo', true);

-- Create some test rooms for development
INSERT INTO rooms (code, status, max_players, win_target, family_safe_only) VALUES
('TEST01', 'lobby', 8, 5, true),
('TEST02', 'lobby', 12, 7, true);

-- Verify the setup
SELECT 
    'Schema setup complete!' as status,
    (SELECT COUNT(*) FROM topics) as topics_count,
    (SELECT COUNT(*) FROM rooms) as rooms_count;
