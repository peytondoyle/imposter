-- Complete fix for the imposter game database schema
-- This migration creates all necessary tables and functions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (in correct order)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS clues CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;
DROP TABLE IF EXISTS rounds CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS text_prompts CASCADE;
DROP TABLE IF EXISTS game_states CASCADE;

-- Create rooms table
CREATE TABLE rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (char_length(code) = 6),
  created_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'ended')),
  max_players int NOT NULL DEFAULT 12,
  win_target int NOT NULL DEFAULT 5,
  current_round int NOT NULL DEFAULT 0,
  family_safe_only boolean DEFAULT true
);

-- Create players table
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 20),
  avatar text NOT NULL DEFAULT '🦀',
  is_host boolean NOT NULL DEFAULT false,
  device_id uuid NOT NULL,
  write_token text NOT NULL,
  total_score int NOT NULL DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  UNIQUE(room_id, device_id)
);

-- Create rounds table
CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  topic_id bigint,
  secret_word_index int CHECK (secret_word_index BETWEEN 1 AND 8),
  phase text NOT NULL DEFAULT 'role_reveal' 
    CHECK (phase IN ('role_reveal', 'answer', 'reveal_answers', 'vote', 'imposter_guess', 'reveal', 'done')),
  imposter_id uuid REFERENCES players(id),
  imposter_guess_index int CHECK (imposter_guess_index BETWEEN 1 AND 8),
  imposter_caught boolean,
  started_at timestamptz DEFAULT now(),
  phase_deadline timestamptz,
  text_prompts jsonb,
  selected_prompt_id bigint,
  UNIQUE(room_id, round_number)
);

-- Create text_prompts table
CREATE TABLE text_prompts (
  id bigserial PRIMARY KEY,
  prompt text NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create prompts table (for individual round prompts)
CREATE TABLE prompts (
  id bigserial PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  prompt_text text NOT NULL,
  prompt_order int NOT NULL CHECK (prompt_order BETWEEN 1 AND 5),
  is_imposter_prompt boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, prompt_order)
);

-- Create answers table
CREATE TABLE answers (
  id bigserial PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  prompt_id bigint REFERENCES prompts(id) ON DELETE CASCADE,
  answer_text text NOT NULL CHECK (char_length(answer_text) <= 100),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(round_id, player_id, prompt_id)
);

-- Create clues table (for backward compatibility)
CREATE TABLE clues (
  id bigserial PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  word text NOT NULL CHECK (char_length(word) <= 25),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- Create votes table
CREATE TABLE votes (
  id bigserial PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  voter_id uuid REFERENCES players(id) ON DELETE CASCADE,
  target_id uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(round_id, voter_id)
);

-- Create topics table (for backward compatibility)
CREATE TABLE topics (
  id bigserial PRIMARY KEY,
  category text NOT NULL,
  topic text NOT NULL,
  word1 text NOT NULL,
  word2 text NOT NULL,
  word3 text NOT NULL,
  word4 text NOT NULL,
  word5 text NOT NULL,
  word6 text NOT NULL,
  word7 text NOT NULL,
  word8 text NOT NULL,
  family_safe boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_device_id ON players(device_id);
CREATE INDEX idx_rounds_room_id ON rounds(room_id);
CREATE INDEX idx_clues_round_id ON clues(round_id);
CREATE INDEX idx_votes_round_id ON votes(round_id);
CREATE INDEX idx_prompts_round_id ON prompts(round_id);
CREATE INDEX idx_answers_round_id ON answers(round_id);
CREATE INDEX idx_answers_player_id ON answers(player_id);
CREATE INDEX idx_answers_prompt_id ON answers(prompt_id);
CREATE INDEX idx_text_prompts_category ON text_prompts(category);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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

-- Prompts policies
CREATE POLICY "Prompts are viewable by players in the round"
  ON prompts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN players ON players.room_id = rounds.room_id
      WHERE rounds.id = prompts.round_id
      AND (
        -- Regular prompts are visible to all players
        NOT prompts.is_imposter_prompt
        OR
        -- Imposter prompts are only visible to the imposter
        (prompts.is_imposter_prompt AND players.id = rounds.imposter_id)
      )
    )
  );

CREATE POLICY "Prompts can be created by host"
  ON prompts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN players ON players.room_id = rounds.room_id
      WHERE rounds.id = prompts.round_id
      AND players.is_host = true
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

-- Answers policies
CREATE POLICY "Answers are viewable by players in the round after submission"
  ON answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rounds
      JOIN players ON players.room_id = rounds.room_id
      WHERE rounds.id = answers.round_id
      AND rounds.phase IN ('reveal_answers', 'vote', 'reveal', 'done')
    )
  );

