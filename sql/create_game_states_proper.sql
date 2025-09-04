-- Create game_states table with proper structure
DROP TABLE IF EXISTS game_states CASCADE;

CREATE TABLE game_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  current_phase TEXT NOT NULL DEFAULT 'role' CHECK (current_phase IN ('role', 'clue', 'voting', 'results')),
  topic JSONB NOT NULL DEFAULT '{}'::jsonb,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  clues JSONB NOT NULL DEFAULT '{}'::jsonb,
  votes JSONB NOT NULL DEFAULT '{}'::jsonb,
  imposter_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_game_states_room_id ON game_states(room_id);
CREATE INDEX idx_game_states_phase ON game_states(current_phase);

-- Enable RLS
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for testing
CREATE POLICY "game_states_select_policy" ON game_states FOR SELECT USING (true);
CREATE POLICY "game_states_insert_policy" ON game_states FOR INSERT WITH CHECK (true);
CREATE POLICY "game_states_update_policy" ON game_states FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "game_states_delete_policy" ON game_states FOR DELETE USING (true);

-- Grant permissions
GRANT ALL ON game_states TO authenticated;
GRANT ALL ON game_states TO anon;
GRANT ALL ON game_states TO service_role;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

DROP TRIGGER IF EXISTS update_game_states_updated_at ON game_states;
CREATE TRIGGER update_game_states_updated_at 
  BEFORE UPDATE ON game_states 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Test insertion
INSERT INTO game_states (room_id, current_phase, topic, players, imposter_id) 
VALUES (
  gen_random_uuid(),
  'role',
  '{"category": "Test", "words": ["Test1", "Test2"], "secret_word": "Test1", "impostor_hint": "Test hint"}',
  '[{"id": "test-id", "name": "Test Player", "avatar": "🎭", "role": "detective"}]',
  'test-id'
);

-- Verify and clean up
SELECT 'Game states table created successfully. Test record count:', COUNT(*) FROM game_states;
DELETE FROM game_states WHERE topic->>'category' = 'Test';
SELECT 'Cleanup complete. Final count:', COUNT(*) FROM game_states;