CREATE POLICY "Players can submit their own answers"
  ON answers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = answers.player_id
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

CREATE POLICY "Players can update their own answers before submission"
  ON answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = answers.player_id
      AND players.write_token = current_setting('app.write_token', true)
    )
  );

-- Text prompts policies
CREATE POLICY "Text prompts are viewable by everyone"
  ON text_prompts FOR SELECT
  USING (true);

-- Topics policies
CREATE POLICY "Topics are viewable by everyone"
  ON topics FOR SELECT
  USING (true);

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

-- Function to get prompts for a specific player
CREATE OR REPLACE FUNCTION get_player_prompts(
  p_round_id uuid,
  p_player_id uuid
)
RETURNS TABLE (
  id bigint,
  prompt_text text,
  prompt_order int,
  is_imposter_prompt boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.prompt_text,
    p.prompt_order,
    p.is_imposter_prompt
  FROM prompts p
  JOIN rounds r ON r.id = p.round_id
  WHERE p.round_id = p_round_id
  AND (
    -- Regular prompts for all players
    NOT p.is_imposter_prompt
    OR
    -- Imposter prompts only for the imposter
    (p.is_imposter_prompt AND r.imposter_id = p_player_id)
  )
  ORDER BY p.prompt_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert text prompts
INSERT INTO text_prompts (prompt, category) VALUES
-- Personal Preferences
('What''s your favorite breakfast food?', 'Personal'),
('What''s the last app you opened on your phone?', 'Personal'),
('What household chore do you hate the most?', 'Personal'),
('What''s your go-to comfort food?', 'Personal'),
('What''s your favorite type of weather?', 'Personal'),
('What''s the last movie you watched?', 'Personal'),
('What''s your favorite season?', 'Personal'),
('What''s your dream vacation destination?', 'Personal'),
('What''s your favorite type of music?', 'Personal'),
('What''s your biggest pet peeve?', 'Personal'),

-- Daily Life
('What did you have for lunch today?', 'Daily Life'),
('What time did you wake up this morning?', 'Daily Life'),
('What''s your morning routine?', 'Daily Life'),
('What''s the last thing you bought?', 'Daily Life'),
('What''s your favorite way to relax?', 'Daily Life'),
('What''s your least favorite day of the week?', 'Daily Life'),
('What''s your favorite room in your house?', 'Daily Life'),
('What''s your typical weekend activity?', 'Daily Life'),
('What''s your favorite way to exercise?', 'Daily Life'),
('What''s your bedtime routine?', 'Daily Life'),

-- Technology & Media
('What''s your favorite social media platform?', 'Technology'),
('What''s the last YouTube video you watched?', 'Technology'),
('What''s your favorite streaming service?', 'Technology'),
('What''s your most used app?', 'Technology'),
('What''s your favorite video game?', 'Technology'),
('What''s your preferred way to listen to music?', 'Technology'),
('What''s your favorite type of content to watch?', 'Technology'),
('What''s your go-to news source?', 'Technology'),
('What''s your favorite website?', 'Technology'),
('What''s your preferred way to communicate?', 'Technology'),

-- Food & Drink
('What''s your favorite type of cuisine?', 'Food'),
('What''s your go-to coffee order?', 'Food'),
('What''s your favorite snack?', 'Food'),
('What''s your least favorite food?', 'Food'),
('What''s your favorite type of dessert?', 'Food'),
('What''s your preferred way to cook?', 'Food'),
('What''s your favorite restaurant chain?', 'Food'),
('What''s your go-to drink?', 'Food'),
('What''s your favorite type of bread?', 'Food'),
('What''s your preferred way to eat pizza?', 'Food'),

-- Hobbies & Interests
('What''s your favorite hobby?', 'Hobbies'),
('What''s your favorite type of book?', 'Hobbies'),
('What''s your preferred way to spend free time?', 'Hobbies'),
('What''s your favorite type of art?', 'Hobbies'),
('What''s your go-to stress relief activity?', 'Hobbies'),
('What''s your favorite type of puzzle?', 'Hobbies'),
('What''s your preferred way to learn new things?', 'Hobbies'),
('What''s your favorite type of craft?', 'Hobbies'),
('What''s your go-to party game?', 'Hobbies'),
('What''s your favorite type of collection?', 'Hobbies');

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION get_player_prompts TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_prompts TO anon;
GRANT EXECUTE ON FUNCTION get_player_prompts TO service_role;